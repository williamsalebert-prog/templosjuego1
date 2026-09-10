console.log("✅ tablero.js cargado");
const canvas = document.getElementById('tableroCanvas');
const ctx = canvas.getContext('2d');
const ANCHO_LOGICO = COLUMNAS * CELL_SIZE;
const ALTO_LOGICO = FILAS * CELL_SIZE;
const PIXEL_RATIO = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
canvas.width = Math.round(ANCHO_LOGICO * PIXEL_RATIO);
canvas.height = Math.round(ALTO_LOGICO * PIXEL_RATIO);
ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);
canvas.dataset.pixelRatio = String(PIXEL_RATIO);

// Feedback visual de interacción. No forma parte del estado de reglas.
let ultimaJugadaVisual = null;
let casillaHover = null;

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
    // En vertical rotamos para aprovechar la pantalla. Si el teléfono YA está
    // horizontal, mantener 90° desperdicia el formato natural 15x10.
    const vertical = window.innerHeight >= window.innerWidth;
    let base = vertical ? 90 : 0;
    // El invitado azul ve su lado orientado hacia sí tanto en vertical como en
    // horizontal; en vertical esto convierte 90° en 270°.
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
        // En 270° el eje X interno depende del ALTO visual (que corresponde
        // al ancho sin rotar). Usar anchoVisual aquí desplazaba los toques.
        return { x: altoVisual - yRel, y: xRel };
    }
    if (grados === 180) {
        return { x: anchoVisual - xRel, y: altoVisual - yRel };
    }
    return { x: xRel, y: yRel };
}

function copiarBoard() {
    return board.map(fila => fila.map(celda => {
        if (celda === null) return null;
        return clonarPieza(celda);
    }));
}

function capturarEstadoHistorial() {
    return {
        board: copiarBoard(),
        turno,
        enroqueRealizado: [...enroqueRealizado],
        carcela: carcela.obtenerTodas().map(p => ({ tipo: p.tipo, jugador: p.jugador })),
        contadorJugadas,
        jugadasPorJugador: [...jugadasPorJugador],
        tiempoRestante: (typeof tiempoRestante !== 'undefined') ? [...tiempoRestante] : null,
        cronometro: (typeof cronometro !== 'undefined') ? [...cronometro] : null,
        avisoBajoTiempoDado: (typeof avisoBajoTiempoDado !== 'undefined') ? [...avisoBajoTiempoDado] : null,
        bonoJugadaAplicado: (typeof bonoJugadaAplicado !== 'undefined') ? [...bonoJugadaAplicado] : null
    };
}

function restaurarEstadoHistorial(estado) {
    if (!estado) return false;
    board = estado.board;
    turno = estado.turno;
    enroqueRealizado = estado.enroqueRealizado || [false, false];

    carcela.limpiar();
    for (const dato of (estado.carcela || [])) {
        const Clase = piezasRegistradas.get(dato.tipo);
        if (Clase) carcela.agregar(new Clase(dato.jugador));
    }
    if (typeof estado.contadorJugadas === 'number') contadorJugadas = estado.contadorJugadas;
    if (Array.isArray(estado.jugadasPorJugador)) jugadasPorJugador = [...estado.jugadasPorJugador];
    if (Array.isArray(estado.tiempoRestante) && typeof tiempoRestante !== 'undefined') tiempoRestante = [...estado.tiempoRestante];
    if (Array.isArray(estado.cronometro) && typeof cronometro !== 'undefined') cronometro = [...estado.cronometro];
    if (Array.isArray(estado.avisoBajoTiempoDado) && typeof avisoBajoTiempoDado !== 'undefined') avisoBajoTiempoDado = [...estado.avisoBajoTiempoDado];
    if (Array.isArray(estado.bonoJugadaAplicado) && typeof bonoJugadaAplicado !== 'undefined') bonoJugadaAplicado = [...estado.bonoJugadaAplicado];

    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = []; destinoRuta = null;
    ultimaJugadaVisual = null; casillaHover = null;
    coronacionPendiente = null;
    if (typeof menuCoronacion !== 'undefined' && menuCoronacion) menuCoronacion.style.display = 'none';
    if (typeof pintarRelojes === 'function') pintarRelojes();
    return true;
}

