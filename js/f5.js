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

        // 2. Saltos (simple y doble) siempre disponibles como alternativa
        for (let [df, dc] of dirs) {
            // Salto simple (sobre 1 pieza)
            let over1f = fila + df, over1c = col + dc;
            let land1f = fila + df * 2, land1c = col + dc * 2;
            if (over1f >= 0 && over1f < FILAS && over1c >= 0 && over1c < COLUMNAS &&
                board[over1f][over1c] !== null &&
                land1f >= 0 && land1f < FILAS && land1c >= 0 && land1c < COLUMNAS &&
                board[land1f][land1c] === null && esJugable(land1f, land1c)) {
                let piezaSaltada = board[over1f][over1c];
                // Solo se puede saltar si es enemiga y la captura está permitida, o si es amiga (sin capturar)
                if (piezaSaltada.jugador === jugador || capturaPermitida('F5', piezaSaltada)) {
                    let clave = `${land1f},${land1c}`;
                    destinos.add(clave);
                    if (!caminos[clave]) caminos[clave] = [{ tipo: 'jump', over: [over1f, over1c], to: [land1f, land1c] }];
                }
            }

            // Salto doble (sobre 2 piezas consecutivas)
            let over2f = fila + df * 2, over2c = col + dc * 2;
            let land2f = fila + df * 3, land2c = col + dc * 3;
            if (over2f >= 0 && over2f < FILAS && over2c >= 0 && over2c < COLUMNAS &&
                board[over1f]?.[over1c] !== null &&
                board[over2f]?.[over2c] !== null &&
                land2f >= 0 && land2f < FILAS && land2c >= 0 && land2c < COLUMNAS &&
                board[land2f][land2c] === null && esJugable(land2f, land2c)) {
                let pieza1 = board[over1f][over1c];
                let pieza2 = board[over2f][over2c];
                // Ambas deben ser saltables (amigas o enemigas capturables)
                let perm1 = (pieza1.jugador === jugador || capturaPermitida('F5', pieza1));
                let perm2 = (pieza2.jugador === jugador || capturaPermitida('F5', pieza2));
                if (perm1 && perm2) {
                    let clave = `${land2f},${land2c}`;
                    destinos.add(clave);
                    if (!caminos[clave]) caminos[clave] = [{ tipo: 'jump', over: [over1f, over1c], to: [land2f, land2c], doble: true }];
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
