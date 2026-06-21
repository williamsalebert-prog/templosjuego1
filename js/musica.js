console.log("✅ musica.js cargado");

// 🎵 Música de fondo tranquila y continua durante toda la partida.
// Generada de forma procedural con Web Audio API (no hay archivos de audio en el repo),
// con el mismo estilo de osciladores que sonido.js. Reutiliza su AudioContext si existe.
// Registro medio-agudo (sin graves) y todo pasa por un compresor para que nunca distorsione,
// aunque se superpongan varias notas a la vez.

let musicaIniciada = false;
let musicaActiva = true;
let acordeIndex = 0;
let nodoCompresorMusica = null;

function obtenerContextoMusica() {
    if (typeof getAudioContext === 'function') return getAudioContext();
    if (!window._musicaCtx) window._musicaCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (window._musicaCtx.state === 'suspended') window._musicaCtx.resume();
    return window._musicaCtx;
}

// Salida compartida: un compresor suave evita que la suma de varias notas sature/distorsione
// los parlantes, aunque se acumulen acordes y melodía al mismo tiempo.
function obtenerSalidaMusica() {
    const ctx = obtenerContextoMusica();
    if (!nodoCompresorMusica || nodoCompresorMusica.context !== ctx) {
        nodoCompresorMusica = ctx.createDynamicsCompressor();
        nodoCompresorMusica.threshold.value = -24;
        nodoCompresorMusica.knee.value = 30;
        nodoCompresorMusica.ratio.value = 6;
        nodoCompresorMusica.attack.value = 0.01;
        nodoCompresorMusica.release.value = 0.25;
        nodoCompresorMusica.connect(ctx.destination);
    }
    return nodoCompresorMusica;
}

// Escala pentatónica mayor, en un registro medio-agudo, alegre y sin nada de grave
const ESCALA_CALMA = [392.00, 440.00, 493.88, 587.33, 659.25, 783.99, 880.00];

// Acordes mayores en registro medio (sin bajos retumbantes) para un ambiente más alegre
const ACORDES_PAD = [
    [261.63, 329.63, 392.00], // Do mayor
    [293.66, 369.99, 440.00], // Re mayor
    [349.23, 440.00, 523.25], // Fa mayor
    [392.00, 493.88, 587.33], // Sol mayor
];

function tocarNotaPad(frec, duracion, vol) {
    try {
        const ctx = obtenerContextoMusica();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frec;
        const t0 = ctx.currentTime;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(vol, t0 + duracion * 0.3);   // entrada suave
        gain.gain.linearRampToValueAtTime(0, t0 + duracion);            // salida suave
        osc.connect(gain);
        gain.connect(obtenerSalidaMusica());
        osc.start(t0);
        osc.stop(t0 + duracion + 0.1);
    } catch (e) {}
}

function tocarNotaMelodia(frec, duracion, vol) {
    try {
        const ctx = obtenerContextoMusica();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = frec;
        const t0 = ctx.currentTime;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(vol, t0 + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duracion);
        osc.connect(gain);
        gain.connect(obtenerSalidaMusica());
        osc.start(t0);
        osc.stop(t0 + duracion + 0.1);
    } catch (e) {}
}

// Un ciclo = un acorde de fondo (arpegiado, no las 3 notas a la vez, para que no se amontonen
// y suene más ligero/alegre) + varias notas de melodía suave encima.
// Se reprograma a sí mismo indefinidamente, así que la música nunca se detiene.
function reproducirCicloMusical() {
    if (musicaActiva) {
        const acorde = ACORDES_PAD[acordeIndex % ACORDES_PAD.length];
        acorde.forEach((frec, i) => {
            setTimeout(() => { if (musicaActiva) tocarNotaPad(frec, 3.5, 0.05); }, i * 180);
        });
        acordeIndex++;

        const numNotas = 3 + Math.floor(Math.random() * 2); // 3-4 notas por ciclo: más vivo
        let demora = 200;
        for (let i = 0; i < numNotas; i++) {
            demora += 700 + Math.random() * 600;
            const nota = ESCALA_CALMA[Math.floor(Math.random() * ESCALA_CALMA.length)];
            setTimeout(() => { if (musicaActiva) tocarNotaMelodia(nota, 1.2, 0.06); }, demora);
        }
    }
    setTimeout(reproducirCicloMusical, 5000);
}

function iniciarMusica() {
    if (musicaIniciada) return;
    musicaIniciada = true;
    obtenerContextoMusica();
    reproducirCicloMusical();
}

function alternarMusica() {
    musicaActiva = !musicaActiva;
    const btn = document.getElementById('btnMusica');
    if (btn) btn.textContent = musicaActiva ? '🎵 Música' : '🔇 Música';
}

// Botón opcional para silenciar/activar, junto a los botones ya existentes del tablero
function crearBotonMusica() {
    const contenedor = document.querySelector('.botones-empate');
    if (!contenedor || document.getElementById('btnMusica')) return;
    const btn = document.createElement('button');
    btn.id = 'btnMusica';
    btn.type = 'button';
    btn.textContent = '🎵 Música';
    btn.addEventListener('click', alternarMusica);
    contenedor.appendChild(btn);
}
crearBotonMusica();

// Los navegadores bloquean el audio automático hasta que el usuario interactúa con la página,
// así que arrancamos la música en la primera interacción (clic o tecla) y la dejamos sonando siempre.
function manejarPrimeraInteraccion() {
    iniciarMusica();
    document.removeEventListener('click', manejarPrimeraInteraccion);
    document.removeEventListener('keydown', manejarPrimeraInteraccion);
}
document.addEventListener('click', manejarPrimeraInteraccion);
document.addEventListener('keydown', manejarPrimeraInteraccion);
