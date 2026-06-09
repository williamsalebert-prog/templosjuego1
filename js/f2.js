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

            let contenido = board[nf][nc];
            if (contenido === null) {
                // Movimiento a casilla vacía
                let clave = `${nf},${nc}`;
                destinos.add(clave);
                if (!caminos[clave]) caminos[clave] = [{ tipo: 'move', to: [nf, nc] }];
            } else if (contenido.jugador !== jugador && capturaPermitida(this.tipo, contenido)) {
                // Captura directa (el caballo captura ocupando la casilla enemiga)
                let clave = `${nf},${nc}`;
                destinos.add(clave);
                // Usamos captureDirect para que tablero.js lo procese correctamente
                if (!caminos[clave]) caminos[clave] = [{
                    tipo: 'captureDirect',
                    over: [nf, nc],
                    to: [nf, nc]
                }];
            }
            // Si hay pieza amiga, no se puede mover
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
