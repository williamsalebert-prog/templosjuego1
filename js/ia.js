console.log("✅ ia.js cargado");

// ============================================================================
// IA real (no aleatoria): delega el cálculo a un Web Worker (ia-worker.js)
// que ejecuta minimax con poda alfa-beta sobre las MISMAS reglas del juego.
// Se ejecuta en otro hilo para que pensar varios segundos en Difícil no
// congele el tablero, las animaciones ni los relojes.
//
// Dificultad 1 (Fácil): búsqueda corta + algo de azar entre buenas opciones.
// Dificultad 2 (Medio): búsqueda media, juega de forma sólida.
// Dificultad 3 (Difícil): búsqueda profunda con varios segundos de tiempo,
// la más fuerte posible sin dejar de responder en un tiempo razonable.
// ============================================================================

const JUGADOR_IA = 1;

let iaWorker = null;
let iaPeticionContador = 0;
let iaPensando = false;

function obtenerIAWorker() {
    if (!iaWorker) {
        iaWorker = new Worker('js/ia-worker.js');
        iaWorker.onmessage = (e) => {
            const { peticionId, resultado, error } = e.data;
            iaPensando = false;
            ocultarIndicadorPensandoIA();
            if (peticionId !== iaPeticionEsperada) return; // respuesta obsoleta (la partida cambió mientras pensaba)
            if (error) { console.error('Error en IA:', error); return; }
            if (!esTurnoDeIA()) return; // la partida cambió mientras la IA pensaba
            if (!resultado) return; // sin jugadas (no debería pasar; mate/ahogado ya se detectan antes)
            ejecutarJugadaIA(resultado);
        };
    }
    return iaWorker;
}
let iaPeticionEsperada = -1;

function esTurnoDeIA() {
    return CONFIG_JUEGO.modo === 1 && turno === JUGADOR_IA && !juegoTerminado && !animando && !coronacionPendiente && !window.partidaPausadaPorPropuesta;
}

function mostrarIndicadorPensandoIA() {
    const estado = document.getElementById('estadoJuego');
    if (estado && !esJaque(turno)) estado.textContent = '🤖 Pensando...';
}
function ocultarIndicadorPensandoIA() {
    if (typeof actualizarInterfaz === 'function') actualizarInterfaz();
}

function jugarTurnoIA() {
    if (!esTurnoDeIA()) return;
    if (iaPensando) return;
    iaPensando = true;
    mostrarIndicadorPensandoIA();

    const peticionId = ++iaPeticionContador;
    iaPeticionEsperada = peticionId;

    const worker = obtenerIAWorker();
    worker.postMessage({
        peticionId,
        boardData: serializarBoard(board),
        jugador: JUGADOR_IA,
        enroqueRealizado: [...enroqueRealizado],
        dificultad: CONFIG_JUEGO.dificultad,
        infoTiempo: construirInfoTiempoParaIA()
    });
}

// Reúne cómo está el reloj de esta partida para que la IA adapte cuánto
// piensa: en Bala/Blitz no debe demorarse igual que en Clásico/Infinito, y si
// va apurada de tiempo debe pensar todavía menos para no perder por reloj.
function construirInfoTiempoParaIA() {
    const timerActivo = !!CONFIG_JUEGO.timer && !!modoTiempoActual;
    const esInfinito = timerActivo && modoTiempoActual.segundos === null;
    return {
        timerActivo,
        esInfinito,
        segundosIniciales: timerActivo ? modoTiempoActual.segundos : null,
        incremento: timerActivo ? modoTiempoActual.incremento : 0,
        tiempoRestanteIA: (timerActivo && !esInfinito && typeof tiempoRestante !== 'undefined') ? tiempoRestante[JUGADOR_IA] : null
    };
}

function ejecutarJugadaIA(resultado) {
    if (resultado.tipo === 'enroque') {
        const [reyFila, reyCol] = resultado.origen;
        const [piezaFila, piezaCol] = resultado.destino;
        ejecutarEnroque(reyFila, reyCol, piezaFila, piezaCol, JUGADOR_IA);
        turno = 1 - turno;
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        dibujarTablero();
        registrarJugadaRealizada();
        comprobarFinJuego();
        if (typeof programarTurnoIASiCorresponde === 'function') programarTurnoIASiCorresponde();
        return;
    }
    aplicarMovimiento(resultado.origen, resultado.destino, resultado.camino);
}

// La IA, al coronar un peón, siempre elige Reina (la pieza más fuerte): es la
// decisión objetivamente mejor y evita tener que volver a llamar al worker
// solo para esa elección.
function elegirCoronacionIASiCorresponde() {
    if (CONFIG_JUEGO.modo === 1 && coronacionPendiente && coronacionPendiente.jugador === JUGADOR_IA) {
        coronar('F3');
    }
}

// Se revisa tras cada jugada (ver despuesDeJugada en finjuego.js)
function programarTurnoIASiCorresponde() {
    if (coronacionPendiente) { elegirCoronacionIASiCorresponde(); return; }
    if (!esTurnoDeIA()) return;
    // Pequeño retardo "humano" antes de que el worker arranque a pensar, para
    // que no se sienta instantáneo/robótico incluso en Fácil.
    setTimeout(jugarTurnoIA, 350);
}
