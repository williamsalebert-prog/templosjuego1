console.log("✅ jaque.js cargado");

// ----------------------------------------------------------
// DETECCIÓN DE JAQUE MEJORADA (SIMULA MOVIMIENTOS COMPLETOS)
// ----------------------------------------------------------
function obtenerPosicionRey(jugador, tablero = board) {
    for (let i = 0; i < FILAS; i++)
        for (let j = 0; j < COLUMNAS; j++)
            if (tablero[i][j] && tablero[i][j].tipo === 'F6' && tablero[i][j].jugador === jugador)
                return [i, j];
    return null;
}

function clonarTablero(tablero) {
    return tablero.map(fila => fila.map(celda => {
        if (celda === null) return null;
        const ClasePieza = piezasRegistradas.get(celda.tipo);
        return ClasePieza ? new ClasePieza(celda.jugador) : null;
    }));
}

// Simula un movimiento completo sobre un tablero clonado (respeta capturas reales, amigas no se eliminan)
function simularMovimiento(tablero, fromF, fromC, destino, camino) {
    if (!Array.isArray(camino)) return false;
    let copia = clonarTablero(tablero);
    let f = fromF, c = fromC;
    let pieza = copia[f][c];
    if (!pieza) return false;

    for (let paso of camino) {
        if (paso.tipo === 'move') {
            let [nf, nc] = paso.to;
            copia[f][c] = null;
            copia[nf][nc] = pieza;
            f = nf; c = nc;
        } else if (paso.tipo === 'jump') {
            let [of, oc] = paso.over;
            let [nf, nc] = paso.to;
            // Solo eliminar la pieza saltada si es enemiga y capturable
            let piezaSaltada = copia[of]?.[oc];
            if (piezaSaltada && piezaSaltada.jugador !== pieza.jugador && capturaPermitida(pieza.tipo, piezaSaltada)) {
                copia[of][oc] = null;
            }
            // Mover la pieza al destino del salto
            copia[f][c] = null;
            copia[nf][nc] = pieza;
            f = nf; c = nc;
        } else if (paso.tipo === 'captureDirect') {
            let [of, oc] = paso.over;
            let [nf, nc] = paso.to;
            let piezaObjetivo = copia[of]?.[oc];
            if (piezaObjetivo && piezaObjetivo.jugador !== pieza.jugador &&
                (piezaObjetivo.tipo !== 'F4' || pieza.tipo === 'F3' || pieza.tipo === 'F6')) {
                copia[of][oc] = null;
            }
            copia[f][c] = null;
            copia[nf][nc] = pieza;
            f = nf; c = nc;
        } else if (paso.tipo === 'removePiece') {
            let [of, oc] = paso.over;
            let piezaAEliminar = copia[of]?.[oc];
            if (piezaAEliminar && piezaAEliminar.jugador !== pieza.jugador) {
                copia[of][oc] = null;
            }
        }
    }
    return copia;
}

// ✅ NUEVA DETECCIÓN DE JAQUE: recorre TODOS los movimientos (incluyendo cadenas de saltos)
function esJaque(jugador, tablero = board) {
    let reyPos = obtenerPosicionRey(jugador, tablero);
    if (!reyPos) return false;
    let enemigo = 1 - jugador;

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = tablero[i][j];
            if (!pieza || pieza.jugador !== enemigo) continue;

            // Obtener todos los destinos (y caminos) de esta pieza enemiga
            let movimientos = pieza.obtenerMovimientos(i, j, tablero);
            for (let dest of movimientos.destinos) {
                let fDest = Array.isArray(dest) ? dest[0] : dest.f;
                let cDest = Array.isArray(dest) ? dest[1] : dest.c;
                if (fDest !== reyPos[0] || cDest !== reyPos[1]) continue;

                // La pieza enemiga puede alcanzar la casilla del rey.
                // Verificar que el camino es legal (simularlo completamente).
                let claveDest = `${fDest},${cDest}`;
                let caminos = movimientos.caminos[claveDest];
                if (!caminos) continue;

                // El caballo (F2) puede tener múltiples rutas
                if (Array.isArray(caminos) && caminos.length > 0 && caminos[0].hasOwnProperty('pasos')) {
                    for (let ruta of caminos) {
                        let caminoReal = ruta.pasos;
                        if (!Array.isArray(caminoReal)) continue;
                        let copia = simularMovimiento(tablero, i, j, [fDest, cDest], caminoReal);
                        if (copia) return true; // Si la simulación tiene éxito, es jaque
                    }
                } else {
                    let caminoReal = Array.isArray(caminos) ? caminos : [caminos]; // asegurar array
                    let copia = simularMovimiento(tablero, i, j, [fDest, cDest], caminoReal);
                    if (copia) return true;
                }
            }
        }
    }
    return false;
}

// ----------------------------------------------------------
// FILTRO DE SEGURIDAD (SE APLICA SIEMPRE)
// ----------------------------------------------------------
function filtrarMovimientosJaque(selectedPiece, posiblesMovimientos, caminosDestino) {
    let movsSeguros = [];
    let nuevosCaminos = {};

    for (let mov of posiblesMovimientos) {
        let fDest, cDest;
        if (mov.hasOwnProperty('f')) { fDest = mov.f; cDest = mov.c; }
        else { fDest = mov[0]; cDest = mov[1]; }

        // Enroque
        if (mov.tipoMov === 'enroque') {
            let copia = clonarTablero(board);
            let [reyF, reyC] = [selectedPiece.fila, selectedPiece.col];
            copia[fDest][cDest] = copia[reyF][reyC];
            copia[reyF][reyC] = null;
            if (!esJaque(turno, copia)) {
                movsSeguros.push(mov);
                if (!nuevosCaminos[`${fDest},${cDest}`]) nuevosCaminos[`${fDest},${cDest}`] = null;
            }
            continue;
        }

        let claveMov = `${fDest},${cDest}`;
        let infoCamino = mov.caminos || caminosDestino[claveMov];
        if (!infoCamino) continue;

        let rutas = [];
        if (Array.isArray(infoCamino) && infoCamino.length > 0 && infoCamino[0].hasOwnProperty('pasos')) {
            rutas = infoCamino; // múltiples rutas (caballo)
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
