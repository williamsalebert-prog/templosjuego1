console.log("✅ analisis.js cargado");

// ============================================================================
// MENÚ DE ANÁLISIS (solo Modo Prueba)
// ============================================================================
// Reutiliza la pila de deshacer/rehacer que ya existe (historial.pila /
// historial.futuros) como la línea de tiempo completa de la partida: en
// cualquier momento, "jugada actual" = historial.pila.length, y el total de
// jugadas de la partida = historial.pila.length + historial.futuros.length.
//
// Sirve para dos cosas a la vez, como se pidió:
//   - Practicar/probar funciones del juego en Modo Prueba.
//   - Repasar visualmente una partida ya jugada o importada, jugada por
//     jugada o en reproducción automática, como un programa de análisis.
// ============================================================================

let analisisReproduciendo = false;
let analisisIntervalo = null;
let analisisVelocidadMs = 900; // tiempo entre jugadas en reproducción automática

function totalJugadasHistorial() {
    return historial.pila.length + historial.futuros.length;
}
function jugadaActualHistorial() {
    return historial.pila.length;
}

// Avanza una jugada (equivalente a "rehacer"/redo)
function analisisAvanzar() {
    if (!historial.puedeRehacer()) { pausarReproduccionAnalisis(); return false; }
    const estadoActual = { board: copiarBoard(), turno, enroqueRealizado: [...enroqueRealizado] };
    const siguiente = historial.rehacer(estadoActual);
    if (!siguiente) return false;
    aplicarEstadoDeHistorial(siguiente);
    return true;
}

// Retrocede una jugada (equivalente a "deshacer"/undo)
function analisisRetroceder() {
    if (!historial.puedeDeshacer()) return false;
    const estadoActual = { board: copiarBoard(), turno, enroqueRealizado: [...enroqueRealizado] };
    const anterior = historial.deshacer(estadoActual);
    if (!anterior) return false;
    aplicarEstadoDeHistorial(anterior);
    return true;
}

function aplicarEstadoDeHistorial(estado) {
    board = estado.board;
    turno = estado.turno;
    enroqueRealizado = estado.enroqueRealizado;
    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = [];
    coronacionPendiente = null;
    if (typeof menuCoronacion !== 'undefined' && menuCoronacion) menuCoronacion.style.display = 'none';
    dibujarTablero();
    actualizarPanelAnalisis();
}

function analisisIrAlInicio() {
    pausarReproduccionAnalisis();
    while (historial.puedeDeshacer()) analisisRetroceder();
}
function analisisIrAlFinal() {
    pausarReproduccionAnalisis();
    while (historial.puedeRehacer()) analisisAvanzar();
}

function alternarReproduccionAnalisis() {
    if (analisisReproduciendo) pausarReproduccionAnalisis();
    else iniciarReproduccionAnalisis();
}

function iniciarReproduccionAnalisis() {
    if (!historial.puedeRehacer()) return; // ya está en la última jugada
    analisisReproduciendo = true;
    actualizarBotonPlayAnalisis();
    analisisIntervalo = setInterval(() => {
        const avanzo = analisisAvanzar();
        if (!avanzo) pausarReproduccionAnalisis();
    }, analisisVelocidadMs);
}

function pausarReproduccionAnalisis() {
    analisisReproduciendo = false;
    if (analisisIntervalo) { clearInterval(analisisIntervalo); analisisIntervalo = null; }
    actualizarBotonPlayAnalisis();
}

function actualizarBotonPlayAnalisis() {
    const btn = document.getElementById('analisisBtnPlay');
    if (!btn) return;
    btn.textContent = analisisReproduciendo ? '⏸' : '▶';
    btn.setAttribute('aria-label', analisisReproduciendo ? 'Pausar reproducción' : 'Reproducir partida');
}

function cambiarVelocidadAnalisis(ms) {
    analisisVelocidadMs = ms;
    if (analisisReproduciendo) { pausarReproduccionAnalisis(); iniciarReproduccionAnalisis(); }
}

// Actualiza el texto "Jugada X / Y" y quién jugó esa jugada (alternado por
// turno: el estado guardado en pila[i] tiene el turno de quien JUGÓ la
// jugada i+1, ya que se guarda justo antes de aplicar el movimiento).
function actualizarPanelAnalisis() {
    const panel = document.getElementById('panelAnalisis');
    if (!panel) return;
    const actual = jugadaActualHistorial();
    const total = totalJugadasHistorial();
    const elNumero = document.getElementById('analisisNumeroJugada');
    const elJugador = document.getElementById('analisisJugador');
    if (elNumero) elNumero.textContent = `Jugada ${actual} / ${total}`;
    if (elJugador) {
        if (actual === 0) {
            elJugador.textContent = 'Posición inicial';
        } else {
            const turnoDeEsaJugada = historial.pila[actual - 1].turno;
            elJugador.textContent = turnoDeEsaJugada === 0 ? 'Jugó: Jugador 1 (Rojo)' : 'Jugó: Jugador 2 (Azul)';
        }
    }
    const btnAtras = document.getElementById('analisisBtnAtras');
    const btnAdelante = document.getElementById('analisisBtnAdelante');
    if (btnAtras) btnAtras.disabled = !historial.puedeDeshacer();
    if (btnAdelante) btnAdelante.disabled = !historial.puedeRehacer();
}

function configurarPanelAnalisis() {
    if (!CONFIG_JUEGO.modoPrueba) return;
    const panel = document.getElementById('panelAnalisis');
    if (panel) panel.style.display = 'flex';

    const btnInicio = document.getElementById('analisisBtnInicio');
    const btnAtras = document.getElementById('analisisBtnAtras');
    const btnPlay = document.getElementById('analisisBtnPlay');
    const btnAdelante = document.getElementById('analisisBtnAdelante');
    const btnFinal = document.getElementById('analisisBtnFinal');
    const selVelocidad = document.getElementById('analisisVelocidad');

    if (btnInicio) btnInicio.addEventListener('click', analisisIrAlInicio);
    if (btnAtras) btnAtras.addEventListener('click', () => { pausarReproduccionAnalisis(); analisisRetroceder(); });
    if (btnPlay) btnPlay.addEventListener('click', alternarReproduccionAnalisis);
    if (btnAdelante) btnAdelante.addEventListener('click', () => { pausarReproduccionAnalisis(); analisisAvanzar(); });
    if (btnFinal) btnFinal.addEventListener('click', analisisIrAlFinal);
    if (selVelocidad) selVelocidad.addEventListener('change', (e) => cambiarVelocidadAnalisis(parseInt(e.target.value, 10)));

    actualizarPanelAnalisis();
}

document.addEventListener('DOMContentLoaded', configurarPanelAnalisis);
if (document.readyState !== 'loading') configurarPanelAnalisis();
