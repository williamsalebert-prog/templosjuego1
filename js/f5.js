console.log("✅ f5.js cargado");

class F5 extends Pieza {
    constructor(jugador) {
        super('F5', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const dirs = [
            [-1,0], [1,0], [0,-1], [0,1],
            [-1,-1], [-1,1], [1,-1], [1,1]
        ];
        let destinos = new Set();
        let caminos = {};

        // 1. Movimientos simples (1 o 2 casillas) siempre disponibles
        for (let [df, dc] of dirs) {
            // 1 paso
            let nf1 = fila + df, nc1 = col + dc;
            if (nf1 >= 0 && nf1 < FILAS && nc1 >= 0 && nc1 < COLUMNAS &&
                board[nf1][nc1] === null && esJugable(nf1, nc1)) {
                let clave1 = `${nf1},${nc1}`;
                destinos.add(clave1);
                if (!caminos[clave1]) caminos[clave1] = [{ tipo: 'move', to: [nf1, nc1] }];

                // 2 pasos (si la primera casilla está libre)
                let nf2 = fila + df * 2, nc2 = col + dc * 2;
                if (nf2 >= 0 && nf2 < FILAS && nc2 >= 0 && nc2 < COLUMNAS &&
                    board[nf2][nc2] === null && esJugable(nf2, nc2)) {
                    let clave2 = `${nf2},${nc2}`;
                    destinos.add(clave2);
                    if (!caminos[clave2]) caminos[clave2] = [{ tipo: 'move', to: [nf2, nc2] }];
                }
            }
        }

        // 2. Saltos sobre una pieza (simple y extendido)
        for (let [df, dc] of dirs) {
            let overF = fila + df, overC = col + dc;          // pieza a saltar
            if (overF < 0 || overF >= FILAS || overC < 0 || overC >= COLUMNAS) continue;
            let piezaSaltada = board[overF][overC];
            if (piezaSaltada === null) continue;               // no hay pieza

            // Se puede saltar si es amiga o enemiga capturable
            if (piezaSaltada.jugador === jugador || capturaPermitida('F5', piezaSaltada)) {

                // Salto simple (detrás de la pieza)
                let land1F = fila + df * 2, land1C = col + dc * 2;
                if (land1F >= 0 && land1F < FILAS && land1C >= 0 && land1C < COLUMNAS &&
                    board[land1F][land1C] === null && esJugable(land1F, land1C)) {
                    let clave1 = `${land1F},${land1C}`;
                    destinos.add(clave1);
                    if (!caminos[clave1]) caminos[clave1] = [{
                        tipo: 'jump',
                        over: [overF, overC],
                        to: [land1F, land1C]
                    }];
                }

                // Salto extendido (dos detrás de la pieza, si la casilla intermedia está vacía)
                let land2F = fila + df * 3, land2C = col + dc * 3;
                let interF = fila + df * 2, interC = col + dc * 2;
                if (interF >= 0 && interF < FILAS && interC >= 0 && interC < COLUMNAS &&
                    board[interF][interC] === null &&
                    land2F >= 0 && land2F < FILAS && land2C >= 0 && land2C < COLUMNAS &&
                    board[land2F][land2C] === null && esJugable(land2F, land2C)) {
                    let clave2 = `${land2F},${land2C}`;
                    destinos.add(clave2);
                    if (!caminos[clave2]) caminos[clave2] = [{
                        tipo: 'jump',
                        over: [overF, overC],
                        to: [land2F, land2C]
                    }];
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

piezasRegistradas.set('F5', F5);
