console.log("✅ sync.js cargado");

// Bandera para saber si la jugada en curso vino del rival (remota) o la hicimos
// nosotros (local). Se usa para no "hacer eco": solo quien originó la jugada
// transmite el movimiento y la sincronización de relojes.
window.jugadaEnCursoEsRemota = false;
window.coronacionRemotaEnEspera = null;
window.estadoRemotoPendiente = null;
window.relojesRemotosPendientes = null;
window.solicitudEstadoRemotaPendiente = false;
let ultimaSecuenciaRemotaAceptada = 0;

// Confirmación ligera de jugadas principales. PeerJS ya usa canal fiable, pero
// un ACK de aplicación nos permite detectar una caída justo en el peor instante
// y reintentar el mismo sobre de forma idempotente (el receptor descarta seq ya vistos).
const movimientosLocalesPendientes = new Map();
const REINTENTO_JUGADA_MS = 1200;
const MAX_REENVIOS_JUGADA = 2;


const PEERJS_CDN_URLS = [
    'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js'
];

let peerConexion = null;
let canalDatos = null;
let onlineConectado = false;
let onlineRolAnfitrion = false;
let conexionRechazadaPorSala = false;
const MAX_INTENTOS_CONEXION = 3;


// Estado de conexión visible y máquina de reconexión. Una partida online no
// debería obligar al jugador a adivinar si está conectado, sincronizando o
// intentando volver. Este estado también evita arrancar dos countdowns de
// reconexión por mensajes duplicados.
let estadoConexionOnlineActual = 'desconectado';
let reconexionIniciadaEn = 0;
let reconexionIntentos = 0;
let timerEstadoConexion = null;
let sincronizacionReconexionEnCurso = false;
let preparacionReconexionLanzada = false;
let idVerificacionSync = 0;
let ultimaSolicitudResyncEn = 0;
const BACKOFF_RECONEXION_MS = [900, 1500, 2500, 4000, 6500, 9000];

function formatearDuracionConexion(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const seg = total % 60;
    return m > 0 ? `${m}:${String(seg).padStart(2, '0')}` : `${seg}s`;
}

function actualizarEstadoConexionOnline(estado, detalle = '') {
    estadoConexionOnlineActual = estado;
    const el = document.getElementById('estadoConexionOnline');
    if (!el) return;
    const textos = {
        conectando: ['Conectando', '◌'],
        conectado: ['En línea', '●'],
        reconectando: ['Reconectando', '↻'],
        sincronizando: ['Sincronizando', '⇄'],
        desconectado: ['Sin conexión', '●'],
        error: ['Error de red', '!']
    };
    const [base, icono] = textos[estado] || [estado, '●'];
    el.dataset.estado = estado;
    el.hidden = !CONFIG_JUEGO.online;
    el.innerHTML = `<span class="conexion-punto">${icono}</span><span class="conexion-texto">${detalle || base}</span>`;
}

function iniciarRelojVisualReconexion() {
    if (timerEstadoConexion) clearInterval(timerEstadoConexion);
    timerEstadoConexion = setInterval(() => {
        if (!intentandoReconectar && !sincronizacionReconexionEnCurso) return;
        const transcurrido = reconexionIniciadaEn ? Date.now() - reconexionIniciadaEn : 0;
        const tiempo = formatearDuracionConexion(transcurrido);
        const texto = sincronizacionReconexionEnCurso ? `Sincronizando · ${tiempo}` : `Reconectando · ${tiempo}`;
        actualizarEstadoConexionOnline(sincronizacionReconexionEnCurso ? 'sincronizando' : 'reconectando', texto);
        const panelTiempo = document.getElementById('reconexionTiempo');
        const panelIntentos = document.getElementById('reconexionIntentos');
        if (panelTiempo) panelTiempo.textContent = tiempo;
        if (panelIntentos) panelIntentos.textContent = String(reconexionIntentos);
    }, 500);
}

function detenerRelojVisualReconexion() {
    if (timerEstadoConexion) { clearInterval(timerEstadoConexion); timerEstadoConexion = null; }
}

function marcarConexionRestaurada() {
    detenerRelojVisualReconexion();
    reconexionIniciadaEn = 0;
    reconexionIntentos = 0;
    sincronizacionReconexionEnCurso = false;
    actualizarEstadoConexionOnline('conectado', 'En línea');
    const btn = document.getElementById('btnReintentarDesconexion');
    if (btn) { btn.disabled = false; btn.textContent = '↻ Reintentar ahora'; }
}

function calcularEsperaReconexion() {
    const idx = Math.min(Math.max(0, reconexionIntentos - 1), BACKOFF_RECONEXION_MS.length - 1);
    return BACKOFF_RECONEXION_MS[idx];
}

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


function hashEstadoLogico(tablero = board, turnoEstado = turno, enroqueEstado = enroqueRealizado, contadorEstado = contadorJugadas, jugadasEstado = jugadasPorJugador) {
    // Hash ligero y determinista. No pretende ser criptográfico: sirve para
    // detectar que ambos clientes creen estar en la misma posición antes de
    // aplicar una jugada y para descubrir divergencias tras una reconexión.
    let h = 2166136261 >>> 0;
    const alimentar = (n) => {
        h ^= n & 0xff;
        h = Math.imul(h, 16777619) >>> 0;
    };
    alimentar(turnoEstado + 17);
    // El número de jugadas también forma parte del estado lógico: en modo
    // clásico controla cuándo se concede el bono de la jugada 40. Dos tableros
    // visualmente iguales pero en momentos distintos de la partida no son
    // necesariamente equivalentes.
    const nContador = Number(contadorEstado) || 0;
    alimentar(nContador & 0xff); alimentar((nContador >>> 8) & 0xff);
    const j0 = Number(jugadasEstado?.[0]) || 0, j1 = Number(jugadasEstado?.[1]) || 0;
    alimentar(j0 & 0xff); alimentar((j0 >>> 8) & 0xff);
    alimentar(j1 & 0xff); alimentar((j1 >>> 8) & 0xff);
    alimentar(enroqueEstado?.[0] ? 1 : 0);
    alimentar(enroqueEstado?.[1] ? 1 : 0);
    for (let f = 0; f < FILAS; f++) {
        for (let c = 0; c < COLUMNAS; c++) {
            const p = tablero[f][c];
            if (!p) { alimentar(0); continue; }
            alimentar((parseInt(p.tipo.slice(1), 10) || 0) + 1);
            alimentar(p.jugador + 1);
            alimentar(p.haMovido ? 1 : 0);
        }
    }
    return h.toString(16).padStart(8, '0');
}

function solicitarResincronizacionOnline(motivo = 'desfase') {
    if (!canalDatos || !onlineConectado) return;
    const ahora = Date.now();
    // Varios síntomas del mismo desfase pueden dispararse en el mismo frame
    // (hash, reloj, secuencia). Una sola solicitud basta; evita tormentas de
    // snapshots que antes podían empeorar una conexión ya inestable.
    if (ahora - ultimaSolicitudResyncEn < 450) return;
    ultimaSolicitudResyncEn = ahora;
    if (sincronizacionReconexionEnCurso) actualizarEstadoConexionOnline('sincronizando', 'Corrigiendo desfase');
    try { canalDatos.send({ tipo: 'solicitar-estado', motivo, contadorJugadas, hash: hashEstadoLogico() }); } catch (e) {}
}

function estadoCompletoActual() {
    return {
        v: 3,
        board: serializarBoard(board),
        turno,
        enroqueRealizado: [...enroqueRealizado],
        carcela: carcela.obtenerTodas().map(p => ({ tipo: p.tipo, jugador: p.jugador })),
        contadorJugadas,
        jugadasPorJugador: [...jugadasPorJugador],
        juegoTerminado,
        tiempoRestante: (typeof tiempoRestante !== 'undefined') ? [...tiempoRestante] : null,
        cronometro: (typeof cronometro !== 'undefined') ? [...cronometro] : null,
        avisoBajoTiempoDado: (typeof avisoBajoTiempoDado !== 'undefined') ? [...avisoBajoTiempoDado] : null,
        bonoJugadaAplicado: (typeof bonoJugadaAplicado !== 'undefined') ? [...bonoJugadaAplicado] : null,
        timer: !!CONFIG_JUEGO.timer,
        timerMode: CONFIG_JUEGO.timerMode,
        onlinePartidaIniciada: !!window.onlinePartidaIniciada,
        notacion: (typeof listaNotacionPartida !== 'undefined') ? [...listaNotacionPartida] : [],
        hash: hashEstadoLogico()
    };
}

