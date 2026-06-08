console.log("✅ f2 2.js cargado");

class F2 extends Pieza {
    constructor(jugador) {
        super('F2', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        // Saltos de caballo (L) - 8 posiciones
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
                // Casilla vacía: movimiento normal
                let clave = `${nf},${nc}`;
                destinos.add(clave);
                if (!caminos[clave]) caminos[clave] = [{ tipo: 'move', to: [nf, nc] }];
            } else if (contenido.jugador !== jugador && capturaPermitida(this.tipo, contenido)) {
                // Captura: elimina la pieza enemiga y ocupa su lugar
                let clave = `${nf},${nc}`;
                destinos.add(clave);
                // Usamos tipo 'jump' con over = destino, para que tablero.js lo capture
                if (!caminos[clave]) caminos[clave] = [{
                    tipo: 'jump',
                    over: [nf, nc],  // pieza a capturar
                    to: [nf, nc]     // misma casilla
                }];
            }
            // Si es una pieza amiga, no se hace nada
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
