if (piezaEncontrada.jugador !== jugador) {
    let detrasF = f + df;
    let detrasC = c + dc;
    // Verificar si la casilla detrás está dentro del tablero y es jugable
    if (detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS &&
        esJugable(detrasF, detrasC)) {
        // Hay una casilla detrás jugable, pero necesitamos que esté vacía para saltar
        if (board[detrasF][detrasC] === null) {
            // Salto normal (damas)
            let clave = `${detrasF},${detrasC}`;
            destinos.add(clave);
            if (!caminos[clave]) caminos[clave] = [{
                tipo: 'jump',
                over: [f, c],
                to: [detrasF, detrasC]
            }];
        }
        // Si la casilla detrás está ocupada, no se puede capturar de ninguna forma.
    } else {
        // La casilla detrás no existe o no es jugable → captura directa (extremo)
        let clave = `${f},${c}`;
        destinos.add(clave);
        if (!caminos[clave]) caminos[clave] = [{
            tipo: 'captureDirect',
            over: [f, c],
            to: [f, c]
        }];
    }
    // En cualquier caso, la torre se detiene al encontrar una pieza
    break;
}
