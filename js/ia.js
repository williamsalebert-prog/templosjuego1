console.log("✅ ia.js cargado");

// IMPORTANTE: esta es una IA muy básica de relleno (movimiento aleatorio entre
// los movimientos legales), NO la "IA sofisticada de alto nivel" pedida.
// Implementar una IA fuerte (tipo motor de ajedrez) es un proyecto en sí mismo
// (búsqueda minimax/alfa-beta, evaluación de posición, etc.) y queda fuera del
// alcance de esta corrección. Esto solo evita que el modo "1 jugador" se quede
// congelado: el jugador 2 (azul) jugará moviendo piezas válidas al azar.
// La "dificultad" únicamente cambia cuánto tarda en "pensar".

const JUGADOR_IA = 1;
const RETARDO_IA = { 1: 600, 2: 900, 3: 1200 };

function esTurnoDeIA() {
    return CONFIG_JUEGO.modo === 1 && turno === JUGADOR_IA && !juegoTerminado && !animando && !coronacionPendiente;
}

function jugarTurnoIA() {
    if (!esTurnoDeIA()) return;
    const movimientosPosibles = obtenerTodosMovimientosLegales(JUGADOR_IA);
    if (movimientosPosibles.length === 0) return; // comprobarFinJuego ya habrá detectado mate/ahogado

    const origen = movimientosPosibles[Math.floor(Math.random() * movimientosPosibles.length)];
    const mov = origen.movimientos[Math.floor(Math.random() * origen.movimientos.length)];

    if (mov.tipoMov === 'enroque') {
        ejecutarEnroque(origen.fila, origen.col, mov.f, mov.c, JUGADOR_IA);
        turno = 1 - turno;
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        registrarJugadaRealizada();
        comprobarFinJuego();
        return;
    }

    let fDest, cDest;
    if (Array.isArray(mov)) { fDest = mov[0]; cDest = mov[1]; }
    else { fDest = mov.f; cDest = mov.c; }

    const pieza = board[origen.fila][origen.col];
    const res = pieza.obtenerMovimientos(origen.fila, origen.col, board);
    const info = res.caminos[`${fDest},${cDest}`];
    let camino = null;
    if (Array.isArray(info) && info.length > 0 && info[0].hasOwnProperty('pasos')) {
        camino = info[Math.floor(Math.random() * info.length)].pasos;
    } else if (Array.isArray(info)) {
        camino = info;
    }

    aplicarMovimiento([origen.fila, origen.col], [fDest, cDest], camino);
}

// Se revisa tras cada jugada (ver despuesDeJugada en finjuego.js)
function programarTurnoIASiCorresponde() {
    if (!esTurnoDeIA()) return;
    const retardo = RETARDO_IA[CONFIG_JUEGO.dificultad] || RETARDO_IA[1];
    setTimeout(jugarTurnoIA, retardo);
}
