console.log("✅ tablero.js cargado");
const canvas = document.getElementById('tableroCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 650;
canvas.height = 500;
const btnDeshacer = document.getElementById('btnDeshacer');
const turnoTexto = document.getElementById('turnoTexto');

let board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
let turno = 0;
let selectedPiece = null;
let posiblesMovimientos = [];
let caminosDestino = {};

// --- variables para elección de ruta del caballo ---
let modoRuta = false;             // true cuando hay que elegir ruta
let rutasAlternativas = [];       // array de {inter, pasos}
let destinoRuta = null;           // [f,c] del destino elegido

const imagenesPiezas = {};
const colorBordeEquipo = ['#CC0000', '#1E3A8A'];

function precargarImagenes() {
    const extensiones = ['.jpg', '.jpeg', '.png'];
    for (let tipo of piezasRegistradas.keys()) {
        if (imagenesPiezas[tipo]) continue;
        extensiones.forEach(ext => {
            const img = new Image();
            img.src = `img/${tipo.toLowerCase()}${ext}`;
            img.onload = () => {
                imagenesPiezas[tipo] = img;
                console.log(`✅ Imagen cargada: ${img.src}`);
                dibujarTablero();
            };
            img.onerror = () => {};
        });
    }
}

function copiarBoard() {
    return board.map(fila => fila.map(celda => {
        if (celda === null) return null;
        const ClasePieza = piezasRegistradas.get(celda.tipo);
        return ClasePieza ? new ClasePieza(celda.jugador) : null;
    }));
}

function guardarEstado() {
    historial.guardar({ board: copiarBoard(), turno: turno });
    btnDeshacer.disabled = false;
}

function deshacerMovimiento() {
    if (!historial.puedeDeshacer()) return;
    let estado = historial.deshacer();
    board = estado.board;
    turno = estado.turno;
    selectedPiece = null;
    posiblesMovimientos = [];
    caminosDestino = {};
    modoRuta = false;
    rutasAlternativas = [];
    destinoRuta = null;
    dibujarTablero();
    actualizarTurno();
    btnDeshacer.disabled = !historial.puedeDeshacer();
}

function dibujarTablero() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let x = j * CELL_SIZE, y = i * CELL_SIZE;
            if (esNoJugable(i, j)) {
                ctx.fillStyle = '#111111';
                ctx.fillRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
                ctx.strokeStyle = '#333333';
                ctx.strokeRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
                continue;
            }
            let zona = getZona(i, j);
            let par = (i + j) % 2 === 0;
            let color = zona === 'vacio' ? colores.vacio.par : (par ? colores[zona].par : colores[zona].impar);
            ctx.fillStyle = color;
            ctx.fillRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
            ctx.strokeStyle = '#a57c4c';
            ctx.strokeRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
        }
    }

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = board[i][j];
            if (pieza) {
                let x = j * CELL_SIZE, y = i * CELL_SIZE;
                let cx = x + CELL_SIZE/2, cy = y + CELL_SIZE/2;
                let radio = CELL_SIZE * 0.4;
                let esTurno = pieza.jugador === turno;
                ctx.globalAlpha = esTurno ? 1.0 : 0.4;
                ctx.strokeStyle = colorBordeEquipo[pieza.jugador];
                ctx.lineWidth = 2.5;
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(cx, cy, radio, 0, 2*Math.PI);
                ctx.fill();
                ctx.stroke();
                let img = imagenesPiezas[pieza.tipo];
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, radio-2, 0, 2*Math.PI);
                    ctx.clip();
                    ctx.drawImage(img, cx - radio + 2, cy - radio + 2, (radio-2)*2, (radio-2)*2);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#000000';
                    ctx.font = `bold ${CELL_SIZE*0.3}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(pieza.tipo, cx, cy);
                }
                if (selectedPiece && selectedPiece.fila === i && selectedPiece.col === j) {
                    ctx.strokeStyle = '#FFDD44';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(cx, cy, radio, 0, 2*Math.PI);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1.0;
            }
        }
    }

    // Dibujar destinos (amarillo) solo si no estamos en modo ruta
    if (!modoRuta) {
        for (let [f, c] of posiblesMovimientos) {
            ctx.fillStyle = '#FFFF00AA';
            ctx.fillRect(c * CELL_SIZE, f * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
    }

    // Dibujar rutas alternativas (modo elección)
    if (modoRuta && rutasAlternativas.length > 0) {
        const coloresRuta = ['#AA00AA', '#FF69B4']; // morado, rosa
        for (let idx = 0; idx < rutasAlternativas.length; idx++) {
            let ruta = rutasAlternativas[idx];
            let [fInter, cInter] = ruta.inter;
            ctx.fillStyle = coloresRuta[idx % coloresRuta.length];
            ctx.fillRect(cInter * CELL_SIZE, fInter * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
        let [df, dc] = destinoRuta;
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 3;
        ctx.strokeRect(dc * CELL_SIZE, df * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
    }
}

function actualizarTurno() {
    turnoTexto.innerText = `Turno: Jugador ${turno + 1}`;
}

function aplicarMovimiento(origen, destino, caminoElegido = null) {
    let clave = `${destino[0]},${destino[1]}`;
    let camino;
    if (caminoElegido) {
        camino = caminoElegido;
    } else {
        let caminos = caminosDestino[clave];
        if (!caminos) return false;
        if (Array.isArray(caminos)) {
            if (caminos.length > 1) return false; // necesita elección
            camino = caminos[0].pasos || caminos[0];
        } else {
            camino = caminos;
        }
    }

    guardarEstado();

    let pieza = board[origen[0]][origen[1]];
    let jugador = pieza.jugador;
    let f = origen[0], c = origen[1];

    for (let paso of camino) {
        if (paso.tipo === 'move') {
            let [nf, nc] = paso.to;
            board[f][c] = null;
            board[nf][nc] = pieza;
            f = nf; c = nc;
        } else if (paso.tipo === 'removePiece') {
            let [of, oc] = paso.over;
            let piezaAEliminar = board[of]?.[oc];
            if (piezaAEliminar && piezaAEliminar.jugador !== jugador) {
                if (piezaAEliminar.tipo !== 'F4' || pieza.tipo === 'F3' || pieza.tipo === 'F6') {
                    carcela.agregar(piezaAEliminar);
                    board[of][oc] = null;
                }
            }
        } else if (paso.tipo === 'captureDirect') {
            let [of, oc] = paso.over;
            let [nf, nc] = paso.to;
            let piezaObjetivo = board[of]?.[oc];
            if (piezaObjetivo && piezaObjetivo.jugador !== jugador) {
                if (piezaObjetivo.tipo !== 'F4' || pieza.tipo === 'F3' || pieza.tipo === 'F6') {
                    carcela.agregar(piezaObjetivo);
                    board[of][oc] = null;
                }
            }
            board[f][c] = null;
            board[nf][nc] = pieza;
            f = nf; c = nc;
        } else if (paso.tipo === 'jump') {
            let [of, oc] = paso.over;
            let [nf, nc] = paso.to;
            let piezaSaltada = board[of]?.[oc];
            if (piezaSaltada && piezaSaltada.jugador !== jugador) {
                if (piezaSaltada.tipo === 'F4' && pieza.tipo !== 'F3' && pieza.tipo !== 'F6') {
                    // no se captura
                } else {
                    carcela.agregar(piezaSaltada);
                    board[of][oc] = null;
                }
            }
            board[f][c] = null;
            board[nf][nc] = pieza;
            f = nf; c = nc;
        }
    }
    return true;
}

function iniciarJuego() {
    board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
    for (let f = 1; f <= 8; f++) board[f][2] = new F1(0);
    board[2][1] = new F5(0);
    board[3][1] = new F2(0);
    board[4][1] = new F0(0);
    board[5][1] = new F0(0);
    board[6][1] = new F2(0);
    board[7][1] = new F5(0);
    board[3][0] = new F4(0);
    board[4][0] = new F6(0);
    board[5][0] = new F3(0);
    board[6][0] = new F4(0);
    for (let f = 1; f <= 8; f++) board[f][10] = new F1(1);
    board[2][11] = new F5(1);
    board[3][11] = new F2(1);
    board[4][11] = new F0(1);
    board[5][11] = new F0(1);
    board[6][11] = new F2(1);
    board[7][11] = new F5(1);
    board[3][12] = new F4(1);
    board[4][12] = new F6(1);
    board[5][12] = new F3(1);
    board[6][12] = new F4(1);
    turno = 0;
    selectedPiece = null;
    posiblesMovimientos = [];
    caminosDestino = {};
    modoRuta = false;
    rutasAlternativas = [];
    destinoRuta = null;
    historial.limpiar();
    carcela.limpiar();
    btnDeshacer.disabled = true;
    precargarImagenes();
    dibujarTablero();
    actualizarTurno();
}

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const col = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const fila = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);
    if (fila < 0 || fila >= FILAS || col < 0 || col >= COLUMNAS) return;

    // Si estamos en modo elección de ruta
    if (modoRuta) {
        for (let ruta of rutasAlternativas) {
            let [if_, ic] = ruta.inter;
            if (if_ === fila && ic === col) {
                let caminoElegido = ruta.pasos;
                if (aplicarMovimiento([selectedPiece.fila, selectedPiece.col], destinoRuta, caminoElegido)) {
                    turno = 1 - turno;
                    actualizarTurno();
                }
                modoRuta = false;
                rutasAlternativas = [];
                selectedPiece = null;
                posiblesMovimientos = [];
                caminosDestino = {};
                dibujarTablero();
                return;
            }
        }
        // Clic fuera de las opciones: cancelamos
        modoRuta = false;
        rutasAlternativas = [];
        selectedPiece = null;
        posiblesMovimientos = [];
        caminosDestino = {};
        dibujarTablero();
        return;
    }

    // Selección normal de pieza / destino
    if (!selectedPiece) {
        let ficha = board[fila][col];
        if (ficha && ficha.jugador === turno) {
            selectedPiece = { fila, col };
            let res = ficha.obtenerMovimientos(fila, col, board);
            posiblesMovimientos = res.destinos;
            caminosDestino = res.caminos;
            dibujarTablero();
        }
    } else {
        let clave = `${fila},${col}`;
        let esValido = posiblesMovimientos.some(([f, c]) => f === fila && c === col);
        if (esValido) {
            let caminos = caminosDestino[clave];
            // Si hay varios caminos, entramos en modo elección
            if (Array.isArray(caminos) && caminos.length > 1) {
                rutasAlternativas = caminos;
                destinoRuta = [fila, col];
                modoRuta = true;
                dibujarTablero();
                return;
            }
            // Un solo camino
            if (aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col])) {
                turno = 1 - turno;
                actualizarTurno();
            }
        }
        selectedPiece = null;
        posiblesMovimientos = [];
        caminosDestino = {};
        modoRuta = false;
        dibujarTablero();
    }
});

btnDeshacer.addEventListener('click', deshacerMovimiento);

iniciarJuego();
