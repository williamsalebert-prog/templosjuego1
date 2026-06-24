console.log("✅ notacion.js cargado");

// ============================================================================
// NOTACIÓN DE JUGADAS (estilo algebraico de ajedrez, adaptada a Templos)
// ============================================================================
// Columnas: a..o (15 columnas, 0=a, 14=o)
// Filas: 1..10, numeradas de abajo hacia arriba como en ajedrez (fila 0 del
// tablero interno = "1", fila 9 = "10")
//
// Letra de pieza: T=Torre, C=Caballo, A=Alfil, D=Reina/Dama, R=Rey,
// Tr=Trampero. El Peón no lleva letra (igual que en ajedrez).
// Captura: x · Jaque: + · Jaque mate: # · Enroque: O-O · Coronación: =letra
//
// Ejemplos: "e4" (peón avanza), "Cxd5+" (caballo captura y da jaque),
// "a8=D" (peón corona a Reina), "O-O" (enroque).
// ============================================================================

const LETRA_PIEZA_NOTACION = {
    F0: 'T', F1: '', F2: 'C', F3: 'D', F4: 'Tr', F5: 'A', F6: 'R'
};

function casillaANotacion(fila, col) {
    const letraCol = String.fromCharCode(97 + col); // 0->a, 1->b, ...
    const numeroFila = FILAS - fila; // fila interna 0 = arriba; en notación, la "1" está abajo
    return `${letraCol}${numeroFila}`;
}

// Genera la notación de una jugada normal (mover/saltar/capturar), dado el
// estado del tablero ANTES de aplicar el movimiento (para saber qué pieza se
// movió y si había algo en el destino), y el camino completo de pasos.
function generarNotacionJugada(tableroAntes, origen, destino, camino, tipoPieza, esCoronacion, tipoCoronacion) {
    const letra = LETRA_PIEZA_NOTACION[tipoPieza] || '';
    const destinoStr = casillaANotacion(destino[0], destino[1]);

    // ¿Hubo alguna captura en el camino? (salto sobre pieza enemiga, o
    // captura directa al llegar al destino)
    let hayCaptura = false;
    if (Array.isArray(camino)) {
        for (const paso of camino) {
            if (paso.tipo === 'jump' || paso.tipo === 'captureDirect' || paso.tipo === 'removePiece') {
                hayCaptura = true;
                break;
            }
        }
    }
    if (!hayCaptura && tableroAntes[destino[0]] && tableroAntes[destino[0]][destino[1]]) hayCaptura = true;

    let notacion = letra + (hayCaptura ? 'x' : '') + destinoStr;
    if (esCoronacion && tipoCoronacion) {
        notacion += '=' + (LETRA_PIEZA_NOTACION[tipoCoronacion] || tipoCoronacion);
    }
    return notacion;
}

function generarNotacionEnroque() {
    return 'O-O';
}

// Añade el sufijo de jaque (+) o jaque mate (#) a una notación ya generada,
// evaluando el tablero DESPUÉS de aplicar la jugada.
function agregarSufijoJaque(notacion, tableroDepues, jugadorQueRecibe) {
    const turnoPrevio = turno, boardPrevio = board;
    board = tableroDepues; turno = jugadorQueRecibe;
    let sufijo = '';
    if (esJaqueMate(jugadorQueRecibe, tableroDepues)) sufijo = '#';
    else if (esJaque(jugadorQueRecibe, tableroDepues)) sufijo = '+';
    board = boardPrevio; turno = turnoPrevio;
    return notacion + sufijo;
}

// Lista de notaciones acumuladas de la partida en curso. Se maneja con la
// MISMA forma que el historial de deshacer/rehacer (pila + futuros), para que
// Ctrl+Z/Ctrl+Y y el panel de análisis mantengan la notación sincronizada con
// la posición real del tablero en todo momento.
// listaNotacionPartida es siempre la "pila" visible (jugadas ya aplicadas).
let listaNotacionPartida = [];
let notacionFuturos = [];

// Se llama al hacer una jugada nueva: añade su notación y, como cualquier
// jugada nueva invalida la rama de "rehacer", limpia notacionFuturos igual
// que hace historial.guardar() con historial.futuros.
function registrarNotacion(notacion) {
    listaNotacionPartida.push(notacion);
    notacionFuturos = [];
    if (typeof actualizarPanelAnalisis === 'function') actualizarPanelAnalisis();
}

// Debe llamarse junto con historial.deshacer(): mueve la última notación de
// la pila a futuros, en el mismo orden que el historial mueve sus estados.
function notacionDeshacer() {
    if (listaNotacionPartida.length === 0) return;
    notacionFuturos.push(listaNotacionPartida.pop());
}

// Debe llamarse junto con historial.rehacer(): mueve la última notación de
// futuros de vuelta a la pila.
function notacionRehacer() {
    if (notacionFuturos.length === 0) return;
    listaNotacionPartida.push(notacionFuturos.pop());
}

function reiniciarNotacionPartida(lista) {
    listaNotacionPartida = Array.isArray(lista) ? [...lista] : [];
    notacionFuturos = [];
    if (typeof actualizarPanelAnalisis === 'function') actualizarPanelAnalisis();
}

// Texto completo estilo "1. e4 Cf6  2. d4 d5 ..." para mostrar/exportar.
function notacionCompletaComoTexto() {
    let resultado = '';
    for (let i = 0; i < listaNotacionPartida.length; i += 2) {
        const numero = (i / 2) + 1;
        const blancas = listaNotacionPartida[i] || '';
        const negras = listaNotacionPartida[i + 1] || '';
        resultado += `${numero}. ${blancas}${negras ? ' ' + negras : ''}  `;
    }
    return resultado.trim();
}
