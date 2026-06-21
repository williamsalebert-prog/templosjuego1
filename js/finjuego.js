console.log("✅ finjuego.js cargado");

// Punto único que se llama justo después de que una jugada terminó y el turno
// ya pasó al siguiente jugador. Centraliza: contador de jugadas, detección de
// jaque/jaque mate/ahogado, refresco de interfaz y disparo del turno de la IA.
function despuesDeJugada() {
    registrarJugadaRealizada();
    comprobarFinJuego();
    if (typeof transmitirEstadoSiOnline === 'function') transmitirEstadoSiOnline();
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

    if (esJaqueMate(turno)) {
        juegoTerminado = true;
        mostrarFinJuego('jaquemate', turno);
    } else if (esAhogado(turno)) {
        juegoTerminado = true;
        mostrarFinJuego('tablas', turno);
    } else if (esJaque(turno)) {
        if (typeof sonidoJaque === 'function') sonidoJaque();
    }

    if (typeof actualizarInterfaz === 'function') actualizarInterfaz();
    dibujarTablero();
}

// --- Estado del panel de fin de partida (contador de 8s, límite de exportaciones) ---
let finJuegoIntervalo = null;
let finJuegoSegundosRestantes = 8;
let finJuegoExportacionesUsadas = 0;
const FIN_JUEGO_MAX_EXPORTACIONES = 3;
const FIN_JUEGO_SEGUNDOS_TOTAL = 8;

function mostrarFinJuego(tipo, jugadorEnTurno) {
    if (typeof detenerRelojes === 'function') detenerRelojes();

    const banner = document.getElementById('bannerFin');
    const texto = document.getElementById('bannerFinTexto');
    casillaFinJuego = null;
    casillasFinJuego = [];

    if (tipo === 'jaquemate') {
        const ganador = 1 - jugadorEnTurno;
        const nombreGanador = ganador === 0 ? 'Jugador 1 (Rojo)' : 'Jugador 2 (Azul)';
        if (texto) texto.textContent = `♛ ¡Jaque mate! Gana ${nombreGanador}`;
        if (banner) { banner.className = 'banner-fin mostrar victoria jugador' + ganador; }

        let reyPerdedor = obtenerPosicionRey(jugadorEnTurno);
        if (reyPerdedor) casillaFinJuego = { f: reyPerdedor[0], c: reyPerdedor[1] };

        if (typeof reproducirVictoria === 'function') reproducirVictoria();
    } else if (tipo === 'tiempo') {
        const ganador = 1 - jugadorEnTurno;
        const nombreGanador = ganador === 0 ? 'Jugador 1 (Rojo)' : 'Jugador 2 (Azul)';
        if (texto) texto.textContent = `⏱️ ¡Tiempo agotado! Gana ${nombreGanador}`;
        if (banner) { banner.className = 'banner-fin mostrar victoria jugador' + ganador; }

        let reyPerdedor = obtenerPosicionRey(jugadorEnTurno);
        if (reyPerdedor) casillaFinJuego = { f: reyPerdedor[0], c: reyPerdedor[1] };

        if (typeof reproducirVictoria === 'function') reproducirVictoria();
    } else {
        if (texto) texto.textContent = '🤝 ¡Tablas! Partida terminada en empate (ahogado)';
        if (banner) { banner.className = 'banner-fin mostrar tablas'; }

        let r0 = obtenerPosicionRey(0);
        let r1 = obtenerPosicionRey(1);
        if (r0) casillasFinJuego.push({ f: r0[0], c: r0[1] });
        if (r1) casillasFinJuego.push({ f: r1[0], c: r1[1] });

        if (typeof reproducirTablas === 'function') reproducirTablas();
    }

    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = [];
    dibujarTablero();

    iniciarPanelFinPartida();
}

// Configura y arranca el contador de 8 segundos del panel de fin de partida.
// Si no se pulsa "Listo" ni "Exportar partida" dentro de ese tiempo, regresa
// automáticamente al menú principal.
function iniciarPanelFinPartida() {
    finJuegoExportacionesUsadas = 0;
    finJuegoSegundosRestantes = FIN_JUEGO_SEGUNDOS_TOTAL;

    const btnListo = document.getElementById('btnFinListo');
    const btnExportar = document.getElementById('btnFinExportar');
    const contadorEl = document.getElementById('finJuegoContador');

    if (btnExportar) {
        btnExportar.disabled = false;
        btnExportar.textContent = `💾 Exportar partida (3 disponibles)`;
    }
    actualizarContadorFinPartida();

    if (finJuegoIntervalo) clearInterval(finJuegoIntervalo);
    finJuegoIntervalo = setInterval(() => {
        finJuegoSegundosRestantes--;
        actualizarContadorFinPartida();
        if (finJuegoSegundosRestantes <= 0) {
            detenerPanelFinPartida();
            window.location.href = 'index.html';
        }
    }, 1000);

    if (btnListo) {
        btnListo.onclick = () => {
            detenerPanelFinPartida();
            window.location.href = 'index.html';
        };
    }
    if (btnExportar) {
        btnExportar.onclick = () => {
            if (finJuegoExportacionesUsadas >= FIN_JUEGO_MAX_EXPORTACIONES) return;
            if (typeof exportarPartida === 'function') exportarPartida();
            finJuegoExportacionesUsadas++;
            // Pulsar exportar pausa el contador automático de regreso al menú
            pausarContadorFinPartida();
            const restantes = FIN_JUEGO_MAX_EXPORTACIONES - finJuegoExportacionesUsadas;
            if (restantes <= 0) {
                btnExportar.disabled = true;
                btnExportar.textContent = '💾 Exportar (límite alcanzado)';
            } else {
                btnExportar.textContent = `💾 Exportar partida (${restantes} disponibles)`;
            }
        };
    }
}

function actualizarContadorFinPartida() {
    const contadorEl = document.getElementById('finJuegoContador');
    if (contadorEl) {
        contadorEl.textContent = finJuegoSegundosRestantes > 0
            ? `Volviendo al menú en ${finJuegoSegundosRestantes}s...`
            : '';
    }
}

function pausarContadorFinPartida() {
    if (finJuegoIntervalo) { clearInterval(finJuegoIntervalo); finJuegoIntervalo = null; }
    const contadorEl = document.getElementById('finJuegoContador');
    if (contadorEl) contadorEl.textContent = 'Partida exportada. Pulsa "Listo" cuando quieras volver al menú.';
}

function detenerPanelFinPartida() {
    if (finJuegoIntervalo) { clearInterval(finJuegoIntervalo); finJuegoIntervalo = null; }
}

// Llamado al iniciar una partida nueva o al importar/deshacer, para limpiar cualquier
// estado de "fin de partida" previo y dejar la partida jugable de nuevo.
function reiniciarFinJuego() {
    juegoTerminado = false;
    casillaFinJuego = null;
    casillasFinJuego = [];
    detenerPanelFinPartida();
    const banner = document.getElementById('bannerFin');
    if (banner) { banner.className = 'banner-fin'; }
    if (typeof reanudarMusicaNormal === 'function') reanudarMusicaNormal();
}
