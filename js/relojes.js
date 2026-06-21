console.log("✅ relojes.js cargado");

const TIEMPO_INICIAL_SEG = 5 * 60; // 5 minutos por jugador, como un reloj de torneo
let tiempoRestante = [TIEMPO_INICIAL_SEG, TIEMPO_INICIAL_SEG];
let relojIntervalo = null;
let relojesActivos = false;
let avisoBajoTiempoDado = [false, false];

function formatearTiempo(seg) {
    seg = Math.max(0, Math.ceil(seg));
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function pintarRelojes() {
    const el0 = document.getElementById('relojJ0');
    const el1 = document.getElementById('relojJ1');
    if (el0) {
        el0.textContent = formatearTiempo(tiempoRestante[0]);
        el0.classList.toggle('reloj-activo', relojesActivos && turno === 0 && !juegoTerminado);
        el0.classList.toggle('reloj-bajo', tiempoRestante[0] <= 20);
    }
    if (el1) {
        el1.textContent = formatearTiempo(tiempoRestante[1]);
        el1.classList.toggle('reloj-activo', relojesActivos && turno === 1 && !juegoTerminado);
        el1.classList.toggle('reloj-bajo', tiempoRestante[1] <= 20);
    }
}

function iniciarRelojes() {
    detenerRelojes();
    if (!CONFIG_JUEGO.timer) {
        const cont = document.getElementById('panelRelojes');
        if (cont) cont.style.display = 'none';
        return;
    }
    const cont = document.getElementById('panelRelojes');
    if (cont) cont.style.display = 'flex';
    tiempoRestante = [TIEMPO_INICIAL_SEG, TIEMPO_INICIAL_SEG];
    avisoBajoTiempoDado = [false, false];
    relojesActivos = true;
    pintarRelojes();
    let ultimo = performance.now();
    relojIntervalo = setInterval(() => {
        if (!relojesActivos || juegoTerminado || animando || coronacionPendiente) { ultimo = performance.now(); return; }
        const ahora = performance.now();
        const delta = (ahora - ultimo) / 1000;
        ultimo = ahora;
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
