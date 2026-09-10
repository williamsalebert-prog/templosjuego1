console.log("✅ finjuego.js cargado");

// Punto único que se llama justo después de que una jugada terminó y el turno
// ya pasó al siguiente jugador. Centraliza: contador de jugadas, detección de
// jaque/jaque mate/ahogado, refresco de interfaz y disparo del turno de la IA.
function despuesDeJugada() {
    // Si una resincronización llegó mientras una animación estaba en curso,
    // el estado autoritativo se aplica ahora y la jugada antigua deja de cerrar
    // sobre él (evita que finalizarAnimacion vuelva a corromper el tablero).
    if (typeof aplicarEstadoRemotoPendienteSiExiste === 'function' && aplicarEstadoRemotoPendienteSiExiste()) return;

    registrarJugadaRealizada();
    comprobarFinJuego();
    if (typeof responderSolicitudEstadoPendienteSiExiste === 'function') responderSolicitudEstadoPendienteSiExiste();
    // NOTA: el movimiento en sí ya se transmitió ANTES de animarlo (ver
    // transmitirMovimientoSiOnline en tablero.js/coronacion.js/enroque.js),
    // para que el rival reproduzca la misma animación y sonido. Aquí solo
    // sincronizamos los relojes, que no viajan dentro de la jugada.
    if (typeof transmitirRelojesSiOnline === 'function') transmitirRelojesSiOnline();
    if (typeof guardarPartidaEnCache === 'function') guardarPartidaEnCache();
    if (typeof actualizarPanelAnalisis === 'function') actualizarPanelAnalisis();
    if (typeof programarTurnoIASiCorresponde === 'function') programarTurnoIASiCorresponde();
}

let juegoTerminado = false;

// Se llama SIEMPRE después de que un movimiento terminó y ya es el turno del
// siguiente jugador (turno ya fue actualizado por animacion.js / coronacion.js / enroque.js).
function comprobarFinJuego() {
    if (juegoTerminado) {
        dibujarTablero();
        return;
    }

    const analisis = (typeof analizarEstadoTurno === 'function')
        ? analizarEstadoTurno(turno, board)
        : { enJaque: esJaque(turno), jaqueMate: esJaqueMate(turno), ahogado: esAhogado(turno), atacantes: [] };

    if (typeof fijarCacheJaqueVisual === 'function') fijarCacheJaqueVisual(analisis, turno);

    if (analisis.jaqueMate) {
        juegoTerminado = true;
        mostrarFinJuego('jaquemate', turno);
    } else if (analisis.ahogado) {
        juegoTerminado = true;
        mostrarFinJuego('tablas', turno);
    } else if (analisis.enJaque) {
        if (typeof sonidoJaque === 'function') sonidoJaque();
    }

    if (typeof actualizarInterfaz === 'function') actualizarInterfaz(analisis);
    dibujarTablero();
}

// --- Estado del panel de fin de partida ---
// El resultado permanece visible hasta que el jugador decida volver al menú.
// No hay contador automático ni límite artificial de exportaciones.
let finJuegoIntervalo = null;
let finJuegoTimeout = null;
let cambioEloFinActual = null;
let eloFinRegistrado = false;

function registrarResultadoEloUnaVez(ganador) {
    if (eloFinRegistrado) return cambioEloFinActual;
    eloFinRegistrado = true;
    cambioEloFinActual = (typeof registrarResultadoElo === 'function') ? registrarResultadoElo(ganador) : null;
    return cambioEloFinActual;
}

function programarPresentacionFinJuego(callback, demora = 1500) {
    if (finJuegoTimeout) clearTimeout(finJuegoTimeout);
    finJuegoTimeout = setTimeout(() => {
        finJuegoTimeout = null;
        callback();
    }, demora);
}

function mostrarFinJuego(tipo, jugadorEnTurno) {
    if (typeof detenerRelojes === 'function') detenerRelojes();
    if (typeof quitarPartidaActualDelCache === 'function') quitarPartidaActualDelCache();

    // Dejamos ver brevemente la posición final antes de mostrar el resultado.
    // El panel ya no expulsa automáticamente al jugador: puede quedarse a revisar.
    casillaFinJuego = null;
    casillasFinJuego = [];
    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = [];

    if (tipo === 'jaquemate' || tipo === 'tiempo') {
        let reyPerdedor = obtenerPosicionRey(jugadorEnTurno);
        if (reyPerdedor) casillaFinJuego = { f: reyPerdedor[0], c: reyPerdedor[1] };
    } else {
        let r0 = obtenerPosicionRey(0);
        let r1 = obtenerPosicionRey(1);
        if (r0) casillasFinJuego.push({ f: r0[0], c: r0[1] });
        if (r1) casillasFinJuego.push({ f: r1[0], c: r1[1] });
    }
    dibujarTablero();

    // El resultado lógico se registra AHORA, no cuando termine la animación
    // del banner. Así salir rápido no evita una derrota y un aviso duplicado
    // tampoco puede registrar dos veces la misma partida.
    registrarResultadoEloUnaVez((tipo === 'jaquemate' || tipo === 'tiempo') ? (1 - jugadorEnTurno) : null);
    programarPresentacionFinJuego(() => mostrarBannerFinJuego(tipo, jugadorEnTurno));
}

