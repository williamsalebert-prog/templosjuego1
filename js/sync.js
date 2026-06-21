console.log("✅ sync.js cargado");

const PEERJS_CDN_URLS = [
    'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js'
];

let peerConexion = null;
let canalDatos = null;
let onlineConectado = false;
let onlineRolAnfitrion = false;

function cargarScriptPeerJS(callback) {
    if (window.Peer) { callback(); return; }
    let intentos = 0;
    function intentarSiguiente() {
        if (intentos >= PEERJS_CDN_URLS.length) {
            callback(new Error('No se pudo cargar PeerJS'));
            return;
        }
        const url = PEERJS_CDN_URLS[intentos++];
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => callback();
        script.onerror = () => intentarSiguiente();
        document.head.appendChild(script);
    }
    intentarSiguiente();
}

function generarCodigoSala() {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = '';
    for (let i = 0; i < 6; i++) codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    return codigo;
}

function estadoCompletoActual() {
    return {
        v: 1,
        board: serializarBoard(board),
        turno,
        enroqueRealizado: [...enroqueRealizado],
        carcela: carcela.obtenerTodas().map(p => ({ tipo: p.tipo, jugador: p.jugador })),
        contadorJugadas,
        jugadasPorJugador: [...jugadasPorJugador],
        juegoTerminado,
        tiempoRestante: (typeof tiempoRestante !== 'undefined') ? [...tiempoRestante] : null,
        cronometro: (typeof cronometro !== 'undefined') ? [...cronometro] : null
    };
}

function aplicarEstadoRecibido(estado) {
    if (!estado || !Array.isArray(estado.board)) throw new Error('Estado inválido');
    board = deserializarBoard(estado.board);
    turno = estado.turno || 0;
    enroqueRealizado = estado.enroqueRealizado || [false, false];
    carcela.limpiar();
    (estado.carcela || []).forEach(c => {
        const Clase = piezasRegistradas.get(c.tipo);
        if (Clase) carcela.agregar(new Clase(c.jugador));
    });
    contadorJugadas = estado.contadorJugadas || 0;
    jugadasPorJugador = estado.jugadasPorJugador || [0, 0];
    if (estado.tiempoRestante && typeof tiempoRestante !== 'undefined') tiempoRestante = estado.tiempoRestante;
    if (estado.cronometro && typeof cronometro !== 'undefined') cronometro = estado.cronometro;

    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = []; destinoRuta = null;
    coronacionPendiente = null;
    if (typeof menuCoronacion !== 'undefined' && menuCoronacion) menuCoronacion.style.display = 'none';

    reiniciarFinJuego();
    if (esJaqueMate(turno)) { juegoTerminado = true; mostrarFinJuego('jaquemate', turno); }
    else if (esAhogado(turno)) { juegoTerminado = true; mostrarFinJuego('tablas', turno); }
    else if (estado.juegoTerminado) { juegoTerminado = true; }

    actualizarInterfaz();
    dibujarTablero();
    if (typeof pintarRelojes === 'function') pintarRelojes();
}

function transmitirEstadoSiOnline() {
    if (!CONFIG_JUEGO.online || !canalDatos || !onlineConectado) return;
    try { canalDatos.send({ tipo: 'estado', datos: estadoCompletoActual() }); } catch (e) {}
}

function configurarCanalDatos(conn) {
    canalDatos = conn;
    conn.on('open', () => {
        onlineConectado = true;
        // Ambos jugadores conectados: lanzar countdown y arrancar partida
        ocultarPanelEspera();
        if (onlineRolAnfitrion) {
            // Anfitrión manda señal de inicio
            try { canalDatos.send({ tipo: 'iniciar' }); } catch(e) {}
            lanzarInicioOnline();
        }
    });
    conn.on('data', (mensaje) => {
        if (mensaje && mensaje.tipo === 'estado') {
            aplicarEstadoRecibido(mensaje.datos);
        } else if (mensaje && mensaje.tipo === 'iniciar') {
            // Jugador 2 recibe señal: lanzar countdown
            lanzarInicioOnline();
        } else if (mensaje && mensaje.tipo === 'rechazado') {
            mostrarAvisoEspera('⚠️ Esa sala ya tiene 2 jugadores.');
        }
    });
    conn.on('close', () => {
        if (!juegoTerminado) {
            onlineConectado = false;
            if (typeof mostrarDesconexion === 'function') {
                mostrarDesconexion('El otro jugador se desconectó de la partida.');
            }
        }
    });
    conn.on('error', () => {
        mostrarAvisoEspera('⚠️ Error de conexión. Intenta de nuevo.');
    });
}

function lanzarInicioOnline() {
    window.tableroHabilitado = false;
    if (typeof window.arrancarCountdown === 'function') {
        window.arrancarCountdown(() => {
            if (typeof arrancarRelojes === 'function') arrancarRelojes();
        });
    } else {
        window.tableroHabilitado = true;
        if (typeof arrancarRelojes === 'function') arrancarRelojes();
    }
}

