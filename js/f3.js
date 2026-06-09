console.log("✅ f3.js cargado");

class F3 extends Pieza {
    constructor(jugador) {
        super('F3', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const dirs = [
            [-1,0], [1,0], [0,-1], [0,1],
            [-1,-1], [-1,1], [1,-1], [1,1]
        ];
        let destinos = new Set();
        let caminos = {};

        for (let [df, dc] of dirs) {
            let f = fila + df;
            let c = col + dc;
            while (f >= 0 && f < FILAS && c >= 0 && c < COLUMNAS && esJugable(f, c)) {
                if (board[f][c] === null) {
                    // Casilla vacía
                    let clave = `${f},${c}`;
                    destinos.add(clave);
                    if (!caminos[clave]) caminos[clave] = [{ tipo: 'move', to: [f, c] }];
                } else {
                    let piezaEncontrada = board[f][c];
                    if (piezaEncontrada.jugador !== jugador) {
                        // Enemiga: intentar salto o captura directa si no hay detrás
                        let detrasF = f + df, detrasC = c + dc;
                        if (detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS &&
                            board[detrasF][detrasC] === null && esJugable(detrasF, detrasC)) {
                            // Salto normal
                            let clave = `${detrasF},${detrasC}`;
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = [{
                                tipo: 'jump',
                                over: [f, c],
                                to: [detrasF, detrasC]
                            }];
                        } else {
                            // Extremo: captura directa
                            let clave = `${f},${c}`;
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = [{
                                tipo: 'captureDirect',
                                over: [f, c],
                                to: [f, c]
                            }];
                        }
                    } else {
                        // Pieza amiga: puede saltarla (apoyo)
                        let detrasF = f + df, detrasC = c + dc;
                        if (detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS &&
                            board[detrasF][detrasC] === null && esJugable(detrasF, detrasC)) {
                            let clave = `${detrasF},${detrasC}`;
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = [{
                                tipo: 'jump',
                                over: [f, c],
                                to: [detrasF, detrasC]
                            }];
                        }
                    }
                    // La reina se detiene al encontrar cualquier pieza (no puede seguir deslizándose)
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

piezasRegistradas.set('F3', F3);
