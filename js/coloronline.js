console.log("✅ coloronline.js cargado");

// ============================================================================
// CONFIRMACIÓN / SORTEO DE COLOR AL UNIRSE A UNA SALA (J2)
// ============================================================================
// J2 ve, solo de forma informativa (no editable), qué color elegió J1 y qué
// tipo de partida (temporizador) va a jugarse. Por defecto se asume que está
// de acuerdo en que J1 juegue con el color que escogió ("Sí"). Si responde
// "No", se sortea el color al azar con una animación de moneda.
// ============================================================================

function mostrarConfirmacionColorJ2(colorJ1, timerMode, timerActivo) {
    const panel = document.getElementById('panelEsperaOnline');
    const box = document.getElementById('espeiraContenido');
    if (!box) return;
    if (panel) panel.classList.add('mostrar');

    const nombreColorJ1 = colorJ1 === 0 ? '🔴 Rojas' : '🔵 Azules';
    const nombreColorJ2 = colorJ1 === 0 ? '🔵 Azules' : '🔴 Rojas';
    const nombreModo = (typeof MODOS_TIEMPO !== 'undefined' && MODOS_TIEMPO[timerMode]) ? MODOS_TIEMPO[timerMode].nombre : timerMode;

    box.innerHTML = `
        <h3>🌐 Configuración de la partida</h3>
        <p style="margin-bottom:2px;">Tipo de partida: <b>${timerActivo ? nombreModo : 'Sin temporizador'}</b></p>
        <p style="margin-top:0;">El Jugador 1 jugará con: <b>${nombreColorJ1}</b></p>
        <p>Tú jugarías con: <b id="colorJ2Preview">${nombreColorJ2}</b></p>
        <p style="font-size:0.82rem;opacity:0.85;">¿Estás de acuerdo en que el Jugador 1 juegue con ${nombreColorJ1}?</p>
        <div class="modal-btns" style="justify-content:center;">
            <button class="modal-btn modal-btn-ok" id="btnAceptarColorJ2">Sí</button>
            <button class="modal-btn modal-btn-danger" id="btnRechazarColorJ2">No, sortear</button>
        </div>
        <div id="monedaContenedor" style="display:none;margin-top:10px;">
            <div id="monedaAnimada" aria-live="polite" aria-label="Lanzando moneda para decidir el color">🪙</div>
            <p id="monedaResultado" style="margin-top:6px;font-weight:bold;"></p>
        </div>
    `;

    document.getElementById('btnAceptarColorJ2').addEventListener('click', () => {
        confirmarColorFinal(colorJ1);
    });
    document.getElementById('btnRechazarColorJ2').addEventListener('click', () => {
        sortearColorConMoneda(colorJ1);
    });
}

function sortearColorConMoneda(colorJ1Propuesto) {
    document.getElementById('btnAceptarColorJ2').disabled = true;
    document.getElementById('btnRechazarColorJ2').disabled = true;
    const cont = document.getElementById('monedaContenedor');
    const moneda = document.getElementById('monedaAnimada');
    const resultado = document.getElementById('monedaResultado');
    if (cont) cont.style.display = 'block';

    const colorFinalJ1 = Math.random() < 0.5 ? 0 : 1; // 50/50, decide qué color le toca a J1

    if (moneda) {
        moneda.style.transition = 'transform 1.4s ease-out';
        moneda.style.transform = 'rotateY(1800deg)';
    }
    if (typeof sonidoMoneda === 'function') sonidoMoneda();

    setTimeout(() => {
        const nombreJ1 = colorFinalJ1 === 0 ? '🔴 Rojas' : '🔵 Azules';
        if (resultado) resultado.textContent = `¡La moneda decidió! Jugador 1 jugará con ${nombreJ1}.`;
        setTimeout(() => confirmarColorFinal(colorFinalJ1), 1200);
    }, 1500);
}

function confirmarColorFinal(colorFinalJ1) {
    if (canalDatos && onlineConectado) {
        try { canalDatos.send({ tipo: 'respuesta-color', colorJ1: colorFinalJ1 }); } catch(e) {}
    }
    // J2 ya puede calcular su propio rol con esto; el anfitrión (J1) hace lo
    // mismo al recibir 'respuesta-color' y desde ahí manda 'iniciar' a ambos.
    CONFIG_JUEGO.onlineSoyJugador = onlineRolAnfitrion ? colorFinalJ1 : (1 - colorFinalJ1);
}
