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

function renderCarcelas() {
    const cont0 = document.getElementById('capturadasJ0');
    const cont1 = document.getElementById('capturadasJ1');
    if (!cont0 || !cont1) return;
    cont0.innerHTML = '';
    cont1.innerHTML = '';
    for (let pieza of carcela.obtenerTodas()) {
        const span = document.createElement('span');
        span.className = 'pieza-capturada';
        span.title = NOMBRES_PIEZA[pieza.tipo] || pieza.tipo;
        span.textContent = pieza.tipo;
        if (pieza.jugador === 0) {
            span.classList.add('cap-rojo');
            cont0.appendChild(span);
        } else {
            span.classList.add('cap-azul');
            cont1.appendChild(span);
        }
    }
}

// Llamar tras cada jugada completada (no en cada simulación interna)
function actualizarInterfaz() {
    actualizarTurnoUI();
    actualizarContador();
    renderCarcelas();
}

// Se llama una vez por jugada real (no por deshacer/rehacer) para avanzar el contador
function registrarJugadaRealizada() {
    contadorJugadas++;
}
