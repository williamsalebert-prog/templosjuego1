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

// ✅ DETECCIÓN DE JAQUE: recorre TODOS los caminos registrados de cada pieza enemiga
// (incluyendo cadenas de saltos completas de F1 y F6) y comprueba si en CUALQUIER
// paso del camino se captura la casilla del rey, sea o no el destino final del
// movimiento. Esto es imprescindible para F1 y F6, ya que al encadenar saltos el
// rey puede ser "comido" en mitad de la cadena mientras la pieza atacante sigue
// saltando y termina su turno varias casillas más allá.
function esJaque(jugador, tablero = board) {
    let reyPos = obtenerPosicionRey(jugador, tablero);
    if (!reyPos) return false;
    let [reyF, reyC] = reyPos;
    let enemigo = 1 - jugador;

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = tablero[i][j];
            if (!pieza || pieza.jugador !== enemigo) continue;

            // Obtener todos los movimientos (y caminos) de esta pieza enemiga
            let movimientos = pieza.obtenerMovimientos(i, j, tablero);

            for (let clave in movimientos.caminos) {
                let infoCamino = movimientos.caminos[clave];
                if (!infoCamino) continue;

                // El caballo (F2) puede tener múltiples rutas para un mismo destino
                let rutas;
                if (Array.isArray(infoCamino) && infoCamino.length > 0 && infoCamino[0].hasOwnProperty('pasos')) {
                    rutas = infoCamino.map(r => r.pasos);
                } else {
                    rutas = [infoCamino];
                }

                for (let caminoReal of rutas) {
                    if (!Array.isArray(caminoReal)) continue;
                    for (let paso of caminoReal) {
                        if (!paso.over) continue;
                        if ((paso.tipo === 'jump' || paso.tipo === 'captureDirect' || paso.tipo === 'removePiece') &&
                            paso.over[0] === reyF && paso.over[1] === reyC) {
                            return true; // El rey es capturado en algún punto de un camino legal
                        }
                    }
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
