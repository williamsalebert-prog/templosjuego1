console.log("✅ interfaz.js cargado");

const NOMBRES_PIEZA = { F0: 'Torre', F1: 'Peón', F2: 'Caballo', F3: 'Reina', F4: 'Trampero', F5: 'Alfil', F6: 'Rey' };

let _toastTemporizador = null;
function mostrarToastJuego(mensaje, tipo = '') {
    const toast = document.getElementById('toastJuego');
    if (!toast) return;
    toast.textContent = mensaje;
    toast.className = `toast-juego mostrar${tipo ? ` ${tipo}` : ''}`;
    if (_toastTemporizador) clearTimeout(_toastTemporizador);
    _toastTemporizador = setTimeout(() => { toast.className = 'toast-juego'; }, 2600);
}
window.mostrarToastJuego = mostrarToastJuego;

function actualizarHUDContexto() {
    const hud = document.getElementById('hudContexto');
    const texto = document.getElementById('hudContextoTexto');
    if (!hud || !texto) return;
    let msg = '';
    let activo = false;
    let ruta = false;
    if (typeof juegoTerminado !== 'undefined' && juegoTerminado) {
        msg = 'Partida terminada · puedes revisar la posición final';
    } else if (typeof modoRuta !== 'undefined' && modoRuta && Array.isArray(rutasAlternativas) && rutasAlternativas.length) {
        msg = `Elige una de ${rutasAlternativas.length} rutas marcadas`; activo = true; ruta = true;
    } else if (typeof selectedPiece !== 'undefined' && selectedPiece) {
        const p = board?.[selectedPiece.fila]?.[selectedPiece.col];
        const nombre = p ? (NOMBRES_PIEZA[p.tipo] || 'Pieza') : 'Pieza';
        const n = Array.isArray(posiblesMovimientos) ? posiblesMovimientos.length : 0;
        msg = `${nombre} seleccionada · ${n} ${n === 1 ? 'destino legal' : 'destinos legales'}`; activo = true;
    } else if (typeof CONFIG_JUEGO !== 'undefined' && CONFIG_JUEGO.online && turno !== CONFIG_JUEGO.onlineSoyJugador) {
        msg = 'Esperando la jugada del rival';
    } else if (typeof CONFIG_JUEGO !== 'undefined' && CONFIG_JUEGO.modo === 1 && turno === 1) {
        msg = 'La IA está pensando…';
    } else {
        msg = `Turno de ${turno === 0 ? 'J1 · Rojo' : 'J2 · Azul'} · selecciona una pieza`;
    }
    texto.textContent = msg;
    hud.dataset.activo = activo ? '1' : '0';
    hud.dataset.ruta = ruta ? '1' : '0';
}
window.actualizarHUDContexto = actualizarHUDContexto;

function actualizarTurnoUI(analisisTurno = null) {
    const turnoTexto = document.getElementById('turnoTexto');
    if (!turnoTexto) return;
    // J1 / J2 compacto
    turnoTexto.textContent = turno === 0 ? 'J1' : 'J2';
    turnoTexto.classList.remove('turno-rojo', 'turno-azul');
    turnoTexto.classList.add(turno === 0 ? 'turno-rojo' : 'turno-azul');

    const estado = document.getElementById('estadoJuego');
    if (estado) {
        if (juegoTerminado) estado.textContent = 'Partida terminada';
        else if (analisisTurno ? analisisTurno.enJaque : esJaque(turno)) estado.textContent = '⚠️ Jaque';
        else estado.textContent = '';
    }
}

function actualizarContador() {
    // Ya no hay contador visible en la barra (eliminado para compactar)
}

function renderCarcelas() {
    const j0 = document.getElementById('capturasJ0');
    const j1 = document.getElementById('capturasJ1');
    if (!j0 && !j1) return;
    const capt = (typeof carcela !== 'undefined' && carcela && typeof carcela.obtenerTodas === 'function') ? carcela.obtenerTodas() : [];
    const formatear = (jugador) => {
        const conteo = new Map();
        for (const p of capt) if (p && p.jugador === jugador) conteo.set(p.tipo, (conteo.get(p.tipo) || 0) + 1);
        if (!conteo.size) return '—';
        const orden = ['F3','F0','F2','F5','F4','F1','F6'];
        return orden.filter(t => conteo.has(t)).map(t => `${(typeof SIMBOLO_PIEZA !== 'undefined' ? SIMBOLO_PIEZA[t] : t)}×${conteo.get(t)}`).join('  ');
    };
    if (j0) j0.textContent = formatear(0);
    if (j1) j1.textContent = formatear(1);
}

function actualizarInterfaz(analisisTurno = null) {
    actualizarTurnoUI(analisisTurno);
    actualizarContador();
    renderCarcelas();
    actualizarHUDContexto();
    document.dispatchEvent(new CustomEvent('templos:turnoActualizado'));
}

function registrarJugadaRealizada() {
    contadorJugadas++;
    const jugadorQueMovio = 1 - turno;
    jugadasPorJugador[jugadorQueMovio]++;
    if (typeof aplicarIncrementoTiempo === 'function') {
        aplicarIncrementoTiempo(jugadorQueMovio, jugadasPorJugador[jugadorQueMovio]);
    }
}