function aplicarEstadoRecibido(estado, forzar = false) {
    if (!estado || !Array.isArray(estado.board) || estado.board.length !== FILAS || estado.board.some(f => !Array.isArray(f) || f.length !== COLUMNAS)) {
        console.warn('Estado online inválido descartado');
        return false;
    }
    // Nunca sustituir el board bajo los pies de requestAnimationFrame: el final
    // de esa animación volvería a escribir su pieza encima del estado recibido.
    if (!forzar && typeof animando !== 'undefined' && animando) {
        window.estadoRemotoPendiente = estado;
        return false;
    }
    // La configuración compartida del reloj pertenece a la partida, no a
    // preferencias locales del dispositivo. Se restaura ANTES de pintar los
    // tiempos para que una recarga no vuelva accidentalmente al modo de la URL.
    // En online el anfitrión es la autoridad de configuración. Puede adoptar
    // un tablero más avanzado del invitado tras una caída sin permitir que un
    // caché viejo del invitado cambie accidentalmente el ritmo de la sala.
    const puedeAdoptarConfigCompartida = !CONFIG_JUEGO.online || !onlineRolAnfitrion;
    if (puedeAdoptarConfigCompartida && typeof estado.timer === 'boolean') CONFIG_JUEGO.timer = estado.timer;
    if (puedeAdoptarConfigCompartida && estado.timerMode && MODOS_TIEMPO[estado.timerMode]) CONFIG_JUEGO.timerMode = estado.timerMode;
    if (typeof modoTiempoActual !== 'undefined') modoTiempoActual = MODOS_TIEMPO[CONFIG_JUEGO.timerMode] || MODOS_TIEMPO.blitz5;
    if (typeof estado.onlinePartidaIniciada === 'boolean') window.onlinePartidaIniciada = estado.onlinePartidaIniciada;

    let boardRecibido;
    try {
        boardRecibido = deserializarBoard(estado.board);
    } catch (e) {
        console.warn('Estado online con piezas inválidas descartado');
        return false;
    }
    const turnoRecibido = Number.isFinite(Number(estado.turno)) ? Number(estado.turno) : 0;
    const enroqueRecibido = Array.isArray(estado.enroqueRealizado) ? [...estado.enroqueRealizado] : [false, false];
    const contadorRecibido = Number(estado.contadorJugadas) || 0;
    const jugadasRecibidas = Array.isArray(estado.jugadasPorJugador) ? [...estado.jugadasPorJugador] : [0, 0];
    if (estado.hash && Number(estado.v || 0) >= 3) {
        const hashRecibidoCalculado = hashEstadoLogico(boardRecibido, turnoRecibido, enroqueRecibido, contadorRecibido, jugadasRecibidas);
        if (hashRecibidoCalculado !== estado.hash) {
            console.warn('Estado online con hash inválido descartado');
            return false;
        }
    }

    board = boardRecibido;
    turno = turnoRecibido;
    enroqueRealizado = enroqueRecibido;
    carcela.limpiar();
    (estado.carcela || []).forEach(c => {
        const Clase = piezasRegistradas.get(c.tipo);
        if (Clase) carcela.agregar(new Clase(c.jugador));
    });
    contadorJugadas = contadorRecibido;
    ultimaSecuenciaRemotaAceptada = contadorJugadas;
    jugadasPorJugador = jugadasRecibidas;
    if (Array.isArray(estado.tiempoRestante) && typeof tiempoRestante !== 'undefined') tiempoRestante = [...estado.tiempoRestante];
    if (Array.isArray(estado.cronometro) && typeof cronometro !== 'undefined') cronometro = [...estado.cronometro];
    if (typeof avisoBajoTiempoDado !== 'undefined') {
        if (Array.isArray(estado.avisoBajoTiempoDado)) avisoBajoTiempoDado = [...estado.avisoBajoTiempoDado];
        else if (Array.isArray(estado.tiempoRestante)) avisoBajoTiempoDado = estado.tiempoRestante.map(t => Number(t) <= 20);
    }
    if (typeof bonoJugadaAplicado !== 'undefined') {
        if (Array.isArray(estado.bonoJugadaAplicado)) bonoJugadaAplicado = [...estado.bonoJugadaAplicado];
        else {
            const bono = (MODOS_TIEMPO[CONFIG_JUEGO.timerMode] || {}).bonoJugada;
            bonoJugadaAplicado = bono ? jugadasRecibidas.map(n => Number(n) >= bono.jugada) : [false, false];
        }
    }
    if (typeof reiniciarNotacionPartida === 'function' && Array.isArray(estado.notacion)) reiniciarNotacionPartida(estado.notacion);

    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = []; destinoRuta = null;
    coronacionPendiente = null;
    window.jugadaEnCursoEsRemota = false;
    window.coronacionRemotaEnEspera = null;
    window.relojesRemotosPendientes = null;
    window.solicitudEstadoRemotaPendiente = false;
    limpiarTodosMovimientosLocalesPendientes();
    if (typeof menuCoronacion !== 'undefined' && menuCoronacion) menuCoronacion.style.display = 'none';

    reiniciarFinJuego(true);
    const analisisSync = analizarEstadoTurno(turno, board);
    if (typeof fijarCacheJaqueVisual === 'function') fijarCacheJaqueVisual(analisisSync, turno);
    if (analisisSync.jaqueMate) { juegoTerminado = true; mostrarFinJuego('jaquemate', turno); }
    else if (analisisSync.ahogado) { juegoTerminado = true; mostrarFinJuego('tablas', turno); }
    else if (estado.juegoTerminado) { juegoTerminado = true; }

    actualizarInterfaz(analisisSync);
    dibujarTablero();
    const panelRelojesSync = document.getElementById('panelRelojes');
    if (panelRelojesSync) panelRelojesSync.style.display = CONFIG_JUEGO.timer ? 'flex' : 'none';
    if (typeof pintarRelojes === 'function') pintarRelojes();
    return true;
}

function responderEstadoActualOnline() {
    if (!CONFIG_JUEGO.online || !canalDatos || !onlineConectado) return false;
    if (animando || coronacionPendiente) {
        window.solicitudEstadoRemotaPendiente = true;
        return false;
    }
    try {
        canalDatos.send({ tipo: 'estado', datos: estadoCompletoActual() });
        window.solicitudEstadoRemotaPendiente = false;
        return true;
    } catch (e) { return false; }
}

function responderSolicitudEstadoPendienteSiExiste() {
    if (!window.solicitudEstadoRemotaPendiente) return false;
    return responderEstadoActualOnline();
}

// Una reconexión puede abrirse justo mientras una pieza está en plena animación
// (en ese instante la pieza móvil no está físicamente en `board`).  Esperamos a
// que el estado vuelva a ser estable antes de anunciar el snapshot para no
// sincronizar accidentalmente una posición intermedia.
function enviarInfoReconexionCuandoEstable(conn) {
    if (!conn || conn !== canalDatos || !onlineConectado) return;
    if (animando || coronacionPendiente) {
        setTimeout(() => enviarInfoReconexionCuandoEstable(conn), 80);
        return;
    }
    try {
        conn.send({
            tipo: 'reconexion-info',
            contadorJugadas,
            hash: hashEstadoLogico(),
            estado: estadoCompletoActual()
        });
    } catch (e) {}
}

function transmitirEstadoSiOnline() {
    responderEstadoActualOnline();
}

