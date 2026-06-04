console.log("✅ f6.js cargado");

class F6 extends Pieza {
    constructor(jugador) {
        super('F6', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        let destinos = [];
        let caminos = {};

        // 8 direcciones para deslizamiento largo
        const dirs = [
            [-1, 0], [1, 0], [0, -1], [0, 1],   // rectas
            [-1, -1], [-1, 1], [1, -1], [1, 1]  // diagonales
        ];

        // 1. Movimiento deslizante: avanza hasta chocar con pieza o límite
        for (let [df, dc] of dirs) {
            let f = fila + df;
            let c = col + dc;
            while (f >= 0 && f < FILAS && c >= 0 && c < COLUMNAS && esJugable(f, c) && board[f][c] === null) {
                let clave = `${f},${c}`;
                destinos.push([f, c]);
                caminos[clave] = [{ tipo: 'move', to: [f, c] }];
                f += df;
                c += dc;
            }
        }

        // 2. Movimiento en L (caballo): 8 saltos posibles
        const saltosL = [
            [-2, -1], [-2, 1], [2, -1], [2, 1],
            [-1, -2], [-1, 2], [1, -2], [1, 2]
        ];
        for (let [df, dc] of saltosL) {
            let nf = fila + df;
            let nc = col + dc;
            if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS &&
                board[nf][nc] === null && esJugable(nf, nc)) {
                let clave = `${nf},${nc}`;
                destinos.push([nf, nc]);
                caminos[clave] = [{ tipo: 'move', to: [nf, nc] }];
            }
        }

        return { destinos, caminos };
    }
}

piezasRegistradas.set('F6', F6);
