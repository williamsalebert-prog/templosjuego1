console.log("✅ f4.js cargado");

class F4 extends Pieza {
    constructor(jugador) {
        super('F4', jugador);
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
                    // Casilla vacía: movimiento normal
                    let clave = `${f},${c}`;
                    destinos.add(clave);
                    if (!caminos[clave]) caminos[clave] = [{ tipo: 'move', to: [f, c] }];
                } else {
                    let piezaEncontrada = board[f][c];
                    if (piezaEncontrada.jugador === jugador) {
                        // Pieza amiga: puede saltarla y ocupar la casilla detrás
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
                    // Si es enemiga, el Trampero se detiene sin saltar
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

piezasRegistradas.set('F4', F4);
