function iniciarJuego() {
    board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));

    // ------ TEMPLO IZQUIERDO (jugador 0, rojo) ------
    // fila 4 (solo col 3)
    board[4][3] = new F4(0);
    // fila 5 (cols 2,3)
    board[5][2] = new F3(0);
    board[5][3] = new F1(0);
    // fila 6 (cols 1,2,3)
    board[6][1] = new F3(0);
    board[6][2] = new F2(0);
    board[6][3] = new F1(0);
    // fila 7 (cols 0,1,2,3)
    board[7][0] = new F6(0);
    board[7][1] = new F5(0);
    board[7][2] = new F2(0);
    board[7][3] = new F1(0);
    // fila 8 (cols 1,2,3)
    board[8][1] = new F3(0);
    board[8][2] = new F2(0);
    board[8][3] = new F1(0);
    // fila 9 (cols 2,3)
    board[9][2] = new F3(0);
    board[9][3] = new F1(0);
    // fila 10 (solo col 3)
    board[10][3] = new F4(0);

    // ------ TEMPLO DERECHO (jugador 1, azul) ------
    // fila 4 (solo col 19)
    board[4][19] = new F4(1);
    // fila 5 (cols 20,19)
    board[5][20] = new F3(1);
    board[5][19] = new F1(1);
    // fila 6 (cols 21,20,19)
    board[6][21] = new F3(1);
    board[6][20] = new F2(1);
    board[6][19] = new F1(1);
    // fila 7 (cols 22,21,20,19)
    board[7][22] = new F6(1);
    board[7][21] = new F5(1);
    board[7][20] = new F2(1);
    board[7][19] = new F1(1);
    // fila 8 (cols 21,20,19)
    board[8][21] = new F3(1);
    board[8][20] = new F2(1);
    board[8][19] = new F1(1);
    // fila 9 (cols 20,19)
    board[9][20] = new F3(1);
    board[9][19] = new F1(1);
    // fila 10 (solo col 19)
    board[10][19] = new F4(1);

    turno = 0;
    selectedPiece = null;
    posiblesMovimientos = [];
    caminosDestino = {};
    historial.limpiar();
    carcela.limpiar();
    btnDeshacer.disabled = true;

    precargarImagenes(); // carga todas las imágenes de los tipos registrados

    dibujarTablero();
    actualizarTurno();
}
