console.log("✅ relojes.js cargado");

// Sistema de relojes con soporte para los distintos modos de partida definidos
// en MODOS_TIEMPO (config.js): bala, blitz5, blitz3+2, rapidoA, rapidoB, clasico
// e infinito (cronómetro ascendente, sin límite, sin derrota por tiempo).

let tiempoRestante = [0, 0];
let cronometro = [0, 0];           // usado solo en modo "infinito" (cuenta hacia arriba)
let relojIntervalo = null;
let relojesActivos = false;
let avisoBajoTiempoDado = [false, false];
let bonoJugadaAplicado = [false, false];
let modoTiempoActual = null;

function formatearTiempo(seg) {
    seg = Math.max(0, Math.ceil(seg));
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function pintarRelojes() {
    const el0 = document.getElementById('relojJ0');
    const el1 = document.getElementById('relojJ1');
    const esInfinito = modoTiempoActual && modoTiempoActual.segundos === null;
    if (el0) {
        el0.textContent = esInfinito ? formatearTiempo(cronometro[0]) : formatearTiempo(tiempoRestante[0]);
        el0.classList.toggle('reloj-activo', relojesActivos && turno === 0 && !juegoTerminado);
        el0.classList.toggle('reloj-bajo', !esInfinito && tiempoRestante[0] <= 20);
    }
    if (el1) {
        el1.textContent = esInfinito ? formatearTiempo(cronometro[1]) : formatearTiempo(tiempoRestante[1]);
        el1.classList.toggle('reloj-activo', relojesActivos && turno === 1 && !juegoTerminado);
        el1.classList.toggle('reloj-bajo', !esInfinito && tiempoRestante[1] <= 20);
    }
}

function iniciarRelojes() {
    detenerRelojes();
    modoTiempoActual = MODOS_TIEMPO[CONFIG_JUEGO.timerMode] || MODOS_TIEMPO.blitz5;

    if (!CONFIG_JUEGO.timer) {
        const cont = document.getElementById('panelRelojes');
        if (cont) cont.style.display = 'none';
        return;
    }
    const cont = document.getElementById('panelRelojes');
    if (cont) cont.style.display = 'flex';

    const inicial = modoTiempoActual.segundos;
    tiempoRestante = [inicial, inicial];
    cronometro = [0, 0];
    avisoBajoTiempoDado = [false, false];
    bonoJugadaAplicado = [false, false];
    relojesActivos = true;
    pintarRelojes();

    let ultimo = performance.now();
    relojIntervalo = setInterval(() => {
        if (!relojesActivos || juegoTerminado || animando || coronacionPendiente) { ultimo = performance.now(); return; }
        const ahora = performance.now();
        const delta = (ahora - ultimo) / 1000;
        ultimo = ahora;

        if (modoTiempoActual.segundos === null) {
            // Modo infinito: cronómetro ascendente, no hay derrota por tiempo
            cronometro[turno] += delta;
            pintarRelojes();
            return;
        }

        tiempoRestante[turno] -= delta;
        if (tiempoRestante[turno] <= 20 && !avisoBajoTiempoDado[turno]) {
            avisoBajoTiempoDado[turno] = true;
            if (typeof sonidoTiempoBajo === 'function') sonidoTiempoBajo();
        }
        if (tiempoRestante[turno] <= 0) {
            tiempoRestante[turno] = 0;
            pintarRelojes();
            relojesActivos = false;
            if (typeof mostrarFinJuego === 'function') {
                juegoTerminado = true;
                mostrarFinJuego('tiempo', turno);
            }
            return;
        }
        pintarRelojes();
    }, 200);
}

function detenerRelojes() {
    relojesActivos = false;
    if (relojIntervalo) { clearInterval(relojIntervalo); relojIntervalo = null; }
}

// Se llama justo después de que un jugador completa una jugada (antes de pasar el
// turno visualmente ya pasó, pero "jugadorQueMovio" es quien acaba de jugar).
// Aplica el incremento de tiempo y, en modo clásico, el bono al llegar a la jugada 40.
function aplicarIncrementoTiempo(jugadorQueMovio, numeroJugadaDeEseJugador) {
    if (!CONFIG_JUEGO.timer || !modoTiempoActual) return;
    if (modoTiempoActual.segundos === null) return; // infinito no usa incrementos
    if (modoTiempoActual.incremento > 0) {
        tiempoRestante[jugadorQueMovio] += modoTiempoActual.incremento;
    }
    const bono = modoTiempoActual.bonoJugada;
    if (bono && !bonoJugadaAplicado[jugadorQueMovio] && numeroJugadaDeEseJugador >= bono.jugada) {
        tiempoRestante[jugadorQueMovio] += bono.segundos;
        bonoJugadaAplicado[jugadorQueMovio] = true;
    }
    pintarRelojes();
}
