console.log("✅ enroque.js cargado");

// En Templos el rey puede enrocar con Torre, Alfil o Reina. Para que el
// derecho sea real (y no dependa solo de si ya se enrocó antes), tanto el rey
// como la pieza elegida deben conservar haMovido=false durante toda la partida.
const TIPOS_ENROQUE = new Set(['F0', 'F3', 'F5']);

function casillaSeguraParaReyEnTrayecto(jugador, reyFila, reyCol, f, c, tablero = board) {
    if (typeof esCasillaSeguraParaRey === 'function') {
        return esCasillaSeguraParaRey(jugador, reyFila, reyCol, f, c, tablero);
    }
    return false;
}

function validarEnroque(reyFila, reyCol, piezaFila, piezaCol, jugador, tablero = board, enroqueEstado = enroqueRealizado) {
    if (enroqueEstado?.[jugador]) return false;

    const rey = tablero[reyFila]?.[reyCol];
    const pieza = tablero[piezaFila]?.[piezaCol];
    if (!rey || rey.tipo !== 'F6' || rey.jugador !== jugador) return false;
    if (!pieza || pieza.jugador !== jugador || !TIPOS_ENROQUE.has(pieza.tipo)) return false;
    if (rey.haMovido || pieza.haMovido) return false;
    if (reyFila === piezaFila && reyCol === piezaCol) return false;

    const df = piezaFila - reyFila;
    const dc = piezaCol - reyCol;
    const dirF = df === 0 ? 0 : Math.sign(df);
    const dirC = dc === 0 ? 0 : Math.sign(dc);

    if (pieza.tipo === 'F0' && df !== 0 && dc !== 0) return false;
    if (pieza.tipo === 'F5' && Math.abs(df) !== Math.abs(dc)) return false;
    if (pieza.tipo === 'F3' && !(df === 0 || dc === 0 || Math.abs(df) === Math.abs(dc))) return false;

    // No puede iniciarse en jaque.
    if (esJaque(jugador, tablero)) return false;

    let fichasAmigas = 0;
    let f = reyFila + dirF;
    let c = reyCol + dirC;

    while (f !== piezaFila || c !== piezaCol) {
        const contenido = tablero[f]?.[c];
        if (contenido) {
            if (contenido.jugador !== jugador) return false;
            fichasAmigas++;
            if (fichasAmigas > 1) return false;

            // Si hay otra pieza apta para enrocar más cerca en la misma línea,
            // la pieza más lejana no cuenta como "la más cercana".
            if (TIPOS_ENROQUE.has(contenido.tipo)) return false;
        }

        // El rey no puede atravesar una casilla amenazada, aunque el tablero
        // permita pasar sobre una pieza amiga dentro de esta regla especial.
        if (!casillaSeguraParaReyEnTrayecto(jugador, reyFila, reyCol, f, c, tablero)) return false;
        f += dirF;
        c += dirC;
    }

    // La casilla final también debe ser segura una vez que el rey ocupa el
    // lugar de la pieza con la que se enroca.
    if (!casillaSeguraParaReyEnTrayecto(jugador, reyFila, reyCol, piezaFila, piezaCol, tablero)) return false;
    return true;
}

function obtenerEnroquesLegales(reyFila, reyCol, jugador, tablero = board, enroqueEstado = enroqueRealizado) {
    const resultado = [];
    if (enroqueEstado?.[jugador]) return resultado;
    const rey = tablero[reyFila]?.[reyCol];
    if (!rey || rey.tipo !== 'F6' || rey.jugador !== jugador || rey.haMovido) return resultado;

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            const objetivo = tablero[i][j];
            if (!objetivo || objetivo.jugador !== jugador || !TIPOS_ENROQUE.has(objetivo.tipo)) continue;
            if (validarEnroque(reyFila, reyCol, i, j, jugador, tablero, enroqueEstado)) {
                resultado.push({ f: i, c: j, tipoMov: 'enroque' });
            }
        }
    }
    return resultado;
}

function ejecutarEnroque(reyFila, reyCol, piezaFila, piezaCol, jugador) {
    if (!validarEnroque(reyFila, reyCol, piezaFila, piezaCol, jugador, board, enroqueRealizado)) return false;
    guardarEstado();
    const rey = board[reyFila][reyCol];
    const piezaEliminada = board[piezaFila][piezaCol];
    carcela.agregar(piezaEliminada);
    board[piezaFila][piezaCol] = rey;
    board[reyFila][reyCol] = null;
    rey.haMovido = true;
    enroqueRealizado[jugador] = true;
    sonidoEnroque();
    dibujarTablero();
    return true;
}
