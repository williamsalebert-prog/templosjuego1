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
        const t0 = ctx.currentTime;
        const salida = obtenerSalidaMusica();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = frec;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(vol, t0 + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duracion);
        osc.connect(gain);
        gain.connect(salida);
        osc.start(t0);
        osc.stop(t0 + duracion + 0.1);

        // Armónico suave una octava arriba para dar algo de cuerpo, igual
        // que en los efectos cortos (ver playTone en sonido.js), en vez de
        // dejar la melodía como un tono puro plano.
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.value = frec * 2;
        gain2.gain.setValueAtTime(0, t0);
        gain2.gain.linearRampToValueAtTime(vol * 0.15, t0 + 0.25);
        gain2.gain.exponentialRampToValueAtTime(0.0006, t0 + duracion * 0.8);
        osc2.connect(gain2);
        gain2.connect(salida);
        osc2.start(t0);
        osc2.stop(t0 + duracion + 0.1);
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

// El usuario puede pausar la música manualmente con el botón; esto es independiente
// de la pausa "de sistema" que se usa al terminar la partida (jaque mate / tablas).
let musicaPausadaPorUsuario = false;
let musicaPausadaPorSistema = false;

function alternarMusica() {
    if (!musicaIniciada) { iniciarMusica(); musicaPausadaPorUsuario = false; }
    else musicaPausadaPorUsuario = !musicaPausadaPorUsuario;
    musicaActiva = !musicaPausadaPorUsuario && !musicaPausadaPorSistema;
    const btn = document.getElementById('btnMusica');
    if (btn) btn.textContent = musicaActiva ? '🎵 Música' : '🔇 Música';

    // Botón del menú hamburguesa del tablero (tablero.html), si existe
    const menuBtn = document.getElementById('menuMusica');
    if (menuBtn) {
        const icono = menuBtn.querySelector('.mi-icon');
        if (icono) icono.textContent = musicaActiva ? '🎵' : '🔇';
    }
}

// Alias usado por tablero.html al pulsar "Música" en el menú. Antes el menú llamaba
// a una función toggleMusica() / window.musica.toggle() que nunca existió, por eso
// el botón no silenciaba nada.
window.toggleMusica = alternarMusica;

// Botón opcional para silenciar/activar. Puede ya existir en el HTML (tablero.html lo
// incluye), en cuyo caso solo le conectamos el evento; si no existe, lo creamos.
function crearBotonMusica() {
    let btn = document.getElementById('btnMusica');
    if (!btn) {
        const contenedor = document.querySelector('.botones-juego') || document.querySelector('.botones-empate');
        if (!contenedor) return;
        btn = document.createElement('button');
        btn.id = 'btnMusica';
        btn.type = 'button';
        btn.textContent = '🎵 Música';
        contenedor.appendChild(btn);
    }
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // evita que el manejador global de "primera interacción" pelee con el toggle
        alternarMusica();
    });
}
crearBotonMusica();

// Los navegadores bloquean el audio automático hasta que el usuario interactúa con la página,
// pero como el usuario YA interactuó (tocó un botón en index.html para llegar aquí), intentamos
// arrancar la música de inmediato: en la mayoría de navegadores esto basta para que el audio
// "se escuche desde que inicia la partida" en vez de quedar mudo hasta el primer toque al tablero
// (el countdown inicial bloquea el tablero, así que antes la música tardaba en empezar).
iniciarMusica();

// Respaldo: si el navegador igualmente bloqueó el audio (AudioContext en "suspended"),
// lo reanudamos en el primer toque/clic/tecla que ocurra en la página.
function manejarPrimeraInteraccion() {
    const ctx = obtenerContextoMusica();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (!musicaIniciada) iniciarMusica();
    document.removeEventListener('click', manejarPrimeraInteraccion);
    document.removeEventListener('keydown', manejarPrimeraInteraccion);
    document.removeEventListener('touchstart', manejarPrimeraInteraccion);
}
document.addEventListener('click', manejarPrimeraInteraccion);
document.addEventListener('keydown', manejarPrimeraInteraccion);
document.addEventListener('touchstart', manejarPrimeraInteraccion);

// ------------------------------------------------------------------
// Música especial de fin de partida: una más alegre/triunfal para la
// victoria por jaque mate, y otra más serena/neutra para las tablas.
// Pausan el ciclo normal (musicaPausadaPorSistema) y suenan una sola vez.
// ------------------------------------------------------------------
function pausarMusicaNormal() {
    musicaPausadaPorSistema = true;
    musicaActiva = false;
}

function reanudarMusicaNormal() {
    musicaPausadaPorSistema = false;
    musicaActiva = !musicaPausadaPorUsuario;
}

function reproducirVictoria() {
    pausarMusicaNormal();
    const ctx = obtenerContextoMusica();
    const fanfarria = [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50];
    let t = 0;
    fanfarria.forEach((frec, i) => {
        setTimeout(() => tocarNotaMelodia(frec, 0.5, 0.12), t);
        t += i === fanfarria.length - 2 ? 120 : 220;
    });
}

// Sonido triste/descendente para quien pierde la partida (jaque mate o tiempo agotado).
function reproducirDerrota() {
    pausarMusicaNormal();
    const notasTristes = [440.00, 392.00, 349.23, 311.13, 261.63];
    let t = 0;
    notasTristes.forEach((frec, i) => {
        setTimeout(() => tocarNotaMelodia(frec, 0.7, 0.09), t);
        t += 280;
    });
}

function reproducirTablas() {
    pausarMusicaNormal();
    const acorde = [349.23, 415.30, 523.25]; // Fa menor, sobrio/neutro
    acorde.forEach((frec, i) => setTimeout(() => tocarNotaPad(frec, 2.2, 0.08), i * 200));
    setTimeout(() => tocarNotaMelodia(349.23, 1.4, 0.07), 900);
}
