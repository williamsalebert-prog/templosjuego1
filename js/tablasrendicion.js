console.log("✅ tablasrendicion.js cargado");

// ============================================================================
// PEDIR TABLAS / RENDIRSE
// ============================================================================
// - Local (2 jugadores, mismo dispositivo): se pausa el contador y se le
//   muestra al otro jugador un aviso para que responda Sí/No en la misma
//   pantalla (comparten el dispositivo).
// - Online (2 jugadores, distinto dispositivo): la propuesta viaja por el
//   canal de datos; quien propuso ve "esperando respuesta" y el rival ve el
//   aviso para aceptar o rechazar.
// - Vs IA: la IA nunca se rinde por su cuenta, y solo acepta una propuesta de
//   tablas si su posición actual no es buena (lo decide el mismo worker que
//   juega sus jugadas, evaluando la posición).
// ============================================================================

window.partidaPausadaPorPropuesta = false;
let propuestaPendienteTipo = null; // 'tablas' | 'rendicion'
let propuestaLaHiceYo = false;

function pausarPorPropuesta() {
    window.partidaPausadaPorPropuesta = true;
}
function reanudarTrasPropuesta() {
    window.partidaPausadaPorPropuesta = false;
}

// --- Botones del menú ---
function abrirConfirmarRendicion() {
    document.getElementById('textoConfirmarRendicion').textContent =
        '¿Seguro que quieres rendirte? El otro jugador ganará la partida.';
    document.getElementById('modalConfirmarRendicion').classList.add('mostrar');
}

function iniciarPropuesta(tipo) {
    propuestaPendienteTipo = tipo;
    propuestaLaHiceYo = true;
    pausarPorPropuesta();

    if (tipo === 'rendicion') {
        // Rendirse no necesita aceptación: termina la partida de inmediato.
        const ganador = 1 - quienSoyYo();
        reanudarTrasPropuesta();
        if (CONFIG_JUEGO.online && typeof transmitirRendicion === 'function') transmitirRendicion(quienSoyYo());
        finalizarPorRendicion(ganador);
        return;
    }

    // Tablas: si es vs IA, la IA decide sola según su evaluación de posición.
    if (CONFIG_JUEGO.modo === 1) {
        mostrarEsperandoRespuesta('tablas');
        setTimeout(() => resolverPropuestaIA('tablas'), 700);
        return;
    }

    // Online: se la mandamos al rival y esperamos su respuesta.
    if (CONFIG_JUEGO.online) {
        if (typeof canalDatosActivo === 'function' ? canalDatosActivo() : true) {
            transmitirPropuesta(tipo);
        }
        mostrarEsperandoRespuesta('tablas');
        return;
    }

    // Local (mismo dispositivo): mostramos directo el aviso para el otro jugador.
    mostrarPropuestaRecibida('tablas', 1 - quienSoyYo());
}

// En modo online, "quién soy yo" es CONFIG_JUEGO.onlineSoyJugador. En modo
// local o vs IA, quien usa el menú es el jugador del turno actual.
function quienSoyYo() {
    if (CONFIG_JUEGO.online) return CONFIG_JUEGO.onlineSoyJugador;
    return turno;
}

function mostrarEsperandoRespuesta(tipo) {
    const titulo = document.getElementById('tituloEsperandoRespuesta');
    const texto = document.getElementById('textoEsperandoRespuesta');
    if (titulo) titulo.textContent = tipo === 'tablas' ? '🤝 Tablas propuestas' : '🏳️ Rendición propuesta';
    if (texto) texto.textContent = 'Esperando la respuesta del otro jugador...';
    document.getElementById('modalEsperandoRespuesta').classList.add('mostrar');
}
function cerrarEsperandoRespuesta() {
    document.getElementById('modalEsperandoRespuesta').classList.remove('mostrar');
}

