console.log("✅ f2.js cargado");

class F2 extends Pieza {
    constructor(jugador) {
        super('F2', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const saltosL = [
            [-2, -1], [-2, 1], [2, -1], [2, 1],
            [-1, -2], [-1, 2], [1, -2], [1, 2]
        ];
        let destinos = new Set();
        let caminos = {};

        for (let [df, dc] of saltosL) {
            let nf = fila + df, nc = col + dc;
            if (nf < 0 || nf >= FILAS || nc < 0 || nc >= COLUMNAS) continue;
            if (!esJugable(nf, nc)) continue;

            // Para que el caballo pueda saltar, la casilla destino debe estar vacía
            if (board[nf][nc] !== null) continue;

            // Determinar las dos casillas intermedias del salto en L
            let inter1f, inter1c, inter2f, inter2c;
            if (Math.abs(df) === 2) {
                inter1f = fila + Math.sign(df);
                inter1c = col;
                inter2f = fila + df - Math.sign(df);
                inter2c = nc;
            } else { // df = ±1, dc = ±2
                inter1f = fila;
                inter1c = col + Math.sign(dc);
                inter2f = nf;
                inter2c = col + dc - Math.sign(dc);
            }

            let pieza1 = board[inter1f]?.[inter1c];
            let pieza2 = board[inter2f]?.[inter2c];
            let enemiga = null;

            // Buscar si hay una pieza enemiga en las casillas intermedias
            if (pieza1 && pieza1.jugador !== jugador && capturaPermitida(this.tipo, pieza1)) {
                enemiga = { f: inter1f, c: inter1c };
            } else if (pieza2 && pieza2.jugador !== jugador && capturaPermitida(this.tipo, pieza2)) {
                enemiga = { f: inter2f, c: inter2c };
            }

            // Si hay una pieza amiga en el camino, no se permite el movimiento
            if ((pieza1 && pieza1.jugador === jugador) || (pieza2 && pieza2.jugador === jugador)) {
                continue;
            }

            let clave = `${nf},${nc}`;
            destinos.add(clave);
            if (!caminos[clave]) {
                if (enemiga) {
                    // Salto sobre la enemiga
                    caminos[clave] = [{
                        tipo: 'jump',
                        over: [enemiga.f, enemiga.c],
                        to: [nf, nc]
                    }];
                } else {
                    // Movimiento simple
                    caminos[clave] = [{ tipo: 'move', to: [nf, nc] }];
                }
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

piezasRegistradas.set('F2', F2);