function guardarEstado() {
    historial.guardar(capturarEstadoHistorial());
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
    ultimaJugadaVisual = { origen: [...origen], destino: [...destino], tipo: 'mover' };
    guardarEstado();
    if (!remoto && typeof transmitirMovimientoSiOnline === 'function') {
        transmitirMovimientoSiOnline({ tipo: 'mover', origen, destino, camino });
    }
    iniciarAnimacion(origen, camino);
    return true;
}

function intentarRecuperarPartidaLocalDesdeCache() {
    if (CONFIG_JUEGO.online || CONFIG_JUEGO.modoPrueba) return false;
    const id = parametrosURL.get('resume');
    if (!id || typeof buscarPartidaEnCachePorId !== 'function') return false;
    const guardada = buscarPartidaEnCachePorId(id);
    if (!guardada || guardada.online || !guardada.estado || guardada.estado.juegoTerminado) return false;
    // Evita abrir accidentalmente una partida de otro modo con una URL manipulada.
    if (Number(guardada.modo) !== Number(CONFIG_JUEGO.modo)) return false;
    if (CONFIG_JUEGO.modo === 1 && Number.isFinite(Number(guardada.dificultad))) {
        CONFIG_JUEGO.dificultad = Number(guardada.dificultad);
    }
    const aplicado = (typeof aplicarEstadoRecibido === 'function')
        ? aplicarEstadoRecibido(guardada.estado, true)
        : false;
    if (!aplicado) return false;
    window._idPartidaActualCache = guardada.id;
    if (typeof mostrarToastJuego === 'function') mostrarToastJuego('Partida recuperada. El reloj continuará tras la cuenta atrás.', 'ok');
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
    ultimaJugadaVisual = null; casillaHover = null;
    enroqueRealizado = [false, false]; coronacionPendiente = null;
    contadorJugadas = 0; jugadasPorJugador = [0, 0];
    menuCoronacion.style.display = 'none';
    historial.limpiar(); carcela.limpiar();
    if (typeof reiniciarFinJuego === 'function') reiniciarFinJuego();

    if (typeof actualizarInterfaz === 'function') actualizarInterfaz();
    if (typeof iniciarRelojes === 'function') iniciarRelojes();
    const partidaRecuperadaLocal = intentarRecuperarPartidaLocalDesdeCache();
    if (!partidaRecuperadaLocal) dibujarTablero();

    // Countdown de inicio (3s bloqueado, luego arranca cronómetros)
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
                if (typeof programarTurnoIASiCorresponde === 'function') programarTurnoIASiCorresponde();
            });
        } else {
            window.tableroHabilitado = true;
            if (typeof arrancarRelojes === 'function') arrancarRelojes();
            if (typeof programarTurnoIASiCorresponde === 'function') programarTurnoIASiCorresponde();
        }
    }
    // Para online: el countdown se lanza desde sync.js cuando los dos están conectados.
}



function prepararSelectoresRutas(rutas, destino) {
    if (!Array.isArray(rutas)) return [];
    const destinoClave = Array.isArray(destino) ? `${destino[0]},${destino[1]}` : null;
    const puntosPorRuta = rutas.map(ruta => {
        const vistos = new Set();
        const puntos = [];
        for (const paso of (ruta.pasos || [])) {
            for (const punto of [paso.over, paso.to]) {
                if (!Array.isArray(punto)) continue;
                const clave = `${punto[0]},${punto[1]}`;
                if (clave === destinoClave || vistos.has(clave)) continue;
                vistos.add(clave);
                puntos.push([punto[0], punto[1]]);
            }
        }
        return puntos;
    });

    return rutas.map((ruta, idx) => {
        let selector = null;
        for (const punto of puntosPorRuta[idx]) {
            const clave = `${punto[0]},${punto[1]}`;
            let apareceEnOtra = false;
            for (let j = 0; j < puntosPorRuta.length; j++) {
                if (j === idx) continue;
                if (puntosPorRuta[j].some(p => `${p[0]},${p[1]}` === clave)) {
                    apareceEnOtra = true;
                    break;
                }
            }
            if (!apareceEnOtra) { selector = punto; break; }
        }
        if (!selector && Array.isArray(ruta.inter)) selector = ruta.inter;
        if (!selector && puntosPorRuta[idx].length) selector = puntosPorRuta[idx][0];
        return { ...ruta, inter: selector, indiceRuta: idx + 1 };
    });
}