function mostrarPropuestaRecibida(tipo, paraJugador) {
    propuestaPendienteTipo = tipo;
    propuestaLaHiceYo = false;
    const titulo = document.getElementById('tituloPropuestaRecibida');
    const texto = document.getElementById('textoPropuestaRecibida');
    const nombreProponente = (1 - paraJugador) === 0 ? 'Jugador 1 (Rojo)' : 'Jugador 2 (Azul)';
    if (titulo) titulo.textContent = '🤝 ¿Aceptas tablas?';
    if (texto) texto.textContent = `${nombreProponente} propone tablas. ¿Las aceptas?`;
    document.getElementById('modalPropuestaRecibida').classList.add('mostrar');
}
function cerrarPropuestaRecibida() {
    document.getElementById('modalPropuestaRecibida').classList.remove('mostrar');
}

function responderPropuesta(acepta) {
    cerrarPropuestaRecibida();
    if (CONFIG_JUEGO.online) {
        transmitirRespuestaPropuesta(acepta);
    }
    aplicarResultadoPropuesta(acepta);
}

function aplicarResultadoPropuesta(acepta) {
    cerrarEsperandoRespuesta();
    reanudarTrasPropuesta();
    if (acepta) {
        finalizarPorTablasAcordadas();
    } else {
        if (typeof mostrarAvisoRapido === 'function') mostrarAvisoRapido('El otro jugador rechazó las tablas.');
    }
    propuestaPendienteTipo = null;
}

function cancelarPropuestaEnviada() {
    cerrarEsperandoRespuesta();
    reanudarTrasPropuesta();
    propuestaPendienteTipo = null;
}

// --- IA respondiendo a una propuesta de tablas ---
function resolverPropuestaIA(tipo) {
    cerrarEsperandoRespuesta();
    reanudarTrasPropuesta();
    // Evaluación simple y rápida (sin worker, es instantánea): si la IA tiene
    // ventaja de material clara, rechaza; si está igualada o peor, acepta.
    let valor = 0;
    const VALOR_PIEZA_LOCAL = { F0: 5, F1: 1, F2: 4, F3: 9, F4: 3, F5: 3.2, F6: 0 };
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            const p = board[i][j];
            if (!p) continue;
            valor += (p.jugador === 1 ? 1 : -1) * (VALOR_PIEZA_LOCAL[p.tipo] || 0);
        }
    }
    const aceptaIA = valor <= 0.5; // la IA (jugador 1) acepta si no va claramente ganando
    if (typeof mostrarAvisoRapido === 'function') {
        mostrarAvisoRapido(aceptaIA ? 'La IA acepta las tablas.' : 'La IA rechaza las tablas: cree que va ganando.');
    }
    if (aceptaIA) finalizarPorTablasAcordadas();
}

// --- Finalización de partida por tablas/rendición ---
function finalizarPorTablasAcordadas() {
    if (juegoTerminado) return;
    juegoTerminado = true;
    if (typeof detenerRelojes === 'function') detenerRelojes();
    if (typeof quitarPartidaActualDelCache === 'function') quitarPartidaActualDelCache();
    casillaFinJuego = null;
    casillasFinJuego = [];
    let r0 = typeof obtenerPosicionRey === 'function' ? obtenerPosicionRey(0) : null;
    let r1 = typeof obtenerPosicionRey === 'function' ? obtenerPosicionRey(1) : null;
    if (r0) casillasFinJuego.push({ f: r0[0], c: r0[1] });
    if (r1) casillasFinJuego.push({ f: r1[0], c: r1[1] });
    dibujarTablero();

    setTimeout(() => {
        const banner = document.getElementById('bannerFin');
        const texto = document.getElementById('bannerFinTexto');
        if (typeof registrarResultadoElo === 'function') registrarResultadoElo(null);
        if (texto) texto.textContent = '🤝 ¡Tablas acordadas entre los jugadores!';
        if (banner) banner.className = 'banner-fin mostrar tablas';
        if (typeof reproducirTablas === 'function') reproducirTablas();
        if (typeof iniciarPanelFinPartida === 'function') iniciarPanelFinPartida();
    }, 3000);
}