// Sincroniza solo los relojes/cronómetro tras una jugada local (la jugada en sí
// ya viajó por transmitirMovimientoSiOnline, con su propia animación y sonido).
function transmitirRelojesSiOnline() {
    if (window.jugadaEnCursoEsRemota) {
        // La jugada remota ya aplicó localmente su incremento. Si el paquete
        // autoritativo de relojes llegó durante la animación, recién ahora lo
        // aplicamos para no sumar el incremento dos veces.
        window.jugadaEnCursoEsRemota = false;
        aplicarRelojesRemotosPendientesSiExisten();
        return;
    }
    if (!CONFIG_JUEGO.online || !canalDatos || !onlineConectado) return;
    try {
        canalDatos.send({
            tipo: 'relojes',
            seq: contadorJugadas,
            hash: hashEstadoLogico(),
            tiempoRestante: (typeof tiempoRestante !== 'undefined') ? [...tiempoRestante] : null,
            cronometro: (typeof cronometro !== 'undefined') ? [...cronometro] : null
        });
    } catch (e) {}
}

// --- Propuestas de tablas/rendición (ver js/tablasrendicion.js) ---
function transmitirPropuesta(tipo) {
    if (!canalDatos || !onlineConectado) return;
    try { canalDatos.send({ tipo: 'propuesta', subtipo: tipo, de: CONFIG_JUEGO.onlineSoyJugador }); } catch (e) {}
}
function transmitirRespuestaPropuesta(acepta) {
    if (!canalDatos || !onlineConectado) return;
    try { canalDatos.send({ tipo: 'respuestaPropuesta', acepta }); } catch (e) {}
}
function transmitirCancelarPropuesta() {
    if (!canalDatos || !onlineConectado) return;
    try { canalDatos.send({ tipo: 'cancelarPropuesta' }); } catch (e) {}
}
function transmitirRendicion(quienSeRinde) {
    if (!canalDatos || !onlineConectado) return;
    try { canalDatos.send({ tipo: 'rendicion', quienSeRinde }); } catch (e) {}
}
function transmitirFinTiempoOnline(jugadorSinTiempo) {
    if (!CONFIG_JUEGO.online || !canalDatos || !onlineConectado) return;
    try {
        canalDatos.send({
            tipo: 'fin-tiempo',
            jugador: jugadorSinTiempo,
            seq: contadorJugadas,
            hash: hashEstadoLogico()
        });
    } catch (e) {}
}
window.transmitirFinTiempoOnline = transmitirFinTiempoOnline;
function canalDatosActivo() { return !!(canalDatos && onlineConectado); }


function limpiarMovimientoLocalPendiente(seq) {
    const pendiente = movimientosLocalesPendientes.get(seq);
    if (!pendiente) return;
    if (pendiente.timer) clearTimeout(pendiente.timer);
    movimientosLocalesPendientes.delete(seq);
}

function limpiarTodosMovimientosLocalesPendientes() {
    for (const seq of [...movimientosLocalesPendientes.keys()]) limpiarMovimientoLocalPendiente(seq);
}

function programarReenvioJugada(sobre) {
    if (!Number.isFinite(Number(sobre?.seq))) return;
    const seq = Number(sobre.seq);
    limpiarMovimientoLocalPendiente(seq);
    const pendiente = { sobre, intentos: 0, timer: null };
    movimientosLocalesPendientes.set(seq, pendiente);

    const programar = () => {
        pendiente.timer = setTimeout(() => {
            if (!movimientosLocalesPendientes.has(seq)) return;
            if (!onlineConectado || !canalDatos) return;
            if (pendiente.intentos >= MAX_REENVIOS_JUGADA) {
                limpiarMovimientoLocalPendiente(seq);
                solicitarResincronizacionOnline('jugada-sin-confirmacion');
                return;
            }
            pendiente.intentos++;
            try { canalDatos.send(pendiente.sobre); } catch (e) {}
            programar();
        }, REINTENTO_JUGADA_MS);
    };
    programar();
}

function confirmarRecepcionJugada(seq) {
    if (!canalDatos || !onlineConectado || !Number.isFinite(Number(seq))) return;
    try { canalDatos.send({ tipo: 'ack-jugada', seq: Number(seq) }); } catch (e) {}
}

function pasosIguales(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        const pa = a[i], pb = b[i];
        if (!pa || !pb || pa.tipo !== pb.tipo) return false;
        for (const campo of ['over', 'to']) {
            const xa = pa[campo], xb = pb[campo];
            if (Array.isArray(xa) || Array.isArray(xb)) {
                if (!Array.isArray(xa) || !Array.isArray(xb) || xa[0] !== xb[0] || xa[1] !== xb[1]) return false;
            }
        }
    }
    return true;
}

function rutasDeInfoMovimiento(info) {
    if (!Array.isArray(info)) return [];
    if (info.length > 0 && info[0] && Object.prototype.hasOwnProperty.call(info[0], 'pasos')) {
        return info.map(r => r.pasos).filter(Array.isArray);
    }
    return [info];
}

// El cliente remoto ya no confía ciegamente en origen/destino/camino recibidos.
// Comprueba que esa ruta existe entre sus propias jugadas legales antes de animarla.
function validarMovimientoRemoto(jugada, jugadorRemoto) {
    if (!jugada || !Array.isArray(jugada.origen) || !Array.isArray(jugada.destino) || !Array.isArray(jugada.camino)) return false;
    const [f, c] = jugada.origen;
    const [df, dc] = jugada.destino;
    if (f < 0 || f >= FILAS || c < 0 || c >= COLUMNAS || df < 0 || df >= FILAS || dc < 0 || dc >= COLUMNAS) return false;
    if (turno !== jugadorRemoto) return false;
    const pieza = board[f]?.[c];
    if (!pieza || pieza.jugador !== jugadorRemoto) return false;

    const res = pieza.obtenerMovimientos(f, c, board);
    const filtrado = filtrarMovimientosJaque({ fila: f, col: c }, [...res.destinos], res.caminos, board, jugadorRemoto);
    const existeDestino = filtrado.posiblesMovimientos.some(m => Array.isArray(m) && m[0] === df && m[1] === dc);
    if (!existeDestino) return false;
    const rutas = rutasDeInfoMovimiento(filtrado.caminosDestino[`${df},${dc}`]);
    return rutas.some(r => pasosIguales(r, jugada.camino));
}

function aplicarPaqueteRelojesRemotos(mensaje) {
    if (!mensaje) return false;
    const seq = Number(mensaje.seq);
    if (Number.isFinite(seq)) {
        if (seq < contadorJugadas) return false; // paquete viejo
        if (seq > contadorJugadas) {
            window.relojesRemotosPendientes = mensaje;
            return false;
        }
        if (mensaje.hash && mensaje.hash !== hashEstadoLogico()) {
            solicitarResincronizacionOnline('hash-posterior-no-coincide');
            return false;
        }
    }
    if (mensaje.tiempoRestante && typeof tiempoRestante !== 'undefined') tiempoRestante = [...mensaje.tiempoRestante];
    if (mensaje.cronometro && typeof cronometro !== 'undefined') cronometro = [...mensaje.cronometro];
    if (typeof pintarRelojes === 'function') pintarRelojes();
    return true;
}

function aplicarRelojesRemotosPendientesSiExisten() {
    if (!window.relojesRemotosPendientes) return false;
    const paquete = window.relojesRemotosPendientes;
    window.relojesRemotosPendientes = null;
    return aplicarPaqueteRelojesRemotos(paquete);
}

function aplicarEstadoRemotoPendienteSiExiste() {
    if (!window.estadoRemotoPendiente || animando) return false;
    const estado = window.estadoRemotoPendiente;
    window.estadoRemotoPendiente = null;
    aplicarEstadoRecibido(estado, true);
    return true;
}

// Transmite la JUGADA concreta (no solo el resultado final) para que el rival
// reproduzca la misma animación y los mismos sonidos en su pantalla, en vez de
// solo ver el tablero "saltar" al estado final sin animación ni audio.
function transmitirMovimientoSiOnline(jugada, hashAntesForzado = null) {
    if (!CONFIG_JUEGO.online || !canalDatos || !onlineConectado) return;
    const esMovimientoPrincipal = jugada && (jugada.tipo === 'mover' || jugada.tipo === 'enroque');
    const esCoronacion = jugada && jugada.tipo === 'coronar';
    const sobre = { tipo: 'jugada', jugada };
    if (esMovimientoPrincipal) {
        sobre.seq = contadorJugadas + 1;
        sobre.hashAntes = hashAntesForzado || hashEstadoLogico();
    } else if (esCoronacion) {
        // La coronación pertenece a la misma jugada principal: todavía no se
        // incrementó contadorJugadas cuando se elige la nueva pieza.
        sobre.seq = contadorJugadas + 1;
    }
    try {
        canalDatos.send(sobre);
        if (esMovimientoPrincipal) programarReenvioJugada(sobre);
    } catch (e) {}
}

