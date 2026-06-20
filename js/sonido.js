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
