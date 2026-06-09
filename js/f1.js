// Captura directa solo en extremos (cuando la casilla detrás no existe o no es jugable)
for (let [df, dc] of dirsAdelante) {
    let nf = f + df, nc = c + dc;
    if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS && esJugable(nf, nc) &&
        board[nf][nc] !== null && board[nf][nc].jugador !== jugador) {
        let detrasF = nf + df, detrasC = nc + dc;
        // Si la casilla detrás NO es jugable o está fuera → extremo, captura directa
        if (!(detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS &&
              esJugable(detrasF, detrasC))) {
            let clave = `${nf},${nc}`;
            destinos.add(clave);
            if (!caminos[clave]) caminos[clave] = [{
                tipo: 'captureDirect',
                over: [nf, nc],
                to: [nf, nc]
            }];
        }
    }
}
