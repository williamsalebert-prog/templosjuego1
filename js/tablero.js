console.log("✅ tablero.js cargado");
const canvas = document.getElementById('tableroCanvas');
const ctx = canvas.getContext('2d');
canvas.width = COLUMNAS * CELL_SIZE;
canvas.height = FILAS * CELL_SIZE;

function copiarBoard() {
    return board.map(fila => fila.map(celda => {
        if (celda === null) return null;
        const ClasePieza = piezasRegistradas.get(celda.tipo);
        return ClasePieza ? new ClasePieza(celda.jugador) : null;
    }));
}

function guardarEstado() {
    historial.guardar({ board: copiarBoard(), turno, enroqueRealizado: [...enroqueRealizado] });
}

function aplicarMovimiento(origen, destino, caminoElegido = null) {
    let clave = `${destino[0]},${destino[1]}`;
    let camino;
    if (caminoElegido) camino = caminoElegido;
    else {
        let info = caminosDestino[clave];
        if (!info) return false;
        if (Array.isArray(info)) {
            if (info.length > 0 && info[0].hasOwnProperty('pasos')) camino = info[0].pasos;
            else camino = info;
        } else camino = info;
    }
    if (!Array.isArray(camino)) return false;
    guardarEstado();
    iniciarAnimacion(origen, camino);
    return true;
}

function iniciarJuego() {
    board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
    for (let f = 1; f <= 8; f++) board[f][3] = new F1(0);
    board[2][2] = new F5(0); board[3][2] = new F2(0); board[4][2] = new F0(0);
    board[5][2] = new F0(0); board[6][2] = new F2(0); board[7][2] = new F5(0);
    board[3][1] = new F4(0); board[4][1] = new F6(0); board[5][1] = new F3(0); board[6][1] = new F4(0);
    for (let f = 1; f <= 8; f++) board[f][11] = new F1(1);
    board[2][12] = new F5(1); board[3][12] = new F2(1); board[4][12] = new F0(1);
    board[5][12] = new F0(1); board[6][12] = new F2(1); board[7][12] = new F5(1);
    board[3][13] = new F4(1); board[4][13] = new F6(1); board[5][13] = new F3(1); board[6][13] = new F4(1);

    turno = 0; selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = []; destinoRuta = null;
    enroqueRealizado = [false, false]; coronacionPendiente = null;
    contadorJugadas = 0;
    menuCoronacion.style.display = 'none';
    historial.limpiar(); carcela.limpiar();
    if (typeof reiniciarFinJuego === 'function') reiniciarFinJuego();
    precargarImagenes();
    if (typeof actualizarInterfaz === 'function') actualizarInterfaz();
    if (typeof iniciarRelojes === 'function') iniciarRelojes();
    dibujarTablero();
}

canvas.addEventListener('click', (e) => {
    if (coronacionPendiente || animando || juegoTerminado) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const col = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const fila = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);
    if (fila < 0 || fila >= FILAS || col < 0 || col >= COLUMNAS) return;

    if (modoRuta) {
        // ✅ Primero comprobamos si el clic corresponde a una de las rutas alternativas
        // resaltadas en azul (aunque esa casilla intermedia tenga una ficha amiga encima,
        // sigue siendo una ruta válida y debe poder elegirse). Antes esto se comprobaba
        // DESPUÉS de mirar si había una ficha propia, así que un clic sobre una ruta con
        // ficha amiga en medio deseleccionaba todo en vez de ejecutar el movimiento.
        for (let ruta of rutasAlternativas) {
            let [if_, ic] = ruta.inter;
            if (if_ === fila && ic === col) {
                let caminoElegido = ruta.pasos;
                aplicarMovimiento([selectedPiece.fila, selectedPiece.col], destinoRuta, caminoElegido);
                return;
            }
        }
        let fichaClicRuta = board[fila][col];
        if (fichaClicRuta && fichaClicRuta.jugador === turno) {
            modoRuta = false; rutasAlternativas = [];
            seleccionarNuevaPieza(fila, col);
            return;
        }
        modoRuta = false; rutasAlternativas = []; selectedPiece = null;
        posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        dibujarTablero(); return;
    }

    if (!selectedPiece) {
        seleccionarNuevaPieza(fila, col);
        return;
    }

    let movEnroque = posiblesMovimientos.find(m => m.tipoMov === 'enroque' && m.f === fila && m.c === col);
    if (movEnroque) {
        ejecutarEnroque(selectedPiece.fila, selectedPiece.col, fila, col, turno);
        turno = 1 - turno;
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        dibujarTablero();
        if (typeof despuesDeJugada === 'function') despuesDeJugada();
        return;
    }

    let clave = `${fila},${col}`;
    let esValido = posiblesMovimientos.some(mov => {
        if (Array.isArray(mov)) return mov[0] === fila && mov[1] === col;
        return false;
    });
    if (esValido) {
        let info = caminosDestino[clave];
        if (Array.isArray(info) && info.length > 0 && info[0].hasOwnProperty('pasos')) {
            if (info.length > 1) {
                let algunaConEnemigo = info.some(ruta => ruta.tieneEnemigo);
                if (algunaConEnemigo) {
                    rutasAlternativas = info; destinoRuta = [fila, col]; modoRuta = true;
                    dibujarTablero(); return;
                } else {
                    aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col], info[0].pasos);
                    return;
                }
            } else {
                aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col], info[0].pasos);
                return;
            }
        }
        aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col]);
        return;
    }

    seleccionarNuevaPieza(fila, col);
});

