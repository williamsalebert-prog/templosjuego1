const canvas = document.getElementById('tableroCanvas');
const ctx = canvas.getContext('2d');
const btnDeshacer = document.getElementById('btnDeshacer');
const turnoTexto = document.getElementById('turnoTexto');

let board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
let turno = 0;
let selectedPiece = null;
let posiblesMovimientos = [];
let caminosDestino = {};

function copiarBoard() {
    return board.map(fila => fila.map(celda => {
        if (celda instanceof F1) return new F1(celda.jugador);
        return null;
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
            let x = j*CELL_SIZE, y = i*CELL_SIZE;
            let zona = getZona(i, j);
            let par = (i+j)%2===0;
            let color = zona==='vacio' ? colores.vacio.par : (par ? colores[zona].par : colores[zona].impar);
            ctx.fillStyle = color;
            ctx.fillRect(x, y, CELL_SIZE-1, CELL_SIZE-1);
            ctx.strokeStyle = '#a57c4c';
            ctx.strokeRect(x, y, CELL_SIZE-1, CELL_SIZE-1);
        }
    }
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = board[i][j];
            if (pieza) {
                let x = j*CELL_SIZE, y = i*CELL_SIZE;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(x+4, y+4, CELL_SIZE-8, CELL_SIZE-8);
                ctx.fillStyle = '#000000';
                ctx.font = `bold ${CELL_SIZE*0.3}px monospace`;
                ctx.fillText(pieza.tipo, x+CELL_SIZE*0.35, y+CELL_SIZE*0.65);
                if (selectedPiece && selectedPiece.fila===i && selectedPiece.col===j) {
                    ctx.strokeStyle = '#FFDD44';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(x+2, y+2, CELL_SIZE-5, CELL_SIZE-5);
                }
            }
        }
    }
    for (let [f, c] of posiblesMovimientos) {
        ctx.fillStyle = '#FFFF00AA';
        ctx.fillRect(c*CELL_SIZE, f*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
    }
}

function actualizarTurno() {
    turnoTexto.innerText = `Turno: Jugador ${turno+1}`;
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
            let piezaSaltada = board[of][oc];
            if (piezaSaltada && piezaSaltada.jugador !== jugador) {
                carcela.agregar(piezaSaltada);
                board[of][oc] = null;
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
    board[7][3] = new F1(0);
    board[6][2] = new F1(0);
    board[8][2] = new F1(0);
    board[7][19] = new F1(1);
    board[6][20] = new F1(1);
    board[8][20] = new F1(1);
    turno = 0;
    selectedPiece = null;
    posiblesMovimientos = [];
    caminosDestino = {};
    historial.limpiar();
    carcela.limpiar();
    btnDeshacer.disabled = true;
    dibujarTablero();
    actualizarTurno();
}

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const col = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const fila = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);
    if (fila<0 || fila>=FILAS || col<0 || col>=COLUMNAS) return;

    if (!selectedPiece) {
        let ficha = board[fila][col];
        if (ficha && ficha.jugador===turno && ficha.tipo==='F1') {
            selectedPiece = { fila, col };
            let res = ficha.obtenerMovimientos(fila, col, board);
            posiblesMovimientos = res.destinos;
            caminosDestino = res.caminos;
            dibujarTablero();
        }
    } else {
        let esValido = posiblesMovimientos.some(([f,c]) => f===fila && c===col);
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
