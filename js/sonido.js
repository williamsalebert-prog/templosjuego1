console.log("✅ sonido.js cargado");

// Vibración háptica corta en dispositivos táctiles (móvil), acompañando los
// sonidos clave del juego. navigator.vibrate no existe en iOS Safari ni en
// desktop, así que se comprueba antes de usarlo y simplemente no hace nada
// si no está disponible (no es un error).
function vibrar(patronMs) {
    try {
        if (navigator.vibrate) navigator.vibrate(patronMs);
    } catch (e) {}
}

let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

// Toca un tono con un poco de cuerpo (armónico suave + filtro), en vez de un
// oscilador puro y plano: se nota menos "synth de prueba" y más cercano a un
// golpe/clic con textura, sin necesitar archivos de audio externos.
function playTone(frec, dur, tipo = 'triangle', vol = 0.1) {
    try {
        const ctx = getAudioContext();
        const t0 = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tipo; osc.frequency.value = frec;
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

        // Armónico una octava arriba, mucho más suave: da algo de "cuerpo"
        // sin cambiar el tono percibido.
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = tipo; osc2.frequency.value = frec * 2;
        gain2.gain.setValueAtTime(vol * 0.18, t0);
        gain2.gain.exponentialRampToValueAtTime(0.0008, t0 + dur * 0.8);

        // Filtro paso-bajo suave: quita el borde más "digital" del tono puro.
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.value = Math.max(frec * 3, 800);

        osc.connect(gain); gain.connect(filtro);
        osc2.connect(gain2); gain2.connect(filtro);
        filtro.connect(ctx.destination);
        osc.start(t0); osc.stop(t0 + dur);
        osc2.start(t0); osc2.stop(t0 + dur * 0.8);
    } catch(e) {}
}

function sonidoMovimiento() { playTone(300, 0.1, 'triangle', 0.08); vibrar(12); }
function sonidoSalto() { playTone(300, 0.1, 'triangle', 0.08); vibrar(12); }
function sonidoEnroque() { playTone(400, 0.2, 'sine', 0.12); playTone(600, 0.2, 'sine', 0.12); vibrar([15,30,15]); }

// Aviso corto de jaque (dos tonos cortos y agudos)
function sonidoJaque() {
    playTone(880, 0.12, 'square', 0.1);
    setTimeout(() => playTone(988, 0.15, 'square', 0.1), 130);
    vibrar([20,40,20]);
}

// Pequeño "brillo" ascendente para cuando un peón va a coronar
function sonidoCoronacion() {
    playTone(523, 0.1, 'sine', 0.1);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.1), 90);
    setTimeout(() => playTone(784, 0.18, 'sine', 0.1), 180);
}

// Aviso de poco tiempo en el reloj
function sonidoTiempoBajo() { playTone(220, 0.18, 'sawtooth', 0.08); }

// Pitido de inicio de partida (suena después del countdown)
function sonidoInicio() {
    playTone(523, 0.1, "sine", 0.12);
    setTimeout(() => playTone(659, 0.1, "sine", 0.12), 100);
    setTimeout(() => playTone(784, 0.2, "sine", 0.15), 200);
}

// Pitido corto en cada número del conteo 3,2,1, para llamar la atención de
// ambos jugadores. El último (n=0, "¡Ya!") suena un poco más agudo y largo.
function sonidoCountdown(n) {
    if (n > 0) playTone(700, 0.15, 'square', 0.11);
    else playTone(950, 0.22, 'square', 0.13);
}

// Sonido de moneda lanzada al aire (sorteo de color): varios tintineos
// metálicos cortos y descendentes en volumen, simulando el repiqueteo de una
// moneda al girar y caer, en vez de un tono puro plano.
function sonidoMoneda() {
    const tintineos = [1800, 1500, 1700, 1300, 1600, 1100];
    tintineos.forEach((frec, i) => {
        setTimeout(() => playTone(frec, 0.08, 'triangle', 0.07 - i * 0.008), i * 180);
    });
}
