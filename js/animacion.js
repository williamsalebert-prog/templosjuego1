console.log("✅ animacion.js cargado");

let animando = false;
let colaAnimacion = [];
let origenAnimacion = null;
let piezaAnimacion = null;

// Contexto guardado para poder generar la notación de la jugada una vez
// termine la animación (la cola de pasos se va consumiendo con .shift()).
let _notacionOrigenJugada = null;
let _notacionCaminoJugada = null;
let _notacionTableroAntes = null;
let _notacionTipoPiezaJugada = null;
let _notacionJugadorJugada = null;

function iniciarAnimacion(origen, camino) {
    animando = true;
    colaAnimacion = [...camino];
    origenAnimacion = origen;
    piezaAnimacion = board[origen[0]][origen[1]];

    _notacionOrigenJugada = origen;
    _notacionCaminoJugada = [...camino];
    _notacionTableroAntes = copiarBoard();
    _notacionTipoPiezaJugada = piezaAnimacion ? piezaAnimacion.tipo : null;
    _notacionJugadorJugada = piezaAnimacion ? piezaAnimacion.jugador : null;

    board[origen[0]][origen[1]] = null;
    procesarSiguientePaso();
}

function procesarSiguientePaso() {
    if (colaAnimacion.length === 0) { finalizarAnimacion(); return; }
    const paso = colaAnimacion.shift();
    let [fromF, fromC] = origenAnimacion;
    let toF, toC;
    if (paso.tipo === 'move') { [toF, toC] = paso.to; sonidoMovimiento(); }
    else if (paso.tipo === 'jump') {
        [toF, toC] = paso.to; sonidoSalto();
        let [of, oc] = paso.over;
        let p = board[of]?.[oc];
        if (p && p.jugador !== piezaAnimacion.jugador) {
            if (p.tipo === 'F4' && piezaAnimacion.tipo !== 'F3' && piezaAnimacion.tipo !== 'F6') {}
            else { carcela.agregar(p); board[of][oc] = null; }
        }
    } else if (paso.tipo === 'captureDirect') {
        [toF, toC] = paso.to; sonidoSalto();
        let [of, oc] = paso.over;
        let p = board[of]?.[oc];
        if (p && p.jugador !== piezaAnimacion.jugador) {
            if (p.tipo !== 'F4' || piezaAnimacion.tipo === 'F3' || piezaAnimacion.tipo === 'F6') {
                carcela.agregar(p); board[of][oc] = null;
            }
        }
    } else if (paso.tipo === 'removePiece') {
        let [of, oc] = paso.over;
        let p = board[of]?.[oc];
        if (p) { carcela.agregar(p); board[of][oc] = null; }
        procesarSiguientePaso(); return;
    }
    const inicio = performance.now();
    const reducirMovimiento = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const duracion = reducirMovimiento ? 70 : 175;
    const origenX = fromC * CELL_SIZE + CELL_SIZE/2;
    const origenY = fromF * CELL_SIZE + CELL_SIZE/2;
    const destinoX = toC * CELL_SIZE + CELL_SIZE/2;
    const destinoY = toF * CELL_SIZE + CELL_SIZE/2;
    function animarPaso(timestamp) {
        const progreso = Math.min((timestamp - inicio) / duracion, 1.0);
        // Curva suave: la ficha arranca y aterriza sin ese movimiento lineal
        // mecánico. El arco se resta porque Y positivo apunta hacia abajo.
        const suavizado = progreso < 0.5
            ? 4 * progreso * progreso * progreso
            : 1 - Math.pow(-2 * progreso + 2, 3) / 2;
        const x = origenX + (destinoX - origenX) * suavizado;
        const arco = (paso.tipo === 'jump' && !reducirMovimiento) ? Math.sin(progreso * Math.PI) * 13 : 0;
        const y = origenY + (destinoY - origenY) * suavizado - arco;
        dibujarTablero();
        dibujarPiezaTallada(ctx, x, y, CELL_SIZE * 0.4, piezaAnimacion, false);
        if (progreso < 1.0) requestAnimationFrame(animarPaso);
        else { origenAnimacion = [toF, toC]; procesarSiguientePaso(); }
    }
    requestAnimationFrame(animarPaso);
}

function finalizarAnimacion() {
    let [ff, cc] = origenAnimacion;
    board[ff][cc] = piezaAnimacion;
    if (piezaAnimacion) piezaAnimacion.haMovido = true;
    animando = false;

    // Una resincronización recibida a mitad de animación gana sobre el estado
    // que acabamos de construir. Aplicarla aquí evita que esta función siga
    // escribiendo turno/promoción sobre un snapshot más nuevo.
    if (typeof aplicarEstadoRemotoPendienteSiExiste === 'function' && aplicarEstadoRemotoPendienteSiExiste()) return;

    let pieza = board[ff][cc];
    if (pieza && pieza.tipo === 'F1') {
        let zona = getZona(ff, cc);
        if ((pieza.jugador === 0 && zona === 'templo2') || (pieza.jugador === 1 && zona === 'templo1')) {
            coronacionPendiente = { jugador: pieza.jugador, f: ff, c: cc };

            // En online, si esta jugada vino del rival, ESTE dispositivo nunca
            // debe abrir un menú de promoción. La elección pertenece al dueño
            // del peón. Si el mensaje de coronación llegó mientras aún corría
            // la animación, se aplica ahora desde la pequeña cola remota.
            if (CONFIG_JUEGO.online && window.jugadaEnCursoEsRemota) {
                if (window.coronacionRemotaEnEspera) {
                    const pendiente = window.coronacionRemotaEnEspera;
                    window.coronacionRemotaEnEspera = null;
                    const tipoRemoto = typeof pendiente === 'string' ? pendiente : pendiente.piezaTipo;
                    coronar(tipoRemoto, true);
                }
                return;
            }

            // Si quien corona es la IA, la elección ya fue calculada por su
            // búsqueda. No mostramos al humano un menú que no le corresponde.
            if (CONFIG_JUEGO.modo === 1 && pieza.jugador === 1) {
                if (typeof elegirCoronacionIASiCorresponde === 'function') elegirCoronacionIASiCorresponde();
                else coronar('F3');
                return;
            }
            mostrarMenuCoronacion();
            return;
        }
    }

    // Notación de la jugada (cuando NO hay coronación pendiente; si la hay,
    // se registra dentro de coronar(), una vez se sabe a qué pieza coronó).
    if (typeof generarNotacionJugada === 'function' && _notacionTableroAntes) {
        let notacion = generarNotacionJugada(
            _notacionTableroAntes, _notacionOrigenJugada, [ff, cc],
            _notacionCaminoJugada, _notacionTipoPiezaJugada, false, null
        );
        notacion = agregarSufijoJaque(notacion, board, 1 - _notacionJugadorJugada);
        registrarNotacion(notacion);
    }

    turno = 1 - turno;
    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = []; destinoRuta = null; rutaPrevisualizadaIndice = -1;
    if (typeof ocultarSelectorRutas === 'function') ocultarSelectorRutas();
    dibujarTablero();
    if (typeof despuesDeJugada === 'function') despuesDeJugada();
}
