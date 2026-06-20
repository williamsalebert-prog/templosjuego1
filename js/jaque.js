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

// ✅ Función que filtra los movimientos bajo jaque (incluidos enroques)
function filtrarMovimientosJaque(selectedPiece, posiblesMovimientos, caminosDestino) {
    // Si no estamos en jaque, devolvemos todo sin cambios
    if (!esJaque(turno)) {
        return { posiblesMovimientos, caminosDestino };
    }

    let movsSeguros = [];
    let nuevosCaminos = {};

    for (let mov of posiblesMovimientos) {
        let fDest, cDest;
        if (mov.hasOwnProperty('f')) { fDest = mov.f; cDest = mov.c; }
        else { fDest = mov[0]; cDest = mov[1]; }

        // Evaluar enroque
        if (mov.tipoMov === 'enroque') {
            // Simular enroque: clonar, intercambiar rey y pieza
            let copia = clonarTablero(board);
            let [reyF, reyC] = [selectedPiece.fila, selectedPiece.col];
            copia[fDest][cDest] = copia[reyF][reyC];
            copia[reyF][reyC] = null;
            if (!esJaque(turno, copia)) {
                movsSeguros.push(mov);
                // No hay camino asociado al enroque
                if (!nuevosCaminos[`${fDest},${cDest}`]) nuevosCaminos[`${fDest},${cDest}`] = null;
            }
            continue;
        }

        // Movimientos normales (incluyendo los que tienen múltiples rutas)
        let claveMov = `${fDest},${cDest}`;
        let infoCamino = mov.caminos || caminosDestino[claveMov];
        if (!infoCamino) continue;

        let rutas = [];
        if (Array.isArray(infoCamino) && infoCamino.length > 0 && infoCamino[0].hasOwnProperty('pasos')) {
            rutas = infoCamino; // caballo con varias rutas
        } else {
            if (Array.isArray(infoCamino)) rutas = [{ pasos: infoCamino }];
            else rutas = [{ pasos: infoCamino }];
        }

        let movimientoSeguro = false;
        for (let ruta of rutas) {
            let caminoReal = ruta.pasos;
            if (!Array.isArray(caminoReal)) continue;
            let nuevoTab = simularMovimiento(board, selectedPiece.fila, selectedPiece.col, [fDest, cDest], caminoReal);
            if (nuevoTab && !esJaque(turno, nuevoTab)) {
                movimientoSeguro = true;
                nuevosCaminos[claveMov] = infoCamino;
                break;
            }
        }
        if (movimientoSeguro) {
            movsSeguros.push(mov);
        }
    }

    // Reconstruir caminosDestino solo con los movimientos seguros
    let tempCaminos = {};
    for (let mov of movsSeguros) {
        let fDest, cDest;
        if (mov.hasOwnProperty('f')) { fDest = mov.f; cDest = mov.c; }
        else { fDest = mov[0]; cDest = mov[1]; }
        let claveMov = `${fDest},${cDest}`;
        if (mov.tipoMov === 'enroque') {
            tempCaminos[claveMov] = null;
        } else if (nuevosCaminos[claveMov]) {
            tempCaminos[claveMov] = nuevosCaminos[claveMov];
        }
    }

    return { posiblesMovimientos: movsSeguros, caminosDestino: tempCaminos };
}
