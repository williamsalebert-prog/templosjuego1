console.log("✅ f3.js cargado");

class F3 extends Pieza {
    constructor(jugador) {
        super('F3', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        // 8 direcciones: ortogonales + diagonales
        const dirs = [
            [-1,0], [1,0], [0,-1], [0,1],   // rectas
            [-1,-1], [-1,1], [1,-1], [1,1]  // diagonales
        ];
        let destinos = [];
        let caminos = {};

        for (let [df, dc] of dirs) {
            let nf = fila + df, nc = col + dc;
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

piezasRegistradas.set('F3', F3);
