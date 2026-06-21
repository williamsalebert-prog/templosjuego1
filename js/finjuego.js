console.log("✅ finjuego.js cargado");

// Punto único que se llama justo después de que una jugada terminó y el turno
// ya pasó al siguiente jugador. Centraliza: contador de jugadas, detección de
// jaque/jaque mate/ahogado, refresco de interfaz y disparo del turno de la IA.
function despuesDeJugada() {
    registrarJugadaRealizada();
    comprobarFinJuego();
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
}

// Llamado al iniciar una partida nueva o al importar/deshacer, para limpiar cualquier
// estado de "fin de partida" previo y dejar la partida jugable de nuevo.
function reiniciarFinJuego() {
    juegoTerminado = false;
    casillaFinJuego = null;
    casillasFinJuego = [];
    const banner = document.getElementById('bannerFin');
    if (banner) { banner.className = 'banner-fin'; }
    if (typeof reanudarMusicaNormal === 'function') reanudarMusicaNormal();
}
