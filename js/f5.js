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

        // Movimientos simples (1 o 2 pasos)
        for (let [df, dc] of dirs) {
            let nf1 = fila + df, nc1 = col + dc;
            if (nf1 >= 0 && nf1 < FILAS && nc1 >= 0 && nc1 < COLUMNAS &&
                board[nf1][nc1] === null && esJugable(nf1, nc1)) {
                let clave1 = `${nf1},${nc1}`;
                destinos.add(clave1);
                if (!caminos[clave1]) caminos[clave1] = [{ tipo: 'move', to: [nf1, nc1] }];

                let nf2 = fila + df * 2, nc2 = col + dc * 2;
                if (nf2 >= 0 && nf2 < FILAS && nc2 >= 0 && nc2 < COLUMNAS &&
                    board[nf2][nc2] === null && esJugable(nf2, nc2)) {
                    let clave2 = `${nf2},${nc2}`;
                    destinos.add(clave2);
                    if (!caminos[clave2]) caminos[clave2] = [{ tipo: 'move', to: [nf2, nc2] }];
                }
            }
        }

        // Saltos
        for (let [df, dc] of dirs) {
            let over1f = fila + df, over1c = col + dc;
            if (over1f < 0 || over1f >= FILAS || over1c < 0 || over1c >= COLUMNAS) continue;
            let piezaAdyacente = board[over1f][over1c];

            // Salto simple (sobre pieza adyacente)
            if (piezaAdyacente !== null) {
                if (piezaAdyacente.tipo === 'F4' && piezaAdyacente.jugador !== jugador && this.tipo !== 'F6') {
                    // bloqueado, no hacer nada
                } else if (piezaAdyacente.jugador === jugador || capturaPermitida('F5', piezaAdyacente)) {
                    let land1f = fila + df * 2, land1c = col + dc * 2;
                    if (land1f >= 0 && land1f < FILAS && land1c >= 0 && land1c < COLUMNAS &&
                        board[land1f][land1c] === null && esJugable(land1f, land1c)) {
                        let clave = `${land1f},${land1c}`;
                        destinos.add(clave);
                        if (!caminos[clave]) caminos[clave] = [{
                            tipo: 'jump', over: [over1f, over1c], to: [land1f, land1c]
                        }];
                    }
                }
            }

            // Salto doble (aterrizar a distancia 3 si hay al menos una pieza en distancia 1 o 2)
            let land2f = fila + df * 3, land2c = col + dc * 3;
            if (land2f >= 0 && land2f < FILAS && land2c >= 0 && land2c < COLUMNAS &&
                board[land2f][land2c] === null && esJugable(land2f, land2c)) {
                let pieza1 = board[over1f]?.[over1c];                  // distancia 1
                let pieza2 = board[fila + df * 2]?.[col + dc * 2];    // distancia 2
                let hay1 = (pieza1 !== null && pieza1 !== undefined);
                let hay2 = (pieza2 !== null && pieza2 !== undefined);
                if (hay1 || hay2) {
                    // Verificar que todas las piezas presentes permitan el salto
                    let saltables = true;
                    if (hay1) {
                        if (pieza1.tipo === 'F4' && pieza1.jugador !== jugador && this.tipo !== 'F6') saltables = false;
                        else if (pieza1.jugador !== jugador && !capturaPermitida('F5', pieza1)) saltables = false;
                    }
                    if (hay2) {
                        if (pieza2.tipo === 'F4' && pieza2.jugador !== jugador && this.tipo !== 'F6') saltables = false;
                        else if (pieza2.jugador !== jugador && !capturaPermitida('F5', pieza2)) saltables = false;
                    }
                    if (saltables) {
                        let clave = `${land2f},${land2c}`;
                        destinos.add(clave);
                        if (!caminos[clave]) caminos[clave] = [{
                            tipo: 'jump',
                            over: [over1f, over1c],
                            to: [land2f, land2c],
                            capturarVarios: true
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

piezasRegistradas.set('F5', F5);