function seleccionarNuevaPieza(fila, col) {
    let ficha = board[fila][col];
    if (ficha && ficha.jugador === turno) {
        selectedPiece = { fila, col };
        let res = ficha.obtenerMovimientos(fila, col, board);
        posiblesMovimientos = res.destinos;
        caminosDestino = res.caminos;
        piezasAmenazadas = res.piezasAmenazadas || [];

        if (ficha.tipo === 'F6' && !enroqueRealizado[turno]) {
            for (let i = 0; i < FILAS; i++)
                for (let j = 0; j < COLUMNAS; j++) {
                    let piezaObj = board[i][j];
                    if (!piezaObj || piezaObj.jugador !== turno) continue;
                    if (!['F0','F3','F5'].includes(piezaObj.tipo)) continue;
                    if (validarEnroque(selectedPiece.fila, selectedPiece.col, i, j, turno))
                        posiblesMovimientos.push({ f: i, c: j, tipoMov: 'enroque' });
                }
        }

        // ✅ Aplicar filtro de jaque (ahora en jaque.js)
        let filtrado = filtrarMovimientosJaque(selectedPiece, posiblesMovimientos, caminosDestino);
        posiblesMovimientos = filtrado.posiblesMovimientos;
        caminosDestino = filtrado.caminosDestino;

        dibujarTablero();
    } else {
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        modoRuta = false; dibujarTablero();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (animando || coronacionPendiente) return;
        if (!historial.puedeDeshacer()) return;
        let estadoActual = { board: copiarBoard(), turno, enroqueRealizado: [...enroqueRealizado] };
        let estado = historial.deshacer(estadoActual);
        board = estado.board; turno = estado.turno;
        enroqueRealizado = estado.enroqueRealizado || [false, false];
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        modoRuta = false; rutasAlternativas = []; destinoRuta = null;
        coronacionPendiente = null; menuCoronacion.style.display = 'none';
        if (typeof reiniciarFinJuego === 'function') reiniciarFinJuego();
        if (typeof actualizarInterfaz === 'function') actualizarInterfaz();
        dibujarTablero();
    } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        if (animando || coronacionPendiente) return;
        if (!historial.puedeRehacer()) return;
        let estadoActual = { board: copiarBoard(), turno, enroqueRealizado: [...enroqueRealizado] };
        let estado = historial.rehacer(estadoActual);
        board = estado.board; turno = estado.turno;
        enroqueRealizado = estado.enroqueRealizado || [false, false];
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        modoRuta = false; rutasAlternativas = []; destinoRuta = null;
        coronacionPendiente = null; menuCoronacion.style.display = 'none';
        if (typeof reiniciarFinJuego === 'function') reiniciarFinJuego();
        if (esJaqueMate(turno)) { juegoTerminado = true; mostrarFinJuego('jaquemate', turno); }
        else if (esAhogado(turno)) { juegoTerminado = true; mostrarFinJuego('tablas', turno); }
        if (typeof actualizarInterfaz === 'function') actualizarInterfaz();
        dibujarTablero();
    }
});

// --- Botón de volver al menú principal, con confirmación ---
function configurarBotonVolver() {
    const btn = document.getElementById('btnVolverMenu');
    const modal = document.getElementById('modalConfirmarSalida');
    const btnSi = document.getElementById('btnConfirmarSalida');
    const btnNo = document.getElementById('btnCancelarSalida');
    if (!btn || !modal) return;
    btn.addEventListener('click', () => { modal.style.display = 'flex'; });
    if (btnNo) btnNo.addEventListener('click', () => { modal.style.display = 'none'; });
    if (btnSi) btnSi.addEventListener('click', () => { window.location.href = 'index.html'; });
}
configurarBotonVolver();

iniciarJuego();
if (typeof programarTurnoIASiCorresponde === 'function') programarTurnoIASiCorresponde();