// Aplica en este dispositivo una jugada que llegó del rival, reproduciendo la
// animación y el sonido correspondientes (igual que si la hubiéramos hecho
// nosotros), en vez de limitarnos a redibujar el tablero ya resuelto.
function aplicarJugadaRemota(jugada, seq = null) {
    if (!jugada) return false;
    const jugadorRemoto = 1 - CONFIG_JUEGO.onlineSoyJugador;

    if (jugada.tipo === 'mover') {
        if (!validarMovimientoRemoto(jugada, jugadorRemoto)) return false;
        window.jugadaEnCursoEsRemota = true;
        return aplicarMovimiento(jugada.origen, jugada.destino, jugada.camino, true) !== false;
    }
    if (jugada.tipo === 'enroque') {
        if (turno !== jugadorRemoto || jugada.jugador !== jugadorRemoto) return false;
        window.jugadaEnCursoEsRemota = true;
        if (!ejecutarEnroque(jugada.reyFila, jugada.reyCol, jugada.piezaFila, jugada.piezaCol, jugada.jugador)) return false;
        turno = 1 - turno;
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        dibujarTablero();
        if (typeof despuesDeJugada === 'function') despuesDeJugada();
        return true;
    }
    if (jugada.tipo === 'coronar') {
        const tiposValidos = new Set(['F0','F2','F3','F4','F5']);
        if (!tiposValidos.has(jugada.piezaTipo)) return false;
        const nseq = Number(seq);
        if (Number.isFinite(nseq) && nseq <= contadorJugadas) return true; // duplicado tardío
        if (Number.isFinite(nseq) && nseq !== ultimaSecuenciaRemotaAceptada) return false;

        if (coronacionPendiente && coronacionPendiente.jugador === jugadorRemoto) {
            coronar(jugada.piezaTipo, true);
            return true;
        }
        if (animando && window.jugadaEnCursoEsRemota) {
            window.coronacionRemotaEnEspera = { piezaTipo: jugada.piezaTipo, seq: Number.isFinite(nseq) ? nseq : null };
            return true;
        }
        return false;
    }
    return false;
}

function manejarMensajeCanalDatos(mensaje) {
    if (mensaje && mensaje.tipo === 'sync-check') {
        procesarSyncCheck(mensaje);
        return;
    }
    if (mensaje && mensaje.tipo === 'sync-check-ok') {
        procesarSyncCheckOk(mensaje);
        return;
    }
    if (mensaje && mensaje.tipo === 'jugada') {
        const jugada = mensaje.jugada;
        const esPrincipal = jugada && (jugada.tipo === 'mover' || jugada.tipo === 'enroque');
        const seq = Number(mensaje.seq);

        if (esPrincipal) {
            const esperada = contadorJugadas + 1;
            const yaVista = Math.max(contadorJugadas, ultimaSecuenciaRemotaAceptada);

            if (Number.isFinite(seq) && seq <= yaVista) {
                // El sobre puede ser un reenvío porque nuestro ACK se perdió.
                confirmarRecepcionJugada(seq);
                return;
            }
            if (animando || coronacionPendiente) {
                solicitarResincronizacionOnline('jugada-recibida-durante-otra-jugada');
                return;
            }
            if ((Number.isFinite(seq) && seq !== esperada) ||
                (mensaje.hashAntes && mensaje.hashAntes !== hashEstadoLogico())) {
                solicitarResincronizacionOnline('jugada-fuera-de-secuencia');
                return;
            }

            // Primero validamos/aplicamos; solo después marcamos la secuencia
            // como aceptada. Un paquete ilegal no puede "quemar" un número.
            if (!aplicarJugadaRemota(jugada, seq)) {
                window.jugadaEnCursoEsRemota = false;
                solicitarResincronizacionOnline('jugada-remota-invalida');
                return;
            }
            if (Number.isFinite(seq)) {
                ultimaSecuenciaRemotaAceptada = seq;
                confirmarRecepcionJugada(seq);
            }
            return;
        }

        // Mensaje complementario (por ahora coronación).
        if (!aplicarJugadaRemota(jugada, seq)) solicitarResincronizacionOnline('complemento-remoto-invalido');
    } else if (mensaje && mensaje.tipo === 'solicitar-estado') {
        // Nunca enviar un snapshot a mitad de una animación: durante esos ms la
        // pieza móvil está temporalmente fuera del board y el estado sería inválido.
        responderEstadoActualOnline();
    } else if (mensaje && mensaje.tipo === 'ack-jugada') {
        limpiarMovimientoLocalPendiente(Number(mensaje.seq));
    } else if (mensaje && mensaje.tipo === 'relojes') {
        if (animando || coronacionPendiente || window.jugadaEnCursoEsRemota) {
            window.relojesRemotosPendientes = mensaje;
        } else {
            aplicarPaqueteRelojesRemotos(mensaje);
        }
    } else if (mensaje && mensaje.tipo === 'propuesta') {
        window.partidaPausadaPorPropuesta = true;
        if (mensaje.subtipo === 'tablas' && typeof mostrarPropuestaRecibida === 'function') {
            mostrarPropuestaRecibida('tablas', CONFIG_JUEGO.onlineSoyJugador);
        }
    } else if (mensaje && mensaje.tipo === 'respuestaPropuesta') {
        if (typeof aplicarResultadoPropuesta === 'function') aplicarResultadoPropuesta(mensaje.acepta);
    } else if (mensaje && mensaje.tipo === 'cancelarPropuesta') {
        window.partidaPausadaPorPropuesta = false;
        if (typeof cerrarPropuestaRecibida === 'function') cerrarPropuestaRecibida();
    } else if (mensaje && mensaje.tipo === 'rendicion') {
        window.partidaPausadaPorPropuesta = false;
        if (typeof finalizarPorRendicion === 'function') finalizarPorRendicion(1 - mensaje.quienSeRinde);
    } else if (mensaje && mensaje.tipo === 'fin-tiempo') {
        if (juegoTerminado) return;
        const jugadorSinTiempo = Number(mensaje.jugador);
        const mismoEstado = (!Number.isFinite(Number(mensaje.seq)) || Number(mensaje.seq) === contadorJugadas) &&
            (!mensaje.hash || mensaje.hash === hashEstadoLogico());
        if ((jugadorSinTiempo !== 0 && jugadorSinTiempo !== 1) || !mismoEstado || turno !== jugadorSinTiempo) {
            solicitarResincronizacionOnline('fin-tiempo-no-coincide');
            return;
        }
        if (typeof tiempoRestante !== 'undefined' && Array.isArray(tiempoRestante)) tiempoRestante[jugadorSinTiempo] = 0;
        if (typeof pintarRelojes === 'function') pintarRelojes();
        juegoTerminado = true;
        if (typeof mostrarFinJuego === 'function') mostrarFinJuego('tiempo', jugadorSinTiempo);
    } else if (mensaje && mensaje.tipo === 'estado') {
        aplicarEstadoRecibido(mensaje.datos);
        if (sincronizacionReconexionEnCurso) iniciarVerificacionEstadoReconectado();
    } else if (mensaje && mensaje.tipo === 'rechazado') {
        conexionRechazadaPorSala = true;
        onlineConectado = false;
        actualizarEstadoConexionOnline('error', 'Sala llena');
        mostrarPanelEspera();
        const paramsRechazo = new URLSearchParams(window.location.search);
        const salaRechazada = (paramsRechazo.get('sala') || '').trim().toUpperCase();
        if (!onlineRolAnfitrion) mostrarFormularioConError(salaRechazada, '⚠️ Esa sala ya tiene 2 jugadores.');
        else mostrarAvisoEspera('⚠️ La conexión adicional fue rechazada.');
    } else if (mensaje && mensaje.tipo === 'config-partida') {
        // J2 recibe la elección de color y el tipo de partida de J1 (solo
        // informativo) y debe confirmar o sortear el color con una moneda.
        if (typeof mostrarConfirmacionColorJ2 === 'function') {
            mostrarConfirmacionColorJ2(mensaje.colorJ1, mensaje.timerMode, mensaje.timer);
        }
    } else if (mensaje && mensaje.tipo === 'respuesta-color') {
        // El anfitrión recibe la decisión final de color (confirmada o
        // sorteada) y, con eso resuelto, ordena a ambos lados arrancar.
        const colorFinal = Number(mensaje.colorJ1);
        if (!onlineRolAnfitrion || (colorFinal !== 0 && colorFinal !== 1) || window.onlinePartidaIniciada) return;
        CONFIG_JUEGO.onlineSoyJugador = colorFinal;
        try { canalDatos.send({ tipo: 'iniciar', colorJ1: colorFinal }); } catch(e) {}
        lanzarInicioOnline();
    } else if (mensaje && mensaje.tipo === 'iniciar') {
        // colorJ1 ya viene decidido (confirmado o sorteado): determina si el
        // anfitrión (jugador de conexión 0) controla las piezas rojas (color
        // de jugador 0) o las azules (color de jugador 1).
        if (typeof mensaje.colorJ1 === 'number') {
            CONFIG_JUEGO.onlineSoyJugador = onlineRolAnfitrion
                ? mensaje.colorJ1
                : (1 - mensaje.colorJ1);
        }
        lanzarInicioOnline();
    }
}

