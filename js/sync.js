console.log("✅ sync.js cargado");

// ------------------------------------------------------------------
// Multijugador en TIEMPO REAL, sin servidor propio y sin cuentas.
//
// Usa PeerJS (https://peerjs.com), que envuelve WebRTC: una vez que los dos
// navegadores se "presentan" entre sí, los datos viajan DIRECTO de un
// dispositivo al otro (peer-to-peer). El único servidor que interviene es el
// servidor gratuito público de PeerJS (0.peerjs.com), que SOLO sirve para que
// ambos jugadores se encuentren al inicio; las jugadas en sí nunca pasan por
// ningún servidor nuestro ni de terceros, así que no hay nada que "facturar".
//
// Flujo:
//  - Jugador 1 (anfitrión) genera un código corto de sala y lo comparte UNA
//    sola vez (por WhatsApp, etc.).
//  - Jugador 2 pega ese código y se conecta.
//  - A partir de ahí, cada jugada se transmite automáticamente en vivo.
// ------------------------------------------------------------------

const PEERJS_CDN_URLS = [
    'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js'
];

let peerConexion = null;       // instancia de Peer (mi extremo)
let canalDatos = null;         // DataConnection activa hacia el otro jugador
let onlineConectado = false;
let onlineRolAnfitrion = false; // true si yo generé el código (jugador 1)