// ===== PANEL DE ESPERA (dentro del tablero) =====
function mostrarPanelEspera() {
    const panel = document.getElementById('panelEsperaOnline');
    if (panel) panel.classList.add('mostrar');
}
function ocultarPanelEspera() {
    const panel = document.getElementById('panelEsperaOnline');
    if (panel) panel.classList.remove('mostrar');
}
function mostrarAvisoEspera(txt) {
    const el = document.getElementById('avisoEspera');
    if (el) el.textContent = txt;
}

function configurarPanelOnline() {
    if (!CONFIG_JUEGO.online) return;

    const miJugador = CONFIG_JUEGO.onlineSoyJugador;
    onlineRolAnfitrion = (miJugador === 0);

    // Bloquear tablero hasta que ambos estén conectados
    window.tableroHabilitado = false;
    mostrarPanelEspera();

    cargarScriptPeerJS((error) => {
        if (error) {
            mostrarAvisoEspera('⚠️ Sin conexión. Revisa tu internet y recarga.');
            return;
        }
        if (onlineRolAnfitrion) iniciarComoAnfitrion();
        else renderFormularioUnirse();
    });
}

function crearInstanciaPeer(idDeseado) {
    return new Peer(idDeseado, {
        host: '0.peerjs.com', port: 443, path: '/',
        secure: true, pingInterval: 5000
    });
}

function iniciarComoAnfitrion() {
    // El código ya viene desde index.html via URL (lo generamos allá)
    // Si no viene, generamos uno aquí
    const params = new URLSearchParams(window.location.search);
    let codigo = params.get('sala') || generarCodigoSala();
    const idCompleto = 'templos-' + codigo;

    renderPanelAnfitrion(codigo);
    mostrarAvisoEspera('⏳ Creando sala...');

    peerConexion = crearInstanciaPeer(idCompleto);
    peerConexion.on('open', () => {
        mostrarAvisoEspera('🟠 Sala creada. Esperando al otro jugador...');
    });
    peerConexion.on('connection', (conn) => {
        if (canalDatos && onlineConectado) {
            conn.on('open', () => { conn.send({ tipo: 'rechazado' }); conn.close(); });
            return;
        }
        configurarCanalDatos(conn);
    });
    peerConexion.on('error', (err) => {
        if (err && err.type === 'unavailable-id') iniciarComoAnfitrion();
        else mostrarAvisoEspera('⚠️ Error: ' + (err && err.type ? err.type : 'desconocido'));
    });
}

function renderPanelAnfitrion(codigo) {
    const box = document.getElementById('espeiraContenido');
    if (!box) return;
    box.innerHTML = `
        <h3>🌐 Sala creada</h3>
        <p>Comparte este código con el otro jugador:</p>
        <div class="codigo-sala">${codigo}</div>
        <div id="avisoEspera" style="color:#cbb892;font-size:0.82rem;margin:8px 0;">⏳ Creando sala...</div>
        <p style="font-size:0.75rem;opacity:0.6;margin:0;">La partida comienza cuando el otro jugador se una.</p>
    `;
}

function renderFormularioUnirse() {
    const box = document.getElementById('espeiraContenido');
    if (!box) return;
    box.innerHTML = `
        <h3>🌐 Unirse a partida</h3>
        <p>Pega el código que te compartió el Jugador 1:</p>
        <input id="inputCodigoUnirse" class="input-codigo" type="text" maxlength="6" placeholder="CÓDIGO" autocomplete="off">
        <div id="avisoEspera" style="color:#cbb892;font-size:0.82rem;margin:6px 0;min-height:1.2em;"></div>
        <button class="espera-btn" id="btnConectarSala">Conectar ▶</button>
    `;

    const input = document.getElementById('inputCodigoUnirse');
    const btn = document.getElementById('btnConectarSala');
    if (input) input.addEventListener('input', () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
    });
    const intentar = () => {
        const codigo = (input ? input.value : '').trim().toUpperCase();
        if (codigo.length < 4) { mostrarAvisoEspera('⚠️ El código es demasiado corto.'); return; }
        if (btn) { btn.disabled = true; btn.textContent = 'Conectando...'; }
        unirseASala(codigo);
    };
    if (btn) btn.addEventListener('click', intentar);
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') intentar(); });
}

function unirseASala(codigo) {
    mostrarAvisoEspera('⏳ Conectando con sala ' + codigo + '...');
    peerConexion = crearInstanciaPeer(undefined);
    peerConexion.on('open', () => {
        const idHost = 'templos-' + codigo;
        const conn = peerConexion.connect(idHost, { reliable: true });
        conn.on('error', () => mostrarAvisoEspera('⚠️ No se encontró la sala. Verifica el código.'));
        configurarCanalDatos(conn);
    });
    peerConexion.on('error', (err) => {
        mostrarAvisoEspera('⚠️ Error: ' + (err && err.type ? err.type : 'desconocido'));
    });
}
