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
    // Las simulaciones de legalidad nunca modifican propiedades internas de
    // las piezas: solo cambian referencias entre casillas. Copiar los 150
    // objetos Pieza en CADA candidato era uno de los costes principales del
    // motor. Basta clonar las filas y compartir piezas inmutables.
    return tablero.map(fila => fila.slice());
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

// Comprueba si una pieza enemiga puede capturar una casilla concreta mediante
// alguno de sus caminos REALES. Se usa tanto para detectar jaque como para
// resaltar al atacante, evitando dos definiciones distintas de "amenaza".
function piezaAmenazaCasillaPorCaminos(pieza, fila, col, objetivoF, objetivoC, tablero) {
    // Rey contra Rey es una amenaza adyacente directa. No generamos aquí los
    // movimientos completos del rey porque estos, a su vez, preguntan qué
    // casillas están amenazadas y crearíamos una recursión circular.
    if (pieza.tipo === 'F6') {
        return Math.max(Math.abs(fila - objetivoF), Math.abs(col - objetivoC)) === 1;
    }

    // Torre/Reina/Alfil no tienen cadenas: su método directo comprueba la
    // misma línea de captura y la casilla de aterrizaje tras el rey, pero sin
    // construir TODOS sus destinos/caminos. El Trampero nunca ataca al rey.
    // Este atajo se ejecuta miles de veces dentro de la búsqueda de la IA.
    if (pieza.tipo === 'F4') return false;
    if (pieza.tipo === 'F0' || pieza.tipo === 'F3' || pieza.tipo === 'F5') {
        return pieza.puedeAtacarRey(fila, col, objetivoF, objetivoC, tablero);
    }

    const movimientos = pieza.obtenerMovimientos(fila, col, tablero);
    if (!movimientos || !movimientos.caminos) return false;

    for (const clave in movimientos.caminos) {
        const infoCamino = movimientos.caminos[clave];
        if (!infoCamino) continue;

        let rutas;
        if (Array.isArray(infoCamino) && infoCamino.length > 0 &&
            infoCamino[0] && Object.prototype.hasOwnProperty.call(infoCamino[0], 'pasos')) {
            rutas = infoCamino.map(r => r.pasos);
        } else {
            rutas = [infoCamino];
        }

        for (const caminoReal of rutas) {
            if (!Array.isArray(caminoReal)) continue;
            for (const paso of caminoReal) {
                if (!Array.isArray(paso.over)) continue;
                if ((paso.tipo === 'jump' || paso.tipo === 'captureDirect' || paso.tipo === 'removePiece') &&
                    paso.over[0] === objetivoF && paso.over[1] === objetivoC) {
                    return true;
                }
            }
        }
    }
    return false;
}


// Evalúa una casilla VACÍA (o capturada) como destino del rey colocando una
// copia del rey allí antes de preguntar por jaque. Esto es distinto de mirar
// los caminos enemigos sobre el tablero original: una pieza de salto solo
// puede "ver" al rey si el rey existe realmente en la casilla candidata.
function esCasillaSeguraParaRey(jugador, origenF, origenC, destinoF, destinoC, tablero = board) {
    const copia = clonarTablero(tablero);
    let rey = copia[origenF]?.[origenC];
    if (!rey || rey.tipo !== 'F6' || rey.jugador !== jugador) {
        const pos = obtenerPosicionRey(jugador, copia);
        if (!pos) return false;
        [origenF, origenC] = pos;
        rey = copia[origenF][origenC];
    }
    copia[origenF][origenC] = null;
    copia[destinoF][destinoC] = rey;
    return !esJaque(jugador, copia);
}

// DETECCIÓN DE JAQUE: una sola fuente de verdad basada en los caminos reales
// que genera cada pieza, incluidos saltos encadenados y rutas del caballo.
function esJaque(jugador, tablero = board) {
    const reyPos = obtenerPosicionRey(jugador, tablero);
    if (!reyPos) return false;
    const [reyF, reyC] = reyPos;
    const enemigo = 1 - jugador;

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            const pieza = tablero[i][j];
            if (!pieza || pieza.jugador !== enemigo) continue;
            if (piezaAmenazaCasillaPorCaminos(pieza, i, j, reyF, reyC, tablero)) return true;
        }
    }
    return false;
}