function finalizarPorRendicion(ganador) {
    if (juegoTerminado) return;
    juegoTerminado = true;
    if (typeof detenerRelojes === 'function') detenerRelojes();
    if (typeof quitarPartidaActualDelCache === 'function') quitarPartidaActualDelCache();
    casillaFinJuego = null;
    casillasFinJuego = [];
    let reyPerdedor = typeof obtenerPosicionRey === 'function' ? obtenerPosicionRey(1 - ganador) : null;
    if (reyPerdedor) casillaFinJuego = { f: reyPerdedor[0], c: reyPerdedor[1] };
    dibujarTablero();

    setTimeout(() => {
        const banner = document.getElementById('bannerFin');
        const texto = document.getElementById('bannerFinTexto');
        const nombreGanador = ganador === 0 ? 'Jugador 1 (Rojo)' : 'Jugador 2 (Azul)';
        const cambioElo = (typeof registrarResultadoElo === 'function') ? registrarResultadoElo(ganador) : null;
        const sufijoElo = cambioElo ? textoCambioElo(cambioElo, ganador === 0 ? 'rojo' : 'azul') : '';
        if (texto) texto.textContent = `🏳️ Rendición. Gana ${nombreGanador}${sufijoElo}`;
        if (banner) banner.className = 'banner-fin mostrar victoria jugador' + ganador;
        if (typeof reproducirSonidoResultado === 'function') reproducirSonidoResultado(ganador);
        else if (typeof reproducirVictoria === 'function') reproducirVictoria();
        if (typeof iniciarPanelFinPartida === 'function') iniciarPanelFinPartida();
    }, 3000);
}

// --- Aviso corto no intrusivo (reutiliza el indicador de estado de la barra) ---
function mostrarAvisoRapido(msg) {
    const estado = document.getElementById('estadoJuego');
    if (!estado) return;
    const previo = estado.textContent;
    estado.textContent = msg;
    setTimeout(() => { if (typeof actualizarInterfaz === 'function') actualizarInterfaz(); }, 2500);
}

function configurarMenuTablasRendicion() {
    const btnTablas = document.getElementById('menuTablas');
    const btnRendirse = document.getElementById('menuRendirse');
    if (btnTablas) btnTablas.addEventListener('click', () => {
        if (typeof cerrarMenu === 'function') cerrarMenu();
        if (juegoTerminado || !window.tableroHabilitado || window.partidaPausadaPorPropuesta) return;
        iniciarPropuesta('tablas');
    });
    if (btnRendirse) btnRendirse.addEventListener('click', () => {
        if (typeof cerrarMenu === 'function') cerrarMenu();
        if (juegoTerminado || !window.tableroHabilitado || window.partidaPausadaPorPropuesta) return;
        abrirConfirmarRendicion();
    });

    const btnConfirmarRendicion = document.getElementById('btnConfirmarRendicion');
    const btnCancelarRendicion = document.getElementById('btnCancelarRendicion');
    if (btnConfirmarRendicion) btnConfirmarRendicion.addEventListener('click', () => {
        document.getElementById('modalConfirmarRendicion').classList.remove('mostrar');
        iniciarPropuesta('rendicion');
    });
    if (btnCancelarRendicion) btnCancelarRendicion.addEventListener('click', () => {
        document.getElementById('modalConfirmarRendicion').classList.remove('mostrar');
    });

    const btnCancelarPropuesta = document.getElementById('btnCancelarPropuesta');
    if (btnCancelarPropuesta) btnCancelarPropuesta.addEventListener('click', () => {
        if (CONFIG_JUEGO.online) transmitirCancelarPropuesta();
        cancelarPropuestaEnviada();
    });

    const btnAceptar = document.getElementById('btnAceptarPropuesta');
    const btnRechazar = document.getElementById('btnRechazarPropuesta');
    if (btnAceptar) btnAceptar.addEventListener('click', () => responderPropuesta(true));
    if (btnRechazar) btnRechazar.addEventListener('click', () => responderPropuesta(false));
}
document.addEventListener('DOMContentLoaded', configurarMenuTablasRendicion);
if (document.readyState !== 'loading') configurarMenuTablasRendicion();
