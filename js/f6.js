console.log("✅ f6.js cargado");

class F6 extends Pieza {
    constructor(jugador) {
        super('F6', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const dirs = [
            [-1,0], [1,0], [0,-1], [0,1],          // rectas
            [-1,-1], [-1,1], [1,-1], [1,1]         // diagonales
        ];
        let destinos = new Set();
        let caminos = {};

        // 1. Movimiento deslizante en 8 direcciones (hasta chocar con pieza o límite)
        for (let [df, dc] of dirs) {
            let f = fila + df;
            let c = col + dc;
            while (f >= 0 && f < FILAS && c >= 0 && c < COLUMNAS &&
                   esJugable(f, c) && board[f][c] === null) {
                let clave = `${f},${c}`;
                destinos.add(clave);
                if (!caminos[clave]) caminos[clave] = [{ tipo: 'move', to: [f, c] }];
                f += df;
                c += dc;
            }
        }

        // 2. Movimiento en L (caballo) – solo a casillas vacías, no captura
        const saltosL = [
            [-2,-1], [-2,1], [2,-1], [2,1],
            [-1,-2], [-1,2], [1,-2], [1,2]
        ];
        for (let [df, dc] of saltosL) {
            let nf = fila + df;
            let nc = col + dc;
            if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS &&
                board[nf][nc] === null && esJugable(nf, nc)) {
                let clave = `${nf},${nc}`;
                destinos.add(clave);
                if (!caminos[clave]) caminos[clave] = [{ tipo: 'move', to: [nf, nc] }];
            }
        }

        // 3. Salto único sobre una pieza adyacente (amiga o enemiga)
        for (let [df, dc] of dirs) {
            let overF = fila + df, overC = col + dc;          // pieza a saltar
            let landF = fila + df * 2, landC = col + dc * 2;  // destino del salto
            if (overF >= 0 && overF < FILAS && overC >= 0 && overC < COLUMNAS &&
                board[overF][overC] !== null &&
                landF >= 0 && landF < FILAS && landC >= 0 && landC < COLUMNAS &&
                board[landF][landC] === null && esJugable(landF, landC)) {
                let piezaSaltada = board[overF][overC];
                // Permitir salto si es amiga, o si es enemiga y la captura está permitida
                if (piezaSaltada.jugador === jugador ||
                    (typeof capturaPermitida === 'function' && capturaPermitida('F6', piezaSaltada))) {
                    let clave = `${landF},${landC}`;
                    destinos.add(clave);
                    if (!caminos[clave]) {
                        caminos[clave] = [{
                            tipo: 'jump',
                            over: [overF, overC],
                            to: [landF, landC]
                        }];
                    }
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

piezasRegistradas.set('F6', F6);
