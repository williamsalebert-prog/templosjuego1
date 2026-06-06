console.log("✅ f4.js cargado");

class F4 extends Pieza {
    constructor(jugador) {
        super('F4', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const dirs = [
            [-1,0], [1,0], [0,-1], [0,1],          // rectas
            [-1,-1], [-1,1], [1,-1], [1,1]         // diagonales
        ];
        let destinos = new Set();
        let caminos = {};

        // 1. Movimiento deslizante (se detiene después de saltar una pieza)
        for (let [df, dc] of dirs) {
            let f = fila + df;
            let c = col + dc;
            let haSaltado = false;

            while (f >= 0 && f < FILAS && c >= 0 && c < COLUMNAS && esJugable(f, c)) {
                if (board[f][c] === null) {
                    // Casilla vacía: destino permitido
                    let clave = `${f},${c}`;
                    destinos.add(clave);
                    if (!caminos[clave]) caminos[clave] = [{ tipo: 'move', to: [f, c] }];
                    // Avanzar si no hemos saltado ya
                    f += df;
                    c += dc;
                } else {
                    // Hay una pieza
                    if (!haSaltado) {
                        // Intentar saltarla
                        let landF = f + df;
                        let landC = c + dc;
                        if (landF >= 0 && landF < FILAS && landC >= 0 && landC < COLUMNAS &&
                            board[landF][landC] === null && esJugable(landF, landC)) {
                            // Se puede saltar: añadir destino y detenerse
                            let clave = `${landF},${landC}`;
                            destinos.add(clave);
                            if (!caminos[clave]) {
                                caminos[clave] = [{
                                    tipo: 'jump',
                                    over: [f, c],
                                    to: [landF, landC]
                                }];
                            }
                            haSaltado = true; // ya no seguirá moviéndose
                        }
                    }
                    // En cualquier caso (saltado o no), paramos en esta dirección
                    break;
                }
            }
        }

        // 2. Movimiento en L (caballo) – solo a casillas vacías
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

        let arr = [];
        for (let clave of destinos) {
            let [f, c] = clave.split(',').map(Number);
            arr.push([f, c]);
        }
        return { destinos: arr, caminos };
    }
}

piezasRegistradas.set('F4', F4);
