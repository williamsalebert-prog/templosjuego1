console.log("✅ ia.js cargado");

// ============================================================================
// IA real (no aleatoria): delega el cálculo a un Web Worker (ia-worker.js)
// que ejecuta minimax con poda alfa-beta sobre las MISMAS reglas del juego.
// Se ejecuta en otro hilo para que pensar varios segundos en Difícil no
// congele el tablero, las animaciones ni los relojes.
//
// Dificultad 1 (Principiante): una mirada superficial y bastante variedad.
// Dificultad 2 (Fácil): búsqueda corta, todavía comete errores razonables.
// Dificultad 3 (Normal): juego consistente sin calcular demasiado lejos.
// Dificultad 4 (Difícil): búsqueda media-alta y casi sin concesiones.
// Dificultad 5 (Maestro): equivale aproximadamente al antiguo Difícil; es la
// IA más fuerte disponible y puede encontrar tácticas profundas rápidamente.
// ============================================================================

const JUGADOR_IA = 1;

let iaWorker = null;
let iaPeticionContador = 0;
let iaPensando = false;
let iaPromocionElegida = null;

function obtenerIAWorker() {
    if (!iaWorker) {
        iaWorker = new Worker('js/ia-worker.js');
        iaWorker.onmessage = (e) => {
            const { peticionId, resultado, error } = e.data;
            iaPensando = false;
            ocultarIndicadorPensandoIA();
            if (peticionId !== iaPeticionEsperada) return; // respuesta obsoleta (la partida cambió mientras pensaba)
            if (error) {
                console.error('Error en IA:', error);
                if (typeof mostrarToastJuego === 'function') mostrarToastJuego('La IA tuvo un error de cálculo. Se reinició el motor.', 'error');
                try { iaWorker.terminate(); } catch(e) {}
                iaWorker = null;
                setTimeout(programarTurnoIASiCorresponde, 120);
                return;
            }
            if (!esTurnoDeIA()) return; // la partida cambió mientras la IA pensaba
            if (!resultado) return; // sin jugadas (no debería pasar; mate/ahogado ya se detectan antes)
            ejecutarJugadaIA(resultado);
        };
        iaWorker.onerror = (ev) => {
            console.error('Worker de IA detenido:', ev?.message || ev);
            iaPensando = false;
            ocultarIndicadorPensandoIA();
            try { iaWorker.terminate(); } catch(e) {}
            iaWorker = null;
            if (typeof mostrarToastJuego === 'function') mostrarToastJuego('La IA se reinició tras un error interno.', 'error');
            if (esTurnoDeIA()) setTimeout(programarTurnoIASiCorresponde, 120);
        };
    }
    return iaWorker;
}
let iaPeticionEsperada = -1;

function esTurnoDeIA() {
    return CONFIG_JUEGO.modo === 1 && turno === JUGADOR_IA && window.tableroHabilitado !== false && !juegoTerminado && !animando && !coronacionPendiente && !window.partidaPausadaPorPropuesta;
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
    iaPromocionElegida = resultado.promocion || null;
    if (resultado.tipo === 'enroque') {
        const [reyFila, reyCol] = resultado.origen;
        const [piezaFila, piezaCol] = resultado.destino;
        if (!ejecutarEnroque(reyFila, reyCol, piezaFila, piezaCol, JUGADOR_IA)) {
            // Si la posición cambió mientras el worker pensaba, no forzamos un
            // enroque que ya dejó de ser legal: se recalcula el turno de IA.
            programarTurnoIASiCorresponde();
            return;
        }
        turno = 1 - turno;
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        dibujarTablero();
        if (typeof despuesDeJugada === 'function') despuesDeJugada();
        return;
    }
    aplicarMovimiento(resultado.origen, resultado.destino, resultado.camino);
}

// La promoción ya fue evaluada dentro del árbol de búsqueda. Así la IA puede
// usar una pieza distinta de Reina cuando una posición concreta lo justifique.
function elegirCoronacionIASiCorresponde() {
    if (CONFIG_JUEGO.modo === 1 && coronacionPendiente && coronacionPendiente.jugador === JUGADOR_IA) {
        const permitidas = new Set(['F0', 'F2', 'F3', 'F4', 'F5']);
        const tipo = permitidas.has(iaPromocionElegida) ? iaPromocionElegida : 'F3';
        iaPromocionElegida = null;
        coronar(tipo);
    }
}

// Se revisa tras cada jugada (ver despuesDeJugada en finjuego.js)
function programarTurnoIASiCorresponde() {
    if (coronacionPendiente) { elegirCoronacionIASiCorresponde(); return; }
    if (!esTurnoDeIA()) return;
    // Retardo mínimo solo para permitir que la interfaz pinte el cambio de turno.
    // La IA ya consume tiempo real pensando; añadir 350 ms hacía que pareciera más lenta.
    setTimeout(jugarTurnoIA, 60);
}
