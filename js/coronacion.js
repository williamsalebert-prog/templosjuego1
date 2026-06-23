console.log("✅ coronacion.js cargado");

const menuCoronacion = document.getElementById('menuCoronacion');
const opcionesCoronacion = document.getElementById('opcionesCoronacion');
let coronacionPendiente = null;

function mostrarMenuCoronacion() {
    if (!coronacionPendiente) return;
    if (typeof sonidoCoronacion === 'function') sonidoCoronacion();
    const opciones = [
        { tipo: 'F0', nombre: 'Torre' }, { tipo: 'F2', nombre: 'Caballo' },
        { tipo: 'F4', nombre: 'Trampero' }, { tipo: 'F5', nombre: 'Alfil' },
        { tipo: 'F3', nombre: 'Reina' }
    ];
    opcionesCoronacion.innerHTML = '';
    opciones.forEach(op => {
        const btn = document.createElement('button');
        btn.dataset.tipo = op.tipo;
        btn.setAttribute('aria-label', `Coronar a ${op.nombre}`);
        btn.innerHTML = `<div style="font-size:1.6rem;line-height:1;">${SIMBOLO_PIEZA[op.tipo] || ''}</div><div style="font-size:0.65rem;">${op.nombre}</div>`;
        btn.onclick = () => coronar(op.tipo);
        opcionesCoronacion.appendChild(btn);
    });
    menuCoronacion.style.display = 'block';
}

function coronar(tipo, remoto = false) {
    if (!coronacionPendiente) return;
    const { jugador, f, c } = coronacionPendiente;
    let nuevaPieza;
    switch (tipo) {
        case 'F0': nuevaPieza = new F0(jugador); break;
        case 'F2': nuevaPieza = new F2(jugador); break;
        case 'F4': nuevaPieza = new F4(jugador); break;
        case 'F5': nuevaPieza = new F5(jugador); break;
        case 'F3': nuevaPieza = new F3(jugador); break;
        default: return;
    }
    board[f][c] = nuevaPieza;
    menuCoronacion.style.display = 'none';
    coronacionPendiente = null;
    if (!remoto && typeof transmitirMovimientoSiOnline === 'function') {
        transmitirMovimientoSiOnline({ tipo: 'coronar', f, c, jugador, piezaTipo: tipo });
    }
    turno = 1 - turno;
    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    dibujarTablero();
    if (typeof despuesDeJugada === 'function') despuesDeJugada();
}
