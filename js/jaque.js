console.log("✅ jaque.js cargado");

function obtenerPosicionRey(jugador) {
    for (let i = 0; i < FILAS; i++)
        for (let j = 0; j < COLUMNAS; j++)
            if (board[i][j] && board[i][j].tipo === 'F6' && board[i][j].jugador === jugador)
                return [i, j];
    return null;
}

function esJaque(jugador, tablero = board) {
    let reyPos = obtenerPosicionRey(jugador);
    if (!reyPos) return false;
    let enemigo = 1 - jugador;
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = tablero[i][j];
            if (pieza && pieza.jugador === enemigo && pieza.puedeAtacarRey(i, j, reyPos[0], reyPos[1], tablero))
                return true;
        }
    }
    return false;
}

function clonarTablero(tablero) {
    return tablero.map(fila => fila.map(celda => {
        if (celda === null) return null;
        const ClasePieza = piezasRegistradas.get(celda.tipo);
        return ClasePieza ? new ClasePieza(celda.jugador) : null;
    }));
}

function simularMovimiento(tablero, fromF, fromC, destino, camino) {
    if (!Array.isArray(camino)) return false;
    let copia = clonarTablero(tablero);
    let f = fromF, c = fromC;
    let pieza = copia[f][c];
    if (!pieza) return false;
    for (let paso of camino) {
        if (paso.tipo === 'move') {
            let [nf, nc] = paso.to;
            copia[f][c] = null; copia[nf][nc] = pieza; f = nf; c = nc;
        } else if (paso.tipo === 'jump' || paso.tipo === 'captureDirect') {
            let [of, oc] = paso.over;
            let [nf, nc] = paso.to;
            if (of !== undefined && oc !== undefined) copia[of][oc] = null;
            copia[f][c] = null; copia[nf][nc] = pieza; f = nf; c = nc;
        } else if (paso.tipo === 'removePiece') {
            let [of, oc] = paso.over;
            if (of !== undefined && oc !== undefined) copia[of][oc] = null;
        }
    }
    return copia;
}