function configurarCanalDatos(conn) {
    canalDatos = conn;
    conn.on('open', () => {
        conexionRechazadaPorSala = false;
        onlineConectado = true;
        actualizarEstadoConexionOnline('conectado', 'En línea');
        ocultarPanelEspera();
        if (contadorJugadas > 0 || window.onlinePartidaIniciada) {
            // Una partida puede haberse iniciado y todavía estar en jugada 0.
            // El caché conserva esa fase para que una recarga no vuelva a abrir
            // la negociación de colores como si fuera una sala nueva.
            sincronizacionReconexionEnCurso = true;
            preparacionReconexionLanzada = false;
            // Esta sesión ya tenía jugadas (se recuperó de un snapshot tras
            // recargar la página): en vez de arrancar countdown de partida
            // nueva, sincronizamos con el otro lado por si él también se
            // recuperó con un estado distinto, y luego mostramos el
            // countdown corto de preparación antes de continuar.
            enviarInfoReconexionCuandoEstable(conn)
        } else if (onlineRolAnfitrion) {
            // Partida nueva: antes de arrancar, el anfitrión manda su
            // elección de color y el tipo de partida para que J2 los vea
            // (solo lectura) y confirme o sortee el color con una moneda.
            const params = new URLSearchParams(window.location.search);
            const colorJ1 = params.get('colorJ1') === '1' ? 1 : 0;
            try {
                canalDatos.send({
                    tipo: 'config-partida',
                    colorJ1,
                    timerMode: CONFIG_JUEGO.timerMode,
                    timer: CONFIG_JUEGO.timer
                });
            } catch(e) {}
        }
    });
    conn.on('data', (mensaje) => {
        if (mensaje && mensaje.tipo === 'reconexion-info') procesarInfoReconexion(mensaje);
        else manejarMensajeCanalDatos(mensaje);
    });
    conn.on('close', () => gestionarCaidaConexion('El otro jugador se desconectó de la partida.'));
    conn.on('error', () => {
        actualizarEstadoConexionOnline('error', 'Error de conexión');
        if (window.onlinePartidaIniciada || contadorJugadas > 0) gestionarCaidaConexion('La conexión tuvo un error.');
        else mostrarAvisoEspera('⚠️ Error de conexión. Intenta de nuevo.');
    });
}

// ============================================================================
// RECONEXIÓN TRAS UNA CAÍDA (corta o larga)
// ============================================================================
// Si la conexión se cae a mitad de partida, en vez de obligar a empezar de
// cero, se intenta restablecer la MISMA sala: el anfitrión vuelve a escuchar
// conexiones entrantes, y quien se unió reintenta conectar al mismo código.
// Cuando ambos vuelven a estar conectados, se comparan los estados de cada
// uno (por número de jugadas) y se adopta el más avanzado, para no perder
// ninguna jugada que uno de los dos sí haya recibido. Los relojes quedaron
// pausados desde el instante de la caída y solo se reanudan tras el
// countdown de 3 segundos de preparación.
// ============================================================================

let intentandoReconectar = false;
let _reconexionGeneracion = 0;
let _timerReconexion = null;
let _idCodigoSalaPropia = null;

function programarReintentoReconexion(fn, ms = null) {
    if (_timerReconexion) clearTimeout(_timerReconexion);
    const espera = ms == null ? calcularEsperaReconexion() : ms;
    _timerReconexion = setTimeout(() => {
        _timerReconexion = null;
        if (intentandoReconectar && !juegoTerminado) fn();
    }, espera);
}

function iniciarVerificacionEstadoReconectado() {
    if (!canalDatos || !onlineConectado || juegoTerminado) return;
    sincronizacionReconexionEnCurso = true;
    actualizarEstadoConexionOnline('sincronizando', 'Verificando partida');
    const id = ++idVerificacionSync;
    try {
        canalDatos.send({
            tipo: 'sync-check', id,
            contadorJugadas,
            hash: hashEstadoLogico()
        });
    } catch (e) {}
}

function fusionarRelojesReconectados(estadoRemoto) {
    if (!estadoRemoto) return;
    if (!onlineRolAnfitrion) {
        if (typeof estadoRemoto.timer === 'boolean') CONFIG_JUEGO.timer = estadoRemoto.timer;
        if (estadoRemoto.timerMode && MODOS_TIEMPO[estadoRemoto.timerMode]) CONFIG_JUEGO.timerMode = estadoRemoto.timerMode;
        if (typeof modoTiempoActual !== 'undefined') modoTiempoActual = MODOS_TIEMPO[CONFIG_JUEGO.timerMode] || MODOS_TIEMPO.blitz5;
    }
    // Si la posición es exactamente la misma, cualquier diferencia de reloj
    // proviene de latencia/detección desigual de la caída. Como el tiempo
    // desconectado no debe contar, elegimos la lectura más favorable: máximo
    // restante en cuenta atrás y mínimo transcurrido en cronómetro infinito.
    const modo = MODOS_TIEMPO[CONFIG_JUEGO.timerMode] || MODOS_TIEMPO.blitz5;
    if (modo.segundos === null) {
        if (Array.isArray(estadoRemoto.cronometro) && typeof cronometro !== 'undefined') {
            cronometro = cronometro.map((v, i) => Math.min(Number(v) || 0, Number(estadoRemoto.cronometro[i]) || 0));
        }
    } else if (Array.isArray(estadoRemoto.tiempoRestante) && typeof tiempoRestante !== 'undefined') {
        tiempoRestante = tiempoRestante.map((v, i) => Math.max(Number(v) || 0, Number(estadoRemoto.tiempoRestante[i]) || 0));
        if (typeof avisoBajoTiempoDado !== 'undefined') avisoBajoTiempoDado = tiempoRestante.map(t => t <= 20);
    }
    if (Array.isArray(estadoRemoto.bonoJugadaAplicado) && typeof bonoJugadaAplicado !== 'undefined') {
        bonoJugadaAplicado = bonoJugadaAplicado.map((v, i) => !!v || !!estadoRemoto.bonoJugadaAplicado[i]);
    }
    if (typeof pintarRelojes === 'function') pintarRelojes();
}

