console.log("✅ animacion.js cargado");

let animando = false;
let colaAnimacion = [];
let origenAnimacion = null;
let piezaAnimacion = null;

function iniciarAnimacion(origen, camino) {
    animando = true;
    colaAnimacion = [...camino];
    origenAnimacion = origen;
    piezaAnimacion = board[origen[0]][origen[1]];
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
    const duracion = 200;
    const origenX = fromC * CELL_SIZE + CELL_SIZE/2;
    const origenY = fromF * CELL_SIZE + CELL_SIZE/2;
    const destinoX = toC * CELL_SIZE + CELL_SIZE/2;
    const destinoY = toF * CELL_SIZE + CELL_SIZE/2;
    function animarPaso(timestamp) {
        const progreso = Math.min((timestamp - inicio) / duracion, 1.0);
        const x = origenX + (destinoX - origenX) * progreso;
        const y = origenY + (destinoY - origenY) * progreso + (paso.tipo === 'jump' ? Math.sin(progreso * Math.PI) * 15 : 0);
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
    animando = false;

    let pieza = board[ff][cc];
    if (pieza && pieza.tipo === 'F1') {
        let zona = getZona(ff, cc);
        if ((pieza.jugador === 0 && zona === 'templo2') || (pieza.jugador === 1 && zona === 'templo1')) {
            coronacionPendiente = { jugador: pieza.jugador, f: ff, c: cc };
            // Si quien corona es la IA (modo 1 jugador), elige Reina sola, sin
            // mostrarle al jugador humano un menú que no le corresponde decidir.
            if (CONFIG_JUEGO.modo === 1 && pieza.jugador === 1) {
                coronar('F3');
                return;
            }
            mostrarMenuCoronacion();
            return;
        }
    }

    turno = 1 - turno;
    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = []; destinoRuta = null;
    dibujarTablero();
    if (typeof despuesDeJugada === 'function') despuesDeJugada();
}
