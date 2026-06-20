console.log("✅ f5.js cargado");

class F5 extends Pieza {
    constructor(jugador) { super('F5', jugador); }

    puedeAtacarRey(fila, col, reyF, reyC, board) {
        if (Math.abs(fila - reyF) !== Math.abs(col - reyC)) return false;
        let df = reyF - fila, dc = reyC - col;
        let dirF = df / Math.abs(df);
        let dirC = dc / Math.abs(dc);
        let f = fila + dirF, c = col + dirC;
        while (f !== reyF || c !== reyC) {
            if (board[f]?.[c] !== null) return false;
            f += dirF; c += dirC;
        }
        let detrasF = reyF + dirF, detrasC = reyC + dirC;
        if (detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS && esJugable(detrasF, detrasC)) {
            return board[detrasF][detrasC] === null;
        } else {
            return true;
        }
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
        let destinos = new Set();
        let caminos = {};
        let amenazas = [];

        for (let [df, dc] of dirs) {
            let f = fila + df, c = col + dc;
            while (f >= 0 && f < FILAS && c >= 0 && c < COLUMNAS && esJugable(f, c)) {
                if (board[f][c] === null) {
                    let clave = `${f},${c}`;
                    destinos.add(clave);
                    if (!caminos[clave]) caminos[clave] = [{ tipo: 'move', to: [f, c] }];
                } else {
                    let pieza = board[f][c];
                    if (pieza.jugador !== jugador) {
                        let detrasF = f + df, detrasC = c + dc;
                        if (detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS && esJugable(detrasF, detrasC)) {
                            if (board[detrasF][detrasC] === null) {
                                let clave = `${detrasF},${detrasC}`;
                                destinos.add(clave);
                                if (!caminos[clave]) caminos[clave] = [{ tipo: 'jump', over: [f, c], to: [detrasF, detrasC] }];
                                amenazas.push([f, c]);
                            }
                        } else {
                            let clave = `${f},${c}`;
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = [{ tipo: 'captureDirect', over: [f, c], to: [f, c] }];
                            amenazas.push([f, c]);
                        }
                    }
                    break;
                }
                f += df; c += dc;
            }
        }
        let arr = [];
        for (let clave of destinos) {
            let [ff, cc] = clave.split(',').map(Number);
            arr.push([ff, cc]);
        }
        return { destinos: arr, caminos, piezasAmenazadas: amenazas };
    }
}
piezasRegistradas.set('F5', F5);