function procesarInfoReconexion(mensaje) {
    if (!mensaje) return;
    sincronizacionReconexionEnCurso = true;
    actualizarEstadoConexionOnline('sincronizando', 'Comparando estados');

    const remoto = Number(mensaje.contadorJugadas) || 0;
    const local = Number(contadorJugadas) || 0;
    if (remoto > local) {
        aplicarEstadoRecibido(mensaje.estado);
    } else if (remoto < local) {
        responderEstadoActualOnline();
    } else if (mensaje.hash && mensaje.hash !== hashEstadoLogico()) {
        // Si ambos tienen la misma secuencia pero estados distintos, el host
        // funciona como árbitro determinista. Esto evita el ping-pong de dos
        // snapshots mutuamente incompatibles.
        if (onlineRolAnfitrion) responderEstadoActualOnline();
        else aplicarEstadoRecibido(mensaje.estado);
    } else {
        // Mismo tablero y misma secuencia: reconciliamos únicamente relojes.
        // La operación max/min es simétrica, así que ambos lados convergen al
        // mismo tiempo sin necesitar declarar un dispositivo "dueño" del reloj.
        fusionarRelojesReconectados(mensaje.estado);
    }

    // El canal de datos es ordenado: si acabamos de enviar un snapshot, llegará
    // antes que este check. No reanudamos los relojes hasta que AMBOS lados
    // confirmen exactamente el mismo contador + hash.
    iniciarVerificacionEstadoReconectado();
}

function procesarSyncCheck(mensaje) {
    if (!mensaje) return;
    const coincide = Number(mensaje.contadorJugadas) === Number(contadorJugadas) &&
        (!mensaje.hash || mensaje.hash === hashEstadoLogico());
    if (!coincide) {
        if (onlineRolAnfitrion) responderEstadoActualOnline();
        else solicitarResincronizacionOnline('sync-check-no-coincide');
        return;
    }
    try {
        canalDatos.send({ tipo: 'sync-check-ok', id: mensaje.id, contadorJugadas, hash: hashEstadoLogico() });
    } catch (e) {}
    lanzarPreparacionTrasReconexion();
}

function procesarSyncCheckOk(mensaje) {
    if (!mensaje) return;
    const coincide = Number(mensaje.contadorJugadas) === Number(contadorJugadas) &&
        (!mensaje.hash || mensaje.hash === hashEstadoLogico());
    if (!coincide) {
        solicitarResincronizacionOnline('sync-check-ok-no-coincide');
        return;
    }
    lanzarPreparacionTrasReconexion();
}