function obtenerCasillaDesdeCliente(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const xRel = clientX - rect.left;
    const yRel = clientY - rect.top;
    if (xRel < 0 || yRel < 0 || xRel > rect.width || yRel > rect.height) return null;
    const punto = traducirCoordenadaRotada(xRel, yRel, rect.width, rect.height);
    const rotado = parseInt(canvas.dataset.rotacion || '0', 10) % 180 === 90;
    const anchoSinRotar = rotado ? rect.height : rect.width;
    const altoSinRotar = rotado ? rect.width : rect.height;
    const scaleX = ANCHO_LOGICO / anchoSinRotar;
    const scaleY = ALTO_LOGICO / altoSinRotar;
    const col = Math.floor((punto.x * scaleX) / CELL_SIZE);
    const fila = Math.floor((punto.y * scaleY) / CELL_SIZE);
    if (fila < 0 || fila >= FILAS || col < 0 || col >= COLUMNAS) return null;
    return { fila, col };
}

function manejarClicTablero(clientX, clientY) {
    // Bloquear si el countdown no ha terminado
    if (!window.tableroHabilitado) return;
    if (window.partidaPausadaPorPropuesta) return;
    if (coronacionPendiente || animando || juegoTerminado) return;
    if (CONFIG_JUEGO.online && turno !== CONFIG_JUEGO.onlineSoyJugador) return;
    if (CONFIG_JUEGO.modo === 1 && turno === 1) return; // turno de la IA: el humano no puede mover
    const casilla = obtenerCasillaDesdeCliente(clientX, clientY);
    if (!casilla) return;
    const { fila, col } = casilla;

    if (modoRuta) {
        const candidatas = rutasAlternativas.filter(ruta =>
            Array.isArray(ruta.inter) && ruta.inter[0] === fila && ruta.inter[1] === col
        );
        if (candidatas.length === 1) {
            aplicarMovimiento([selectedPiece.fila, selectedPiece.col], destinoRuta, candidatas[0].pasos);
            return;
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
        const jugadorEnroque = turno;
        ultimaJugadaVisual = { origen: [selectedPiece.fila, selectedPiece.col], destino: [fila, col], tipo: 'enroque' };
        // El hash de sincronización debe describir el tablero ANTES de mover el
        // rey. ejecutarEnroque modifica el board inmediatamente.
        const hashAntesEnroque = (CONFIG_JUEGO.online && typeof hashEstadoLogico === 'function') ? hashEstadoLogico() : null;
        const enroqueAplicado = ejecutarEnroque(selectedPiece.fila, selectedPiece.col, fila, col, turno);
        if (!enroqueAplicado) { seleccionarNuevaPieza(selectedPiece.fila, selectedPiece.col); return; }
        if (typeof transmitirMovimientoSiOnline === 'function') {
            transmitirMovimientoSiOnline({ tipo: 'enroque', reyFila: selectedPiece.fila, reyCol: selectedPiece.col, piezaFila: fila, piezaCol: col, jugador: turno }, hashAntesEnroque);
        }
        if (typeof generarNotacionEnroque === 'function') {
            let notacion = generarNotacionEnroque();
            notacion = agregarSufijoJaque(notacion, board, 1 - jugadorEnroque);
            registrarNotacion(notacion);
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
                    rutasAlternativas = prepararSelectoresRutas(info, [fila, col]);
                    destinoRuta = [fila, col]; modoRuta = true;
                    if (typeof actualizarHUDContexto === 'function') actualizarHUDContexto();
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

canvas.addEventListener('mousemove', (e) => {
    if (esPantallaMovil() || animando) return;
    const cas = obtenerCasillaDesdeCliente(e.clientX, e.clientY);
    const nueva = cas ? `${cas.fila},${cas.col}` : null;
    const previa = casillaHover ? `${casillaHover.fila},${casillaHover.col}` : null;
    if (nueva === previa) return;
    casillaHover = cas;
    if (cas) {
        const p = board[cas.fila][cas.col];
        const esDestino = posiblesMovimientos.some(m => Array.isArray(m) ? (m[0]===cas.fila && m[1]===cas.col) : (m.f===cas.fila && m.c===cas.col));
        canvas.style.cursor = (esDestino || (p && p.jugador === turno)) ? 'pointer' : 'default';
    } else canvas.style.cursor = 'default';
    dibujarTablero();
});
canvas.addEventListener('mouseleave', () => {
    if (casillaHover) { casillaHover = null; canvas.style.cursor = 'default'; dibujarTablero(); }
});

function seleccionarNuevaPieza(fila, col) {
    let ficha = board[fila][col];
    if (ficha && ficha.jugador === turno) {
        selectedPiece = { fila, col };
        let res = ficha.obtenerMovimientos(fila, col, board);
        posiblesMovimientos = res.destinos;
        caminosDestino = res.caminos;
        piezasAmenazadas = res.piezasAmenazadas || [];

        if (ficha.tipo === 'F6' && typeof obtenerEnroquesLegales === 'function') {
            posiblesMovimientos.push(...obtenerEnroquesLegales(
                selectedPiece.fila, selectedPiece.col, turno, board, enroqueRealizado
            ));
        }

        let filtrado = filtrarMovimientosJaque(selectedPiece, posiblesMovimientos, caminosDestino);
        posiblesMovimientos = filtrado.posiblesMovimientos;
        caminosDestino = filtrado.caminosDestino;
        if (typeof actualizarHUDContexto === 'function') actualizarHUDContexto();
        dibujarTablero();
    } else {
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        modoRuta = false;
        if (typeof actualizarHUDContexto === 'function') actualizarHUDContexto();
        dibujarTablero();
    }
}

document.addEventListener('keydown', (e) => {
    if (!CONFIG_JUEGO.modoPrueba) return; // Deshacer/rehacer solo disponibles en Modo Prueba
    const modificador = e.ctrlKey || e.metaKey;
    const tecla = String(e.key || '').toLowerCase();
    const quiereDeshacer = modificador && tecla === 'z' && !e.shiftKey;
    const quiereRehacer = modificador && (tecla === 'y' || (tecla === 'z' && e.shiftKey));
    if (quiereDeshacer) {
        e.preventDefault();
        if (animando || coronacionPendiente) return;
        if (!historial.puedeDeshacer()) return;
        let estadoActual = capturarEstadoHistorial();
        let estado = historial.deshacer(estadoActual);
        if (typeof notacionDeshacer === 'function') notacionDeshacer();
        restaurarEstadoHistorial(estado);
        if (typeof reiniciarFinJuego === 'function') reiniciarFinJuego();
        if (typeof actualizarInterfaz === 'function') actualizarInterfaz();
        if (typeof actualizarPanelAnalisis === 'function') actualizarPanelAnalisis();
        dibujarTablero();
    } else if (quiereRehacer) {
        e.preventDefault();
        if (animando || coronacionPendiente) return;
        if (!historial.puedeRehacer()) return;
        let estadoActual = capturarEstadoHistorial();
        let estado = historial.rehacer(estadoActual);
        if (typeof notacionRehacer === 'function') notacionRehacer();
        restaurarEstadoHistorial(estado);
        if (typeof reiniciarFinJuego === 'function') reiniciarFinJuego();
        const analisisRehecho = analizarEstadoTurno(turno, board);
        if (typeof fijarCacheJaqueVisual === 'function') fijarCacheJaqueVisual(analisisRehecho, turno);
        if (analisisRehecho.jaqueMate) { juegoTerminado = true; mostrarFinJuego('jaquemate', turno); }
        else if (analisisRehecho.ahogado) { juegoTerminado = true; mostrarFinJuego('tablas', turno); }
        if (typeof actualizarInterfaz === 'function') actualizarInterfaz(analisisRehecho);
        if (typeof actualizarPanelAnalisis === 'function') actualizarPanelAnalisis();
        dibujarTablero();
    }
});

iniciarJuego();