function mostrarBannerFinJuego(tipo, jugadorEnTurno) {
    const banner = document.getElementById('bannerFin');
    const texto = document.getElementById('bannerFinTexto');

    if (tipo === 'jaquemate' || tipo === 'tiempo') {
        const ganador = 1 - jugadorEnTurno;
        const nombreGanador = ganador === 0 ? 'Jugador 1 (Rojo)' : 'Jugador 2 (Azul)';
        const motivo = tipo === 'jaquemate' ? '♛ ¡Jaque mate!' : '⏱️ ¡Tiempo agotado!';
        const cambioElo = cambioEloFinActual;
        const sufijoElo = cambioElo ? textoCambioElo(cambioElo, ganador === 0 ? 'rojo' : 'azul') : '';
        if (texto) texto.textContent = `${motivo} Gana ${nombreGanador}${sufijoElo}`;
        if (banner) { banner.className = 'banner-fin mostrar victoria jugador' + ganador; }

        reproducirSonidoResultado(ganador);
    } else {
        if (texto) texto.textContent = '🤝 ¡Tablas! Partida terminada en empate (ahogado)';
        if (banner) { banner.className = 'banner-fin mostrar tablas'; }

        if (typeof reproducirTablas === 'function') reproducirTablas();
    }

    iniciarPanelFinPartida();
}

// Decide qué sonido tocar según quién "es" el usuario de este dispositivo.
// - Online: cada dispositivo solo controla a un jugador, así que suena alegre
//   si ese jugador ganó, y triste si perdió.
// - Local (mismo dispositivo, 2 jugadores o vs IA): ambos jugadores están
//   presentes, así que se mantiene el sonido de victoria general.
function reproducirSonidoResultado(ganador) {
    if (CONFIG_JUEGO.online) {
        const soyGanador = CONFIG_JUEGO.onlineSoyJugador === ganador;
        if (soyGanador) {
            if (typeof reproducirVictoria === 'function') reproducirVictoria();
        } else {
            if (typeof reproducirDerrota === 'function') reproducirDerrota();
        }
    } else {
        if (typeof reproducirVictoria === 'function') reproducirVictoria();
    }
}

// Configura el panel de fin de partida. Permanece abierto hasta que el
// jugador elija volver al menú; exportar no cierra ni limita el panel.
function iniciarPanelFinPartida() {
    detenerPanelFinPartida();

    const btnListo = document.getElementById('btnFinListo');
    const btnExportar = document.getElementById('btnFinExportar');
    const btnRevisar = document.getElementById('btnFinRevisar');
    const contadorEl = document.getElementById('finJuegoContador');

    if (contadorEl) contadorEl.textContent = 'La partida terminó. Puedes inspeccionar la posición final o guardar el registro antes de salir.';
    if (btnRevisar) {
        btnRevisar.disabled = false;
        btnRevisar.onclick = () => {
            const banner = document.getElementById('bannerFin');
            if (banner) banner.classList.remove('mostrar');
        };
    }
    if (btnExportar) {
        btnExportar.disabled = false;
        btnExportar.textContent = '💾 Guardar';
        btnExportar.onclick = () => {
            if (typeof exportarPartida === 'function') exportarPartida();
        };
    }
    if (btnListo) {
        btnListo.textContent = 'Menú principal →';
        btnListo.onclick = () => {
            detenerPanelFinPartida();
            window.location.href = 'index.html';
        };
    }
}

function detenerPanelFinPartida() {
    if (finJuegoIntervalo) { clearInterval(finJuegoIntervalo); finJuegoIntervalo = null; }
    if (finJuegoTimeout) { clearTimeout(finJuegoTimeout); finJuegoTimeout = null; }
}

// Llamado al iniciar una partida nueva o al importar/deshacer, para limpiar cualquier
// estado de "fin de partida" previo y dejar la partida jugable de nuevo.
function reiniciarFinJuego(preservarRegistroElo = false) {
    juegoTerminado = false;
    casillaFinJuego = null;
    casillasFinJuego = [];
    detenerPanelFinPartida();
    if (!preservarRegistroElo) {
        cambioEloFinActual = null;
        eloFinRegistrado = false;
    }
    const banner = document.getElementById('bannerFin');
    if (banner) { banner.className = 'banner-fin'; }
    if (typeof reanudarMusicaNormal === 'function') reanudarMusicaNormal();
}
