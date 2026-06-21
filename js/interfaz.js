console.log("✅ interfaz.js cargado");

const NOMBRES_PIEZA = { F0: 'Torre', F1: 'Peón', F2: 'Caballo', F3: 'Reina', F4: 'Trampero', F5: 'Alfil', F6: 'Rey' };

function actualizarTurnoUI() {
    const turnoTexto = document.getElementById('turnoTexto');
    if (!turnoTexto) return;
    const nombre = turno === 0 ? 'Jugador 1 (Rojo)' : 'Jugador 2 (Azul)';
    turnoTexto.textContent = `Turno: ${nombre}`;
    turnoTexto.classList.remove('turno-rojo', 'turno-azul');
    turnoTexto.classList.add(turno === 0 ? 'turno-rojo' : 'turno-azul');

    const estado = document.getElementById('estadoJuego');
    if (estado) {
        if (juegoTerminado) estado.textContent = '';
        else if (esJaque(turno)) estado.textContent = '¡Jaque!';
        else estado.textContent = '';
    }
}

function actualizarContador() {
    const contador = document.getElementById('contadorJugadas');
    if (contador) contador.textContent = `Jugada: ${contadorJugadas}`;
}

// Abreviatura corta y legible para cada tipo de pieza, usada en las fichas agrupadas
// del panel de capturas (en vez de mostrar pieza por pieza, se agrupa por tipo).
const ABREV_PIEZA = { F0: 'T', F1: 'P', F2: 'C', F3: 'D', F4: 'Tr', F5: 'A', F6: 'R' };

function renderCarcelas() {
    const cont0 = document.getElementById('capturadasJ0');
    const cont1 = document.getElementById('capturadasJ1');
    if (!cont0 || !cont1) return;
    cont0.innerHTML = '';
    cont1.innerHTML = '';

    // Agrupar piezas capturadas por jugador y por tipo
    const grupos = { 0: {}, 1: {} };
    for (let pieza of carcela.obtenerTodas()) {
        const g = grupos[pieza.jugador];
        g[pieza.tipo] = (g[pieza.tipo] || 0) + 1;
    }

    const ordenTipos = ['F3', 'F0', 'F5', 'F2', 'F4', 'F1', 'F6'];

    function pintarGrupo(contenedor, grupo, claseColor) {
        let huboAlguna = false;
        for (let tipo of ordenTipos) {
            const cantidad = grupo[tipo];
            if (!cantidad) continue;
            huboAlguna = true;
            const item = document.createElement('div');
            item.className = `grupo-capturado ${claseColor}`;
            item.title = NOMBRES_PIEZA[tipo] || tipo;

            const icono = document.createElement('span');
            icono.className = 'gc-icono';
            icono.textContent = ABREV_PIEZA[tipo] || tipo;

            const etiqueta = document.createElement('span');
            etiqueta.className = 'gc-cantidad';
            etiqueta.textContent = `x${cantidad}`;

            item.appendChild(icono);
            item.appendChild(etiqueta);
            contenedor.appendChild(item);
        }
        if (!huboAlguna) {
            const vacio = document.createElement('span');
            vacio.className = 'gc-vacio';
            vacio.textContent = '—';
            contenedor.appendChild(vacio);
        }
    }

    pintarGrupo(cont0, grupos[0], 'cap-rojo');
    pintarGrupo(cont1, grupos[1], 'cap-azul');
}

// Llamar tras cada jugada completada (no en cada simulación interna)
function actualizarInterfaz() {
    actualizarTurnoUI();
    actualizarContador();
    renderCarcelas();
    document.dispatchEvent(new CustomEvent('templos:turnoActualizado'));
}

// Se llama una vez por jugada real (no por deshacer/rehacer) para avanzar el contador.
// IMPORTANTE: se llama DESPUÉS de que el turno ya pasó al siguiente jugador, así que
// "1 - turno" es quien acaba de mover.
function registrarJugadaRealizada() {
    contadorJugadas++;
    const jugadorQueMovio = 1 - turno;
    jugadasPorJugador[jugadorQueMovio]++;
    if (typeof aplicarIncrementoTiempo === 'function') {
        aplicarIncrementoTiempo(jugadorQueMovio, jugadasPorJugador[jugadorQueMovio]);
    }
}
