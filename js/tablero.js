console.log("✅ tablero.js cargado");
const canvas = document.getElementById('tableroCanvas');
const ctx = canvas.getContext('2d');
canvas.width = COLUMNAS * CELL_SIZE;
canvas.height = FILAS * CELL_SIZE;

// ============================================================================
// TABLERO HORIZONTAL EN MÓVILES
// ============================================================================
// El tablero interno sigue siendo siempre 15 columnas x 10 filas (el dibujo y
// las reglas no cambian en absoluto). En pantallas de móvil, en vez de
// encoger el tablero para que quepa "de pie" en una pantalla angosta, lo
// rotamos visualmente 90° con CSS para que aproveche el ancho de la pantalla
// igual que un juego en modo horizontal.
//
// En modo online, además, el Jugador 2 (azul) ve el tablero con 180° extra de
// rotación (270° en total) para que SUS piezas iniciales queden orientadas
// hacia su lado de la pantalla, igual que el Jugador 1 ve las suyas.
// ============================================================================

function esPantallaMovil() {
    return Math.min(window.innerWidth, window.innerHeight) <= 760;
}

function calcularRotacionGrados() {
    if (!esPantallaMovil()) return 0;
    let base = 90;
    if (CONFIG_JUEGO.online && CONFIG_JUEGO.onlineSoyJugador === 1) base += 180;
    return base % 360;
}

// Ajustar canvas al espacio disponible
function ajustarCanvas() {
    const barra = document.querySelector('.barra-top');
    const barraH = barra ? barra.offsetHeight : 44;
    const dispWtotal = window.innerWidth - 28; // padding del marco
    const dispHtotal = window.innerHeight - barraH - 28;
    const grados = calcularRotacionGrados();
    const rotado = (grados === 90 || grados === 270);

    // Si está rotado, el tablero "intercambia" su ancho/alto disponible: lo
    // que antes era el ancho de pantalla ahora limita la ALTURA del tablero
    // (porque tras rotar 90°, el ancho del tablero ocupa el alto de pantalla).
    const dispW = rotado ? dispHtotal : dispWtotal;
    const dispH = rotado ? dispWtotal : dispHtotal;

    const ratio = COLUMNAS / FILAS;
    let w = Math.min(dispW, dispH * ratio);
    let h = w / ratio;
    if (h > dispH) { h = dispH; w = h * ratio; }

    canvas.style.width = Math.floor(w) + 'px';
    canvas.style.height = Math.floor(h) + 'px';
    canvas.style.transform = grados !== 0 ? `rotate(${grados}deg)` : '';
    canvas.dataset.rotacion = grados;

    // El wrapper reserva el espacio YA rotado (ancho/alto intercambiados),
    // para que el marco de madera centre correctamente el canvas rotado sin
    // recortarlo ni desbordarlo.
    const wrapper = document.getElementById('canvasWrapper');
    if (wrapper) {
        if (rotado) { wrapper.style.width = Math.floor(h) + 'px'; wrapper.style.height = Math.floor(w) + 'px'; }
        else { wrapper.style.width = Math.floor(w) + 'px'; wrapper.style.height = Math.floor(h) + 'px'; }
    }
}
window.addEventListener('resize', ajustarCanvas);
window.addEventListener('orientationchange', () => setTimeout(ajustarCanvas, 200));
ajustarCanvas();

// Traduce una coordenada de clic/touch (en píxeles de pantalla, ya relativa al
// canvas) desde el espacio VISUAL (rotado) al espacio INTERNO del canvas (sin
// rotar), que es el que entienden FILAS/COLUMNAS. Sin esto, tocar el tablero
// rotado tocaría la casilla equivocada.
function traducirCoordenadaRotada(xRel, yRel, anchoVisual, altoVisual) {
    const grados = parseInt(canvas.dataset.rotacion || '0', 10);
    if (grados === 90) {
        // Rotación horaria 90°: lo que en pantalla es (x,y) corresponde,
        // en el espacio interno sin rotar, a (y, anchoVisual - x).
        return { x: yRel, y: anchoVisual - xRel };
    }
    if (grados === 270) {
        return { x: anchoVisual - yRel, y: xRel };
    }
    if (grados === 180) {
        return { x: anchoVisual - xRel, y: altoVisual - yRel };
    }
    return { x: xRel, y: yRel };
}

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

function aplicarMovimiento(origen, destino, caminoElegido = null, remoto = false) {
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
    if (!remoto && typeof transmitirMovimientoSiOnline === 'function') {
        transmitirMovimientoSiOnline({ tipo: 'mover', origen, destino, camino });
    }
    iniciarAnimacion(origen, camino);
    return true;
}

