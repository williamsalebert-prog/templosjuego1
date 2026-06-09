console.log("✅ f0.js cargado");

class F0 extends Pieza {
    constructor(jugador) {
        super('F0', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        // Solo líneas rectas (horizontal/vertical)
        const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
        let destinos = new Set();
        let caminos = {};

        for (let [df, dc] of dirs) {
            let f = fila + df;
            let c = col + dc;
            while (f >= 0 && f < FILAS && c >= 0 && c < COLUMNAS && esJugable(f, c)) {
                if (board[f][c] === null) {
                    // Casilla vacía: movimiento normal
                    let clave = `${f},${c}`;
                    destinos.add(clave);
                    if (!caminos[clave]) caminos[clave] = [{ tipo: 'move', to: [f, c] }];
                } else {
                    // Hay una pieza
                    let piezaEncontrada = board[f][c];
                    if (piezaEncontrada.jugador !== jugador) {
                        // Es enemiga: intentar salto o captura directa si no hay espacio detrás
                        let detrasF = f + df;
                        let detrasC = c + dc;
                        if (detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS &&
                            board[detrasF][detrasC] === null && esJugable(detrasF, detrasC)) {
                            // Salto normal (damas)
                            let clave = `${detrasF},${detrasC}`;
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = [{
                                tipo: 'jump',
                                over: [f, c],
                                to: [detrasF, detrasC]
                            }];
                        } else {
                            // Extremo: no hay casilla detrás → captura directa
                            let clave = `${f},${c}`;
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = [{
                                tipo: 'captureDirect',
                                over: [f, c],
                                to: [f, c]
                            }];
                        }
                    }
                    // En cualquier caso, la torre se detiene al encontrar una pieza
                    break;
                }
                f += df;
                c += dc;
            }
        }
        let arr = [];
        for (let clave of destinos) {
            let [f, c] = clave.split(',').map(Number);
            arr.push([f, c]);
        }
        return { destinos: arr, caminos };
    }
}

piezasRegistradas.set('F0', F0);
