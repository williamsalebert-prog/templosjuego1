console.log("✅ f2.js cargado");

class F2 extends Pieza {
    constructor(jugador) {
        super('F2', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const dirsDiagonal = [[-1,-1], [-1,1], [1,-1], [1,1]]; // solo 4 diagonales
        let destinos = [];
        let caminos = {};

        for (let [df, dc] of dirsDiagonal) {
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

piezasRegistradas.set('F2', F2);
