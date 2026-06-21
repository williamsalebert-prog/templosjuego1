console.log("✅ interfaz.js cargado");

const NOMBRES_PIEZA = { F0: 'Torre', F1: 'Peón', F2: 'Caballo', F3: 'Reina', F4: 'Trampero', F5: 'Alfil', F6: 'Rey' };

function actualizarTurnoUI() {
    const turnoTexto = document.getElementById('turnoTexto');
    if (!turnoTexto) return;
    // J1 / J2 compacto
    turnoTexto.textContent = turno === 0 ? 'J1' : 'J2';
    turnoTexto.classList.remove('turno-rojo', 'turno-azul');
    turnoTexto.classList.add(turno === 0 ? 'turno-rojo' : 'turno-azul');

    const estado = document.getElementById('estadoJuego');
    if (estado) {
        if (juegoTerminado) estado.textContent = '';
        else if (esJaque(turno)) estado.textContent = '⚠️ Jaque';
        else estado.textContent = '';
    }
}

function actualizarContador() {
    // Ya no hay contador visible en la barra (eliminado para compactar)
}

// Sin panel de capturas en la partida
function renderCarcelas() { /* capturas ocultas durante partida */ }

function actualizarInterfaz() {
    actualizarTurnoUI();
    actualizarContador();
    renderCarcelas();
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