function iniciarJuego() {
    board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
    for (let f = 1; f <= 8; f++) board[f][3] = new F1(0);
    board[2][2] = new F5(0); board[3][2] = new F2(0); board[4][2] = new F0(0);
    board[5][2] = new F0(0); board[6][2] = new F2(0); board[7][2] = new F5(0);
    board[3][1] = new F4(0); board[4][1] = new F3(0); board[5][1] = new F6(0); board[6][1] = new F4(0);
    for (let f = 1; f <= 8; f++) board[f][11] = new F1(1);
    board[2][12] = new F5(1); board[3][12] = new F2(1); board[4][12] = new F0(1);
    board[5][12] = new F0(1); board[6][12] = new F2(1); board[7][12] = new F5(1);
    board[3][13] = new F4(1); board[4][13] = new F6(1); board[5][13] = new F3(1); board[6][13] = new F4(1);

    turno = 0; selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = []; destinoRuta = null;
    enroqueRealizado = [false, false]; coronacionPendiente = null;
    contadorJugadas = 0; jugadasPorJugador = [0, 0];
    menuCoronacion.style.display = 'none';
    historial.limpiar(); carcela.limpiar();
    if (typeof reiniciarFinJuego === 'function') reiniciarFinJuego();
    precargarImagenes();
    if (typeof actualizarInterfaz === 'function') actualizarInterfaz();
    if (typeof iniciarRelojes === 'function') iniciarRelojes();
    dibujarTablero();

    // Countdown de inicio (3s bloqueado + 2s preparación, luego arranca cronómetros)
    if (CONFIG_JUEGO.online) {
        // Modo online: hay que abrir/conectar la sala peer-to-peer. El countdown y los
        // relojes se disparan desde sync.js (lanzarInicioOnline) cuando ambos jugadores
        // estén conectados. Antes esta función nunca se llamaba, así que la partida
        // online jamás llegaba a conectarse (no se podía mover ni avisaba desconexión).
        if (typeof configurarPanelOnline === 'function') configurarPanelOnline();
    } else {
        // Para modo local, arrancar countdown directamente
        if (typeof window.arrancarCountdown === 'function') {
            window.arrancarCountdown(() => {
                if (typeof arrancarRelojes === 'function') arrancarRelojes();
            });
        } else {
            window.tableroHabilitado = true;
            if (typeof arrancarRelojes === 'function') arrancarRelojes();
        }
    }
    // Para online: el countdown se lanza desde sync.js cuando los dos están conectados

    if (typeof programarTurnoIASiCorresponde === 'function') programarTurnoIASiCorresponde();
}

function manejarClicTablero(clientX, clientY) {
    // Bloquear si el countdown no ha terminado
    if (!window.tableroHabilitado) return;
    if (window.partidaPausadaPorPropuesta) return;
    if (coronacionPendiente || animando || juegoTerminado) return;
    if (CONFIG_JUEGO.online && turno !== CONFIG_JUEGO.onlineSoyJugador) return;
    if (CONFIG_JUEGO.modo === 1 && turno === 1) return; // turno de la IA: el humano no puede mover
    const rect = canvas.getBoundingClientRect();
    // rect.width/height ya son las dimensiones VISUALES (tras la rotación CSS,
    // el navegador devuelve el bounding box ya rotado, con ancho/alto
    // intercambiados respecto al canvas "interno" cuando hay 90°/270°).
    const xRel = clientX - rect.left;
    const yRel = clientY - rect.top;
    const punto = traducirCoordenadaRotada(xRel, yRel, rect.width, rect.height);

    // punto.x/punto.y ya están en el espacio SIN ROTAR, con las mismas
    // proporciones que canvas.style.width/height (no rect.width/height).
    const anchoSinRotar = (parseInt(canvas.dataset.rotacion || '0', 10) % 180 === 90) ? rect.height : rect.width;
    const altoSinRotar = (parseInt(canvas.dataset.rotacion || '0', 10) % 180 === 90) ? rect.width : rect.height;
    const scaleX = canvas.width / anchoSinRotar;
    const scaleY = canvas.height / altoSinRotar;
    const col = Math.floor((punto.x * scaleX) / CELL_SIZE);
    const fila = Math.floor((punto.y * scaleY) / CELL_SIZE);
    if (fila < 0 || fila >= FILAS || col < 0 || col >= COLUMNAS) return;

    if (modoRuta) {
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
        if (typeof transmitirMovimientoSiOnline === 'function') {
            transmitirMovimientoSiOnline({ tipo: 'enroque', reyFila: selectedPiece.fila, reyCol: selectedPiece.col, piezaFila: fila, piezaCol: col, jugador: turno });
        }
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
}

canvas.addEventListener('click', (e) => { manejarClicTablero(e.clientX, e.clientY); });

let ultimoToqueProcesado = 0;
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    ultimoToqueProcesado = Date.now();
    manejarClicTablero(touch.clientX, touch.clientY);
}, { passive: false });
canvas.addEventListener('click', (e) => {
    if (Date.now() - ultimoToqueProcesado < 500) e.stopImmediatePropagation();
}, true);

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
    if (!CONFIG_JUEGO.modoPrueba) return; // Ctrl+Z / Ctrl+Y solo disponibles en Modo Prueba
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

iniciarJuego();