// Devuelve las piezas que dan jaque usando EXACTAMENTE el mismo criterio que
// esJaque(). Antes esta función usaba puedeAtacarRey(), lo que podía hacer que
// el juego detectara un jaque pero resaltara otra cosa (o ninguna).
function obtenerPiezasQueDanJaque(jugador, tablero = board) {
    const reyPos = obtenerPosicionRey(jugador, tablero);
    if (!reyPos) return [];
    const [reyF, reyC] = reyPos;
    const enemigo = 1 - jugador;
    const atacantes = [];

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            const pieza = tablero[i][j];
            if (!pieza || pieza.jugador !== enemigo) continue;
            if (piezaAmenazaCasillaPorCaminos(pieza, i, j, reyF, reyC, tablero)) atacantes.push([i, j]);
        }
    }
    return atacantes;
}

// ----------------------------------------------------------
// FILTRO DE SEGURIDAD (SE APLICA SIEMPRE)
// ----------------------------------------------------------
function filtrarMovimientosJaque(selectedPiece, posiblesMovimientos, caminosDestino, tablero = board, jugador = turno) {
    const movsSeguros = [];
    const nuevosCaminos = {};

    for (const mov of posiblesMovimientos) {
        let fDest, cDest;
        if (Object.prototype.hasOwnProperty.call(mov, 'f')) { fDest = mov.f; cDest = mov.c; }
        else { fDest = mov[0]; cDest = mov[1]; }

        // Enroque: por ahora conserva la validación final existente. La
        // validación histórica/recorrido completo se abordará en una tanda
        // posterior junto con los derechos de enroque.
        if (mov.tipoMov === 'enroque') {
            const copia = clonarTablero(tablero);
            const [reyF, reyC] = [selectedPiece.fila, selectedPiece.col];
            copia[fDest][cDest] = copia[reyF][reyC];
            copia[reyF][reyC] = null;
            if (!esJaque(jugador, copia)) {
                movsSeguros.push(mov);
                nuevosCaminos[`${fDest},${cDest}`] = null;
            }
            continue;
        }

        const claveMov = `${fDest},${cDest}`;
        const infoCamino = mov.caminos || caminosDestino[claveMov];
        if (!infoCamino) continue;

        const esMultiRuta = Array.isArray(infoCamino) && infoCamino.length > 0 &&
            infoCamino[0] && Object.prototype.hasOwnProperty.call(infoCamino[0], 'pasos');
        const rutas = esMultiRuta ? infoCamino : [{ pasos: infoCamino }];
        const rutasSeguras = [];

        for (const ruta of rutas) {
            const caminoReal = ruta.pasos;
            if (!Array.isArray(caminoReal)) continue;
            const nuevoTab = simularMovimiento(tablero, selectedPiece.fila, selectedPiece.col, [fDest, cDest], caminoReal);
            if (nuevoTab && !esJaque(jugador, nuevoTab)) rutasSeguras.push(ruta);
        }

        if (rutasSeguras.length === 0) continue;
        movsSeguros.push(mov);
        // Punto importante para el caballo: si dos rutas llegan al mismo
        // destino pero una deja al rey en jaque, SOLO sobrevive la ruta legal.
        nuevosCaminos[claveMov] = esMultiRuta ? rutasSeguras : infoCamino;
    }

    const tempCaminos = {};
    for (const mov of movsSeguros) {
        let fDest, cDest;
        if (Object.prototype.hasOwnProperty.call(mov, 'f')) { fDest = mov.f; cDest = mov.c; }
        else { fDest = mov[0]; cDest = mov[1]; }
        const claveMov = `${fDest},${cDest}`;
        tempCaminos[claveMov] = mov.tipoMov === 'enroque' ? null : nuevosCaminos[claveMov];
    }

    return { posiblesMovimientos: movsSeguros, caminosDestino: tempCaminos };
}
