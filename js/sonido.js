console.log("✅ sonido.js cargado");

let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playTone(frec, dur, tipo = 'triangle', vol = 0.1) {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tipo; osc.frequency.value = frec;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + dur);
    } catch(e) {}
}

function sonidoMovimiento() { playTone(300, 0.1, 'triangle', 0.08); }
function sonidoSalto() { playTone(300, 0.1, 'triangle', 0.08); }
function sonidoEnroque() { playTone(400, 0.2, 'sine', 0.12); playTone(600, 0.2, 'sine', 0.12); }

// Aviso corto de jaque (dos tonos cortos y agudos)
function sonidoJaque() {
    playTone(880, 0.12, 'square', 0.1);
    setTimeout(() => playTone(988, 0.15, 'square', 0.1), 130);
}

// Pequeño "brillo" ascendente para cuando un peón va a coronar
function sonidoCoronacion() {
    playTone(523, 0.1, 'sine', 0.1);
    setTimeout(() => playTone(659, 0.1, 'sine', 0.1), 90);
    setTimeout(() => playTone(784, 0.18, 'sine', 0.1), 180);
}

// Aviso de poco tiempo en el reloj
function sonidoTiempoBajo() { playTone(220, 0.18, 'sawtooth', 0.08); }
