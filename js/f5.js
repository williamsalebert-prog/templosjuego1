console.log("✅ f5 2.js cargado");

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

                // 2 pasos (solo si la primera casilla está libre)
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
            let over1f = fila + df, over1c = col + dc;          // pieza a saltar
            if (over1f < 0 || over1f >= FILAS || over1c < 0 || over1c >= COLUMNAS) continue;
            let piezaSaltada = board[over1f][over1c];
            if (piezaSaltada === null) continue;               // no hay pieza

            // Verificar si podemos saltar sobre esta pieza (amiga o enemiga capturable)
            if (piezaSaltada.jugador === jugador ||
                capturaPermitida('F5', piezaSaltada)) {

                // Salto simple (aterrizar justo detrás de la pieza)
                let land1f = fila + df * 2, land1c = col + dc * 2;
                if (land1f >= 0 && land1f < FILAS && land1c >= 0 && land1c < COLUMNAS &&
                    board[land1f][land1c] === null && esJugable(land1f, land1c)) {
                    let clave1 = `${land1f},${land1c}`;
                    destinos.add(clave1);
                    if (!caminos[clave1]) caminos[clave1] = [{
                        tipo: 'jump',
                        over: [over1f, over1c],
                        to: [land1f, land1c]
                    }];
                }

                // Salto extendido (aterrizar dos casillas detrás de la pieza)
                let land2f = fila + df * 3, land2c = col + dc * 3;
                // Debe estar vacía la casilla intermedia (fila+df*2) y la final
                let interF = fila + df * 2, interC = col + dc * 2;
                if (interF >= 0 && interF < FILAS && interC >= 0 && interC < COLUMNAS &&
                    board[interF][interC] === null &&
                    land2f >= 0 && land2f < FILAS && land2c >= 0 && land2c < COLUMNAS &&
                    board[land2f][land2c] === null && esJugable(land2f, land2c)) {
                    let clave2 = `${land2f},${land2c}`;
                    destinos.add(clave2);
                    if (!caminos[clave2]) caminos[clave2] = [{
                        tipo: 'jump',
                        over: [over1f, over1c],
                        to: [land2f, land2c]
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
