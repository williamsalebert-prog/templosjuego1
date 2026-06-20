console.log("✅ jaque.js cargado");

function obtenerPosicionRey(jugador, tablero = board) {
    for (let i = 0; i < FILAS; i++)
        for (let j = 0; j < COLUMNAS; j++)
            if (tablero[i][j] && tablero[i][j].tipo === 'F6' && tablero[i][j].jugador === jugador)
                return [i, j];
    return null;
}

// ✅ NUEVA DETECCIÓN DE JAQUE: revisa todos los movimientos posibles de cada enemigo,
// incluyendo saltos encadenados (F1, F6) y múltiples rutas (F2).
function esJaque(jugador, tablero = board) {
    let reyPos = obtenerPosicionRey(jugador, tablero);
    if (!reyPos) return false;
    let enemigo = 1 - jugador;

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = tablero[i][j];
            if (!pieza || pieza.jugador !== enemigo) continue;

            // Obtener todos los destinos posibles de esta pieza enemiga
            let movimientos = pieza.obtenerMovimientos(i, j, tablero);
            for (let dest of movimientos.destinos) {
                let fDest = Array.isArray(dest) ? dest[0] : dest.f;
                let cDest = Array.isArray(dest) ? dest[1] : dest.c;
                if (fDest === reyPos[0] && cDest === reyPos[1]) {
                    // Si la pieza puede mover al rey, es jaque.
                    // Pero hay que verificar que la captura sea posible (reglas de extremo, etc.)
                    // Para eso, comprobamos si el destino es accesible según las reglas reales.
                    let claveDest = `${fDest},${cDest}`;
                    let caminos = movimientos.caminos[claveDest];
                    if (!caminos) continue;

                    // Si la pieza es el caballo (F2), sus caminos pueden ser múltiples rutas.
                    // Si alguna de ellas es válida, es jaque.
                    if (Array.isArray(caminos) && caminos.length > 0 && caminos[0].hasOwnProperty('pasos')) {
                        // Caballo
                        return true; // El caballo captura sin importar el camino
                    } else if (Array.isArray(caminos)) {
                        // Pieza normal con camino único
                        let camino = caminos;
                        // Verificar que el camino es legal (no hay piezas amigas bloqueando en el último paso)
                        // Como esto es una comprobación de jaque, podemos asumir que si el destino es accesible, es jaque.
                        // La comprobación fina de extremos ya la hace obtenerMovimientos.
                        return true;
                    }
                }
            }
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

// Simula un movimiento completo (usada en el filtro de seguridad)
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
            let piezaSaltada = copia[of]?.[oc];
            if (piezaSaltada && piezaSaltada.jugador !== pieza.jugador && capturaPermitida(pieza.tipo, piezaSaltada)) {
                copia[of][oc] = null;
            }
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

// Filtro de movimientos que dejan al rey en jaque (se aplica SIEMPRE)
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
            rutas = infoCamino;
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
