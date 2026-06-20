console.log("✅ enroque.js cargado");

function validarEnroque(reyFila, reyCol, piezaFila, piezaCol, jugador) {
    if (enroqueRealizado[jugador]) return false;
    const pieza = board[piezaFila][piezaCol];
    if (!pieza || pieza.jugador !== jugador || !['F3','F0','F5'].includes(pieza.tipo)) return false;
    if (reyFila === piezaFila && reyCol === piezaCol) return false;
    let df = piezaFila - reyFila, dc = piezaCol - reyCol;
    let dirF = df === 0 ? 0 : df / Math.abs(df);
    let dirC = dc === 0 ? 0 : dc / Math.abs(dc);
    if (pieza.tipo === 'F0' && df !== 0 && dc !== 0) return false;
    if (pieza.tipo === 'F5' && Math.abs(df) !== Math.abs(dc)) return false;
    if (pieza.tipo === 'F3' && !(df === 0 || dc === 0 || Math.abs(df) === Math.abs(dc))) return false;
    let fichasAmigas = 0;
    let f = reyFila + dirF, c = reyCol + dirC;
    while (f !== piezaFila || c !== piezaCol) {
        if (board[f][c]) {
            if (board[f][c].jugador === jugador) fichasAmigas++;
            else return false;
        }
        f += dirF; c += dirC;
    }
    return fichasAmigas <= 1;
}

function ejecutarEnroque(reyFila, reyCol, piezaFila, piezaCol, jugador) {
    guardarEstado();
    let piezaEliminada = board[piezaFila][piezaCol];
    carcela.agregar(piezaEliminada);
    board[piezaFila][piezaCol] = board[reyFila][reyCol];
    board[reyFila][reyCol] = null;
    enroqueRealizado[jugador] = true;
    sonidoEnroque();
    dibujarTablero();
}