function intentarReconexionAutomatica(forzarAhora = false) {
    if (juegoTerminado) return;
    if (!intentandoReconectar) {
        intentandoReconectar = true;
        reconexionIniciadaEn = Date.now();
        reconexionIntentos = 0;
        preparacionReconexionLanzada = false;
        sincronizacionReconexionEnCurso = false;
        iniciarRelojVisualReconexion();
    } else if (!forzarAhora) {
        return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        actualizarEstadoConexionOnline('desconectado', 'Sin internet');
        programarReintentoReconexion(() => intentarReconexionAutomatica(true), 2500);
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const sala = params.get('sala') || _idCodigoSalaPropia;
    if (!sala) { intentandoReconectar = false; return; }

    reconexionIntentos++;
    actualizarEstadoConexionOnline('reconectando', `Reconectando · intento ${reconexionIntentos}`);
    const btn = document.getElementById('btnReintentarDesconexion');
    if (btn) { btn.disabled = true; btn.textContent = '↻ Conectando...'; }

    if (onlineRolAnfitrion) reabrirComoAnfitrionParaReconectar(sala);
    else reintentarUnionParaReconectar(sala);
}

function reabrirComoAnfitrionParaReconectar(sala) {
    if (!sala) { intentandoReconectar = false; return; }
    const generacion = ++_reconexionGeneracion;
    if (peerConexion) { try { peerConexion.destroy(); } catch(e) {} }
    peerConexion = crearInstanciaPeer('templos-' + sala);
    peerConexion.on('open', () => {
        if (generacion !== _reconexionGeneracion) return;
        actualizarEstadoConexionOnline('reconectando', 'Esperando al rival');
        const btn = document.getElementById('btnReintentarDesconexion');
        if (btn) { btn.disabled = false; btn.textContent = '↻ Reintentar ahora'; }
    });
    peerConexion.on('connection', (conn) => {
        if (generacion !== _reconexionGeneracion) { try { conn.close(); } catch(e) {} return; }
        configurarCanalDatosReconexion(conn);
    });
    peerConexion.on('error', () => {
        if (generacion !== _reconexionGeneracion) return;
        const btn = document.getElementById('btnReintentarDesconexion');
        if (btn) { btn.disabled = false; btn.textContent = '↻ Reintentar ahora'; }
        programarReintentoReconexion(() => intentarReconexionAutomatica(true));
    });
}

function reintentarUnionParaReconectar(sala) {
    if (!sala) { intentandoReconectar = false; return; }
    const generacion = ++_reconexionGeneracion;
    if (peerConexion) { try { peerConexion.destroy(); } catch(e) {} }
    peerConexion = crearInstanciaPeer(undefined);
    let conectadoEsteIntento = false;
    peerConexion.on('open', () => {
        if (generacion !== _reconexionGeneracion) return;
        const conn = peerConexion.connect('templos-' + sala, { reliable: true });
        conn.on('open', () => { conectadoEsteIntento = true; });
        configurarCanalDatosReconexion(conn);
        // Un intento de reconexión no puede quedar colgado eternamente si el
        // Peer se abrió pero el canal contra la sala nunca lo hizo.
        setTimeout(() => {
            if (generacion !== _reconexionGeneracion || conectadoEsteIntento || onlineConectado || !intentandoReconectar) return;
            try { conn.close(); } catch (e) {}
            programarReintentoReconexion(() => intentarReconexionAutomatica(true), 200);
        }, 6500);
    });
    peerConexion.on('error', () => {
        if (generacion !== _reconexionGeneracion) return;
        const btn = document.getElementById('btnReintentarDesconexion');
        if (btn) { btn.disabled = false; btn.textContent = '↻ Reintentar ahora'; }
        programarReintentoReconexion(() => intentarReconexionAutomatica(true));
    });
}

// Variante de configurarCanalDatos específica para cuando la conexión se
// restablece tras una caída. Primero se sincroniza y verifica el estado; solo
// entonces se reanudan tablero y relojes.
function configurarCanalDatosReconexion(conn) {
    canalDatos = conn;
    conn.on('open', () => {
        onlineConectado = true;
        intentandoReconectar = true; // sigue "reconectando" hasta validar hash
        sincronizacionReconexionEnCurso = true;
        _reconexionGeneracion++;
        if (_timerReconexion) { clearTimeout(_timerReconexion); _timerReconexion = null; }
        actualizarEstadoConexionOnline('sincronizando', 'Conexión recuperada');
        const btn = document.getElementById('btnReintentarDesconexion');
        if (btn) { btn.disabled = true; btn.textContent = '⇄ Sincronizando...'; }
        enviarInfoReconexionCuandoEstable(conn);
    });
    conn.on('data', (mensaje) => {
        if (mensaje && mensaje.tipo === 'reconexion-info') {
            procesarInfoReconexion(mensaje);
        } else if (mensaje && mensaje.tipo === 'estado') {
            aplicarEstadoRecibido(mensaje.datos);
            if (sincronizacionReconexionEnCurso) iniciarVerificacionEstadoReconectado();
        } else {
            manejarMensajeCanalDatos(mensaje);
        }
    });
    conn.on('close', () => gestionarCaidaConexion('El otro jugador se desconectó de la partida.'));
    conn.on('error', () => {
        actualizarEstadoConexionOnline('error', 'Error de conexión');
        if (!juegoTerminado) gestionarCaidaConexion('La conexión tuvo un error.');
    });
}

function gestionarCaidaConexion(mensaje) {
    if (juegoTerminado) return;
    onlineConectado = false;

    // Antes de que la partida haya arrancado no hablamos de "reconexión de
    // partida": todavía estamos creando/negociando la sala. Un rechazo por
    // sala llena o un rival que se va durante la elección de color debe volver
    // al flujo de sala, no abrir el panel de partida interrumpida.
    const partidaYaIniciada = !!window.onlinePartidaIniciada || contadorJugadas > 0;
    if (!partidaYaIniciada) {
        limpiarTodosMovimientosLocalesPendientes();
        sincronizacionReconexionEnCurso = false;
        window.partidaPausadaPorPropuesta = false;
        mostrarPanelEspera();
        if (conexionRechazadaPorSala) {
            conexionRechazadaPorSala = false;
            return;
        }
        const paramsSetup = new URLSearchParams(window.location.search);
        const salaSetup = (paramsSetup.get('sala') || _idCodigoSalaPropia || '').trim().toUpperCase();
        if (onlineRolAnfitrion) {
            actualizarEstadoConexionOnline('conectando', 'Esperando rival');
            if (salaSetup) renderPanelAnfitrion(salaSetup);
            mostrarAvisoEspera('🟠 El jugador salió antes de comenzar. La sala sigue disponible.');
        } else {
            actualizarEstadoConexionOnline('error', 'Conexión cerrada');
            mostrarFormularioConError(salaSetup, '⚠️ La conexión se cerró antes de comenzar. Puedes intentarlo de nuevo.');
        }
        return;
    }

    sincronizacionReconexionEnCurso = false;
    limpiarTodosMovimientosLocalesPendientes();
    window.partidaPausadaPorPropuesta = true;
    if (typeof detenerRelojes === 'function') detenerRelojes();
    if (typeof cancelarPropuestasPorDesconexion === 'function') cancelarPropuestasPorDesconexion();
    if (typeof guardarPartidaEnCache === 'function') guardarPartidaEnCache();
    if (typeof mostrarDesconexion === 'function') mostrarDesconexion(mensaje || 'Conexión perdida.');
    if (!reconexionIniciadaEn) reconexionIniciadaEn = Date.now();
    actualizarEstadoConexionOnline((navigator.onLine === false) ? 'desconectado' : 'reconectando', (navigator.onLine === false) ? 'Sin internet' : 'Reconectando');
    if (intentandoReconectar) {
        // Si el canal volvió a abrir pero cayó antes de terminar el handshake,
        // seguimos dentro del mismo ciclo de reconexión y programamos el
        // siguiente intento en vez de quedarnos atascados en `true`.
        programarReintentoReconexion(() => intentarReconexionAutomatica(true), navigator.onLine === false ? 2500 : null);
    } else {
        intentarReconexionAutomatica();
    }
}

// Al recuperar internet, no esperamos al siguiente backoff. Al perderlo, no
// destruimos la partida: la dejamos congelada y el caché conserva su estado.
window.addEventListener('online', () => {
    if (!CONFIG_JUEGO.online || juegoTerminado || onlineConectado) return;
    const partidaYaIniciada = !!window.onlinePartidaIniciada || contadorJugadas > 0;
    if (partidaYaIniciada) {
        intentarReconexionAutomatica(true);
        return;
    }
    // Si el navegador estaba sin red antes de poder cargar PeerJS, no podemos
    // llamar directamente a crearInstanciaPeer. Recuperamos primero la
    // biblioteca y regresamos al flujo normal de creación/unión.
    actualizarEstadoConexionOnline('conectando', 'Internet restaurado');
    if (!window.Peer) {
        cargarScriptPeerJS((error) => {
            if (error) { actualizarEstadoConexionOnline('error', 'Servicio no disponible'); return; }
            const params = new URLSearchParams(window.location.search);
            if (onlineRolAnfitrion) iniciarComoAnfitrion();
            else renderFormularioUnirse((params.get('sala') || '').trim().toUpperCase() || null, 'Conexión restaurada.');
        });
    }
});
window.addEventListener('offline', () => {
    if (!CONFIG_JUEGO.online || juegoTerminado) return;
    actualizarEstadoConexionOnline('desconectado', 'Sin internet');
    if (onlineConectado) gestionarCaidaConexion('Tu dispositivo perdió la conexión a internet.');
});

function forzarReconexionOnlineAhora() {
    if (!CONFIG_JUEGO.online || juegoTerminado) return;
    if (_timerReconexion) { clearTimeout(_timerReconexion); _timerReconexion = null; }
    intentarReconexionAutomatica(true);
}
window.forzarReconexionOnlineAhora = forzarReconexionOnlineAhora;

// Countdown corto (3s) de preparación antes de continuar tras reconectar, con
// los relojes quedándose pausados hasta que termine.
function lanzarPreparacionTrasReconexion() {
    if (preparacionReconexionLanzada || juegoTerminado) return;
    preparacionReconexionLanzada = true;
    sincronizacionReconexionEnCurso = false;
    intentandoReconectar = false;
    if (_timerReconexion) { clearTimeout(_timerReconexion); _timerReconexion = null; }
    ocultarPanelDesconexion();
    actualizarEstadoConexionOnline('sincronizando', 'Partida sincronizada');
    window.partidaPausadaPorPropuesta = true;
    const continuar = () => {
        window.partidaPausadaPorPropuesta = false;
        marcarConexionRestaurada();
        if (typeof guardarPartidaEnCache === 'function') guardarPartidaEnCache();
        if (typeof arrancarRelojes === 'function') arrancarRelojes();
        if (typeof mostrarAvisoRapido === 'function') mostrarAvisoRapido('Conexión restaurada. La partida está sincronizada.');
    };
    if (typeof window.arrancarCountdown === 'function') window.arrancarCountdown(continuar);
    else { window.tableroHabilitado = true; continuar(); }
}

function ocultarPanelDesconexion() {
    const panel = document.getElementById('panelDesconexion');
    if (panel) panel.classList.remove('mostrar');
}

function lanzarInicioOnline() {
    // Un doble clic en la confirmación de color o un paquete duplicado no debe
    // crear dos countdowns ni, sobre todo, dos intervalos de reloj.
    if (window.onlinePartidaIniciada) return;
    window.onlinePartidaIniciada = true;
    window.tableroHabilitado = false;
    preparacionReconexionLanzada = false;
    actualizarEstadoConexionOnline('conectado', 'En línea');
    // Guardamos incluso en jugada 0: así una recarga durante el countdown o
    // antes del primer movimiento conserva color y configuración de la sala.
    if (typeof guardarPartidaEnCache === 'function') guardarPartidaEnCache();
    if (typeof window.arrancarCountdown === 'function') {
        window.arrancarCountdown(() => {
            if (typeof guardarPartidaEnCache === 'function') guardarPartidaEnCache();
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

    // El rol anfitrión/invitado viene de la URL y es estable. El color que
    // controla este dispositivo puede cambiar por sorteo y se restaura aparte.
    onlineRolAnfitrion = !!CONFIG_JUEGO.onlineEsAnfitrion;
    actualizarEstadoConexionOnline('conectando', 'Preparando conexión');

    // Bloquear tablero hasta que ambos estén conectados
    window.tableroHabilitado = false;
    mostrarPanelEspera();

    // Si esta página se recargó por accidente, recuperamos SOLO el snapshot
    // correspondiente a este rol de conexión. Esto importa cuando dos pestañas
    // del mismo navegador prueban una sala y comparten localStorage.
    const params = new URLSearchParams(window.location.search);
    const salaURL = (params.get('sala') || '').trim().toUpperCase();
    if (salaURL && typeof buscarPartidaEnCachePorSala === 'function') {
        const guardada = buscarPartidaEnCachePorSala(salaURL, onlineRolAnfitrion);
        if (guardada && guardada.estado) {
            if (typeof guardada.onlineSoyJugador === 'number') CONFIG_JUEGO.onlineSoyJugador = guardada.onlineSoyJugador;
            if (typeof guardada.timer === 'boolean') CONFIG_JUEGO.timer = guardada.timer;
            if (guardada.timerMode && MODOS_TIEMPO[guardada.timerMode]) CONFIG_JUEGO.timerMode = guardada.timerMode;
            window.onlinePartidaIniciada = !!guardada.onlinePartidaIniciada || !!guardada.estado.onlinePartidaIniciada || (guardada.estado.contadorJugadas > 0);
            aplicarEstadoRecibido(guardada.estado);
            window._idPartidaActualCache = guardada.id; // seguir actualizando el mismo registro
            mostrarAvisoEspera('↻ Partida local recuperada. Buscando al otro jugador...');
        }
    }

    cargarScriptPeerJS((error) => {
        if (error) {
            mostrarAvisoEspera('⚠️ No se pudo cargar el servicio online. Revisa tu conexión.');
            actualizarEstadoConexionOnline('error', 'Servicio no disponible');
            return;
        }
        if (onlineRolAnfitrion) iniciarComoAnfitrion();
        else {
            const params = new URLSearchParams(window.location.search);
            const codigoDesdeURL = (params.get('sala') || '').trim().toUpperCase();
            renderFormularioUnirse(codigoDesdeURL || null);
        }
    });
}

function crearInstanciaPeer(idDeseado) {
    return new Peer(idDeseado, {
        host: '0.peerjs.com', port: 443, path: '/',
        secure: true, pingInterval: 5000
    });
}

function iniciarComoAnfitrion(intentoActual = 1, codigoForzado = null) {
    // El código normalmente viene desde index.html. Si PeerJS informa que el
    // id está ocupado, generamos uno NUEVO de verdad y actualizamos la URL.
    const params = new URLSearchParams(window.location.search);
    let codigo = codigoForzado || params.get('sala') || generarCodigoSala();
    _idCodigoSalaPropia = codigo;
    // Persistir SIEMPRE el código en la URL. Antes una sala recién creada se
    // mostraba en pantalla pero la URL del host seguía sin ?sala=..., así que
    // su caché guardaba sala:null y una recarga no podía reconstruirla.
    if (params.get('sala') !== codigo) {
        const urlSala = new URL(window.location.href);
        urlSala.searchParams.set('sala', codigo);
        window.history.replaceState({}, '', urlSala);
    }
    const idCompleto = 'templos-' + codigo;

    renderPanelAnfitrion(codigo);
    actualizarEstadoConexionOnline('conectando', 'Creando sala');
    mostrarAvisoEspera('⏳ Creando sala...' + (intentoActual > 1 ? ` (intento ${intentoActual})` : ''));

    if (peerConexion) { try { peerConexion.destroy(); } catch(e) {} }
    peerConexion = crearInstanciaPeer(idCompleto);

    let abrioCorrectamente = false;
    peerConexion.on('open', () => {
        abrioCorrectamente = true;
        actualizarEstadoConexionOnline('conectando', 'Esperando rival');
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
        if (err && err.type === 'unavailable-id') {
            // El código realmente está ocupado: reutilizarlo solo repetía el
            // mismo error. Creamos otro y lo reflejamos en la URL/panel.
            const nuevoCodigo = generarCodigoSala();
            const nuevaURL = new URL(window.location.href);
            nuevaURL.searchParams.set('sala', nuevoCodigo);
            window.history.replaceState({}, '', nuevaURL);
            iniciarComoAnfitrion(1, nuevoCodigo);
        } else if (intentoActual < MAX_INTENTOS_CONEXION) {
            // Primer intento de apertura falló (servidor de señalización "frío");
            // reintentamos automáticamente en vez de dejar al jugador varado.
            setTimeout(() => iniciarComoAnfitrion(intentoActual + 1, codigo), 800);
        } else {
            actualizarEstadoConexionOnline('error', 'No se pudo crear sala');
            mostrarAvisoEspera('⚠️ Error: ' + (err && err.type ? err.type : 'desconocido') + '. Revisa tu conexión y recarga.');
        }
    });
}

function renderPanelAnfitrion(codigo) {
    const box = document.getElementById('espeiraContenido');
    if (!box) return;
    box.innerHTML = `
        <h3>🌐 Sala creada</h3>
        <p>Comparte este código con el otro jugador:</p>
        <div class="codigo-sala">${codigo}</div>
        <button class="espera-btn cancelar" id="btnCopiarCodigoSala" type="button">Copiar código</button>
        <div id="avisoEspera" style="color:#cbb892;font-size:0.82rem;margin:8px 0;">⏳ Creando sala...</div>
        <p style="font-size:0.75rem;opacity:0.6;margin:0;">La partida comienza cuando el otro jugador se una.</p>
    `;
    const btnCopiar = document.getElementById('btnCopiarCodigoSala');
    if (btnCopiar) btnCopiar.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(codigo);
            btnCopiar.textContent = '✓ Código copiado';
            setTimeout(() => { if (btnCopiar) btnCopiar.textContent = 'Copiar código'; }, 1800);
        } catch (e) {
            btnCopiar.textContent = `Código: ${codigo}`;
        }
    });
}

function renderFormularioUnirse(codigoPrellenado, mensajeError) {
    const box = document.getElementById('espeiraContenido');
    if (!box) return;
    box.innerHTML = `
        <h3>🌐 Unirse a partida</h3>
        <p>Pega el código que te compartió el Jugador 1:</p>
        <input id="inputCodigoUnirse" class="input-codigo" type="text" maxlength="6" placeholder="CÓDIGO" autocomplete="off">
        <div id="avisoEspera" style="color:#cbb892;font-size:0.82rem;margin:6px 0;min-height:1.2em;">${mensajeError || ''}</div>
        <button class="espera-btn" id="btnConectarSala">Conectar ▶</button>
    `;

    const input = document.getElementById('inputCodigoUnirse');
    const btn = document.getElementById('btnConectarSala');
    if (input) {
        input.addEventListener('input', () => {
            input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
        });
        if (codigoPrellenado) input.value = codigoPrellenado;
    }
    const intentar = () => {
        const codigo = (input ? input.value : '').trim().toUpperCase();
        if (codigo.length < 4) { mostrarAvisoEspera('⚠️ El código es demasiado corto.'); return; }
        if (btn) { btn.disabled = true; btn.textContent = 'Conectando...'; }
        unirseASala(codigo);
    };
    if (btn) btn.addEventListener('click', intentar);
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') intentar(); });

    // Si ya tenemos código (vino de index.html), conectamos automáticamente
    // sin que el jugador tenga que volver a escribirlo ni pulsar nada.
    if (codigoPrellenado) {
        if (btn) { btn.disabled = true; btn.textContent = 'Conectando...'; }
        unirseASala(codigoPrellenado);
    }
}

// Intenta conectar con reintentos automáticos: la primera conexión a PeerJS a
// veces falla o tarda (servidor de señalización "frío"), lo que antes se veía
// como "sin conexión la primera vez". Ahora se reintenta solo, sin que el
// jugador tenga que tocar nada, antes de mostrarle un error.
function unirseASala(codigo, intentoActual = 1) {
    actualizarEstadoConexionOnline('conectando', intentoActual > 1 ? `Conectando · intento ${intentoActual}` : 'Conectando a sala');
    mostrarAvisoEspera(`⏳ Conectando con sala ${codigo}...` + (intentoActual > 1 ? ` (intento ${intentoActual})` : ''));

    if (peerConexion) { try { peerConexion.destroy(); } catch(e) {} }
    peerConexion = crearInstanciaPeer(undefined);

    let yaResuelto = false;
    const reintentarOFallar = (mensaje) => {
        if (yaResuelto) return;
        // Marcarlo resuelto AL PROGRAMAR el reintento evita que error de Peer,
        // error del canal y timeout creen tres conexiones paralelas.
        yaResuelto = true;
        if (intentoActual < MAX_INTENTOS_CONEXION) {
            setTimeout(() => unirseASala(codigo, intentoActual + 1), 800);
        } else {
            actualizarEstadoConexionOnline('error', 'No se pudo conectar');
            mostrarFormularioConError(codigo, mensaje || '⚠️ No se pudo conectar. Verifica el código e intenta de nuevo.');
        }
    };

    peerConexion.on('open', () => {
        const idHost = 'templos-' + codigo;
        const conn = peerConexion.connect(idHost, { reliable: true });
        conn.on('open', () => { yaResuelto = true; });
        conn.on('error', () => reintentarOFallar('⚠️ No se encontró la sala. Verifica el código.'));
        configurarCanalDatos(conn);

        // Si tras unos segundos la conexión no abrió, lo tratamos como fallo
        // y reintentamos (en vez de dejar al jugador esperando indefinidamente).
        setTimeout(() => {
            if (!yaResuelto && !onlineConectado) reintentarOFallar('⚠️ No se pudo conectar. Verifica el código.');
        }, 6000);
    });
    peerConexion.on('error', (err) => {
        reintentarOFallar('⚠️ Error: ' + (err && err.type ? err.type : 'desconocido'));
    });
}

function mostrarFormularioConError(codigo, mensaje) {
    renderFormularioUnirse(codigo, mensaje);
}
