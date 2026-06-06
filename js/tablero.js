console.log("✅ tablero 2.js cargado");
const canvas = document.getElementById('tableroCanvas');
const ctx = canvas.getContext('2d');
const btnDeshacer = document.getElementById('btnDeshacer');
const turnoTexto = document.getElementById('turnoTexto');

let board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
let turno = 0;
let selectedPiece = null;
let posiblesMovimientos = [];
let caminosDestino = {};

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
    dibujarTablero();
    actualizarTurno();
    btnDeshacer.disabled = !historial.puedeDeshacer();
}

function dibujarTablero() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let x = j * CELL_SIZE, y = i * CELL_SIZE;
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

    for (let [f, c] of posiblesMovimientos) {
        ctx.fillStyle = '#FFFF00AA';
        ctx.fillRect(c * CELL_SIZE, f * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
    }
}

function actualizarTurno() {
    turnoTexto.innerText = `Turno: Jugador ${turno + 1}`;
}

function aplicarMovimiento(origen, destino) {
    let clave = `${destino[0]},${destino[1]}`;
    let camino = caminosDestino[clave];
    if (!camino) return false;
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
        } else if (paso.tipo === 'jump') {
            let [of, oc] = paso.over;
            let [nf, nc] = paso.to;
            // Capturar la pieza sobre la que se salta si es enemiga
            let piezaSaltada = board[of][oc];
            if (piezaSaltada && piezaSaltada.jugador !== jugador) {
                // F4 solo puede ser capturada por F6
                if (piezaSaltada.tipo === 'F4' && pieza.tipo !== 'F6') {
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

    // Coronación de F1 al llegar al templo enemigo
    if (pieza.tipo === 'F1') {
        let zona = getZona(f, c);
        if ((jugador === 0 && zona === 'templo2') || (jugador === 1 && zona === 'templo1')) {
            let eleccion = prompt("Elige coronación:\n2 = F2\n5 = F5");
            if (eleccion === '2') {
                board[f][c] = new F2(jugador);
            } else if (eleccion === '5') {
                board[f][c] = new F5(jugador);
            } else {
                // Por defecto F2
                board[f][c] = new F2(jugador);
            }
        }
    }

    return true;
}

function iniciarJuego() {
    board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));

    // Templo izquierdo (jugador 0, rojo) - Pirámide 1,3,5,7 con columnas 0-6
    // Fila 4 (1 celda): col 3
    board[4][3] = new F1(0);
    // Fila 5 (3 celdas): cols 2,3,4
    board[5][2] = new F4(0);
    board[5][3] = new F1(0);
    board[5][4] = new F5(0);
    // Fila 6 (5 celdas): cols 1,2,3,4,5
    board[6][1] = new F5(0);
    board[6][2] = new F2(0);
    board[6][3] = new F1(0);
    board[6][4] = new F2(0);
    board[6][5] = new F1(0);
    // Fila 7 (7 celdas): cols 0,1,2,3,4,5,6
    board[7][0] = new F6(0);
    board[7][1] = new F5(0);
    board[7][2] = new F1(0);
    board[7][3] = new F2(0);
    board[7][4] = new F4(0);
    board[7][5] = new F1(0);
    board[7][6] = new F1(0);

    // Templo derecho (jugador 1, azul) - Espejo: columnas 16-22
    // Fila 4 (1 celda): col 19
    board[4][19] = new F1(1);
    // Fila 5 (3 celdas): cols 18,19,20
    board[5][18] = new F4(1);
    board[5][19] = new F1(1);
    board[5][20] = new F5(1);
    // Fila 6 (5 celdas): cols 17,18,19,20,21
    board[6][17] = new F5(1);
    board[6][18] = new F2(1);
    board[6][19] = new F1(1);
    board[6][20] = new F2(1);
    board[6][21] = new F1(1);
    // Fila 7 (7 celdas): cols 16,17,18,19,20,21,22
    board[7][16] = new F6(1);
    board[7][17] = new F5(1);
    board[7][18] = new F1(1);
    board[7][19] = new F2(1);
    board[7][20] = new F4(1);
    board[7][21] = new F1(1);
    board[7][22] = new F1(1);

    turno = 0;
    selectedPiece = null;
    posiblesMovimientos = [];
    caminosDestino = {};
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
        let esValido = posiblesMovimientos.some(([f, c]) => f === fila && c === col);
        if (esValido) {
            if (aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col])) {
                turno = 1 - turno;
                actualizarTurno();
            }
        }
        selectedPiece = null;
        posiblesMovimientos = [];
        caminosDestino = {};
        dibujarTablero();
    }
});

btnDeshacer.addEventListener('click', deshacerMovimiento);

iniciarJuego();
