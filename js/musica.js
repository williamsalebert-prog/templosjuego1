console.log("✅ musica.js cargado");

// 🎵 Música de fondo tranquila y continua durante toda la partida.
// Generada de forma procedural con Web Audio API (no hay archivos de audio en el repo),
// con el mismo estilo de osciladores que sonido.js. Reutiliza su AudioContext si existe.

let musicaIniciada = false;
let musicaActiva = true;
let acordeIndex = 0;

function obtenerContextoMusica() {
    if (typeof getAudioContext === 'function') return getAudioContext();
    if (!window._musicaCtx) window._musicaCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (window._musicaCtx.state === 'suspended') window._musicaCtx.resume();
    return window._musicaCtx;
}

// Escala pentatónica suave (Do mayor) para la melodía ambiental
const ESCALA_CALMA = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];

// Acordes graves para el "pad" de fondo, en rotación lenta
const ACORDES_PAD = [
    [130.81, 164.81, 196.00], // Do mayor
    [146.83, 174.61, 220.00], // Re menor
    [174.61, 220.00, 261.63], // Fa mayor
    [196.00, 246.94, 293.66], // Sol mayor
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
        gain.connect(ctx.destination);
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
        gain.gain.linearRampToValueAtTime(vol, t0 + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duracion);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duracion + 0.1);
    } catch (e) {}
}

// Un ciclo = un acorde de fondo sostenido + un par de notas de melodía suave encima.
// Se reprograma a sí mismo indefinidamente, así que la música nunca se detiene.
function reproducirCicloMusical() {
    if (musicaActiva) {
        const acorde = ACORDES_PAD[acordeIndex % ACORDES_PAD.length];
        acorde.forEach(frec => tocarNotaPad(frec, 6, 0.025));
        acordeIndex++;

        const numNotas = 2 + Math.floor(Math.random() * 2); // 2-3 notas por ciclo
        let demora = 0;
        for (let i = 0; i < numNotas; i++) {
            demora += 1200 + Math.random() * 800;
            const nota = ESCALA_CALMA[Math.floor(Math.random() * ESCALA_CALMA.length)];
            setTimeout(() => { if (musicaActiva) tocarNotaMelodia(nota, 1.8, 0.035); }, demora);
        }
    }
    setTimeout(reproducirCicloMusical, 6000);
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
