console.log("✅ coronacion.js cargado");

const menuCoronacion = document.getElementById('menuCoronacion');
const opcionesCoronacion = document.getElementById('opcionesCoronacion');
let coronacionPendiente = null;

function mostrarMenuCoronacion() {
    if (!coronacionPendiente) return;
    if (typeof sonidoCoronacion === 'function') sonidoCoronacion();
    const opciones = [
        { tipo: 'F0', nombre: 'Torre' }, { tipo: 'F2', nombre: 'Caballo' },
        { tipo: 'F4', nombre: 'Trampero' }, { tipo: 'F5', nombre: 'Alfil' }
    ];
    opcionesCoronacion.innerHTML = '';
    opciones.forEach(op => {
        const btn = document.createElement('button');
        const img = document.createElement('img');
        img.src = `img/${op.tipo.toLowerCase()}.jpg`;
        img.onerror = () => { img.style.display = 'none'; btn.textContent = op.tipo; };
        img.onload = () => { btn.textContent = ''; btn.appendChild(img); };
        btn.appendChild(img);
        btn.onclick = () => coronar(op.tipo);
        opcionesCoronacion.appendChild(btn);
    });
    menuCoronacion.style.display = 'block';
}

function coronar(tipo) {
    if (!coronacionPendiente) return;
    const { jugador, f, c } = coronacionPendiente;
    let nuevaPieza;
    switch (tipo) {
        case 'F0': nuevaPieza = new F0(jugador); break;
        case 'F2': nuevaPieza = new F2(jugador); break;
        case 'F4': nuevaPieza = new F4(jugador); break;
        case 'F5': nuevaPieza = new F5(jugador); break;
        default: return;
    }
    board[f][c] = nuevaPieza;
    menuCoronacion.style.display = 'none';
    coronacionPendiente = null;
    turno = 1 - turno;
    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    dibujarTablero();
    if (typeof despuesDeJugada === 'function') despuesDeJugada();
}