function cargarScriptPeerJS(callback) {
    if (window.Peer) { callback(); return; }
    let intentos = 0;
    function intentarSiguiente() {
        if (intentos >= PEERJS_CDN_URLS.length) {
            callback(new Error('No se pudo cargar la librería de conexión (sin internet o CDN bloqueado).'));
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

// Genera un código de sala corto y fácil de compartir/teclear (6 caracteres).
function generarCodigoSala() {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos (0/O, 1/I)
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

// Envía el estado actual al otro jugador (se llama automáticamente tras cada jugada).
function transmitirEstadoSiOnline() {
    if (!CONFIG_JUEGO.online || !canalDatos || !onlineConectado) return;
    try { canalDatos.send({ tipo: 'estado', datos: estadoCompletoActual() }); } catch (e) {}
}

function configurarCanalDatos(conn) {
    canalDatos = conn;
    conn.on('open', () => {
        onlineConectado = true;
        actualizarEstadoConexionUI('🟢 Conectado con el otro jugador en tiempo real.');
        // El anfitrión (jugador 1) envía el estado inicial para sincronizar de entrada
        if (onlineRolAnfitrion) transmitirEstadoSiOnline();
    });
    conn.on('data', (mensaje) => {
        if (mensaje && mensaje.tipo === 'estado') {
            aplicarEstadoRecibido(mensaje.datos);
        } else if (mensaje && mensaje.tipo === 'rechazado') {
            actualizarEstadoConexionUI('⚠️ Esa sala ya tiene 2 jugadores conectados.');
            onlineConectado = false;
        }
    });
    conn.on('close', () => {
        onlineConectado = false;
        actualizarEstadoConexionUI('🔴 Se perdió la conexión con el otro jugador.');
    });
    conn.on('error', () => {
        actualizarEstadoConexionUI('⚠️ Error de conexión. Intenta reconectar.');
    });
}

function actualizarEstadoConexionUI(texto) {
    const el = document.getElementById('avisoOnline');
    if (el) el.textContent = texto;
}

// ------------------------------------------------------------------
// UI del panel "Partida online"
// ------------------------------------------------------------------
function configurarPanelOnline() {
    if (!CONFIG_JUEGO.online) return;
    const panel = document.getElementById('panelOnline');
    if (!panel) return;
    panel.style.display = 'flex';

    const miJugador = CONFIG_JUEGO.onlineSoyJugador;
    onlineRolAnfitrion = (miJugador === 0);

    const etiquetaMiJugador = document.getElementById('onlineMiJugador');
    if (etiquetaMiJugador) {
        etiquetaMiJugador.textContent = miJugador === 0 ? 'Eres: Jugador 1 (Rojo) — anfitrión' : 'Eres: Jugador 2 (Azul)';
    }

    actualizarEstadoConexionUI('⏳ Cargando conexión en tiempo real...');

    cargarScriptPeerJS((error) => {
        if (error) {
            actualizarEstadoConexionUI('⚠️ No se pudo cargar la conexión en tiempo real. Revisa tu internet y recarga la página.');
            return;
        }
        if (onlineRolAnfitrion) iniciarComoAnfitrion();
        else mostrarFormularioUnirse();
    });
}

function crearInstanciaPeer(idDeseado) {
    return new Peer(idDeseado, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        pingInterval: 5000
    });
}

function iniciarComoAnfitrion() {
    const panel = document.getElementById('panelOnline');
    const codigo = generarCodigoSala();
    const idCompleto = 'templos-' + codigo;

    actualizarEstadoConexionUI('⏳ Creando sala...');
    peerConexion = crearInstanciaPeer(idCompleto);

    peerConexion.on('open', () => {
        renderPanelAnfitrion(codigo);
    });
    peerConexion.on('connection', (conn) => {
        if (canalDatos && onlineConectado) {
            // Ya hay un jugador conectado: rechazamos cualquier otra conexión a esta sala
            conn.on('open', () => { conn.send({ tipo: 'rechazado' }); conn.close(); });
            return;
        }
        configurarCanalDatos(conn);
    });
    peerConexion.on('error', (err) => {
        if (err && err.type === 'unavailable-id') {
            // Colisión rarísima de código; reintentar con uno nuevo
            iniciarComoAnfitrion();
        } else {
            actualizarEstadoConexionUI('⚠️ Error al crear la sala: ' + (err && err.type ? err.type : 'desconocido'));
        }
    });
}

function renderPanelAnfitrion(codigo) {
    const panel = document.getElementById('panelOnline');
    if (!panel) return;
    const contenedorCodigo = document.getElementById('contenedorCodigoSala');
    if (contenedorCodigo) {
        contenedorCodigo.innerHTML = `
            <div style="font-size:0.68rem;color:#cbb892;margin-bottom:4px;">Comparte este código con el otro jugador (solo una vez):</div>
            <div style="font-size:1.3rem;font-weight:bold;letter-spacing:2px;text-align:center;background:#100b08;border-radius:8px;padding:8px;color:var(--oro-claro);">${codigo}</div>
        `;
    }
    actualizarEstadoConexionUI('🟠 Sala creada. Esperando a que el otro jugador se conecte...');
}

function mostrarFormularioUnirse() {
    const contenedorCodigo = document.getElementById('contenedorCodigoSala');
    if (contenedorCodigo) {
        contenedorCodigo.innerHTML = `
            <div style="font-size:0.68rem;color:#cbb892;margin-bottom:4px;">Pega el código que te compartió el Jugador 1:</div>
            <div style="display:flex;gap:4px;">
                <input id="inputCodigoUnirse" type="text" maxlength="6" placeholder="CÓDIGO"
                    style="flex:1;text-transform:uppercase;letter-spacing:2px;text-align:center;font-weight:bold;
                    padding:8px;border-radius:8px;border:1px solid #4a3424;background:#100b08;color:var(--oro-claro);">
                <button id="btnUnirseSala" style="white-space:nowrap;">Conectar</button>
            </div>
        `;
        const input = document.getElementById('inputCodigoUnirse');
        const btn = document.getElementById('btnUnirseSala');
        const intentar = () => {
            const codigo = (input.value || '').trim().toUpperCase();
            if (codigo.length < 4) return;
            unirseASala(codigo);
        };
        if (btn) btn.addEventListener('click', intentar);
        if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') intentar(); });
    }
    actualizarEstadoConexionUI('Introduce el código para conectarte.');
}

function unirseASala(codigo) {
    actualizarEstadoConexionUI('⏳ Conectando con la sala ' + codigo + '...');
    peerConexion = crearInstanciaPeer(undefined); // ID aleatorio para el invitado
    peerConexion.on('open', () => {
        const idHost = 'templos-' + codigo;
        const conn = peerConexion.connect(idHost, { reliable: true });
        conn.on('error', () => actualizarEstadoConexionUI('⚠️ No se encontró la sala. Verifica el código.'));
        configurarCanalDatos(conn);
    });
    peerConexion.on('error', (err) => {
        actualizarEstadoConexionUI('⚠️ Error de conexión: ' + (err && err.type ? err.type : 'desconocido'));
    });
}
