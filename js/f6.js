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

        // 1. Movimiento deslizante (puede saltar una pieza, pero después se detiene)
        for (let [df, dc] of dirs) {
            let f = fila + df;
            let c = col + dc;
            let haSaltado = false;

            while (f >= 0 && f < FILAS && c >= 0 && c < COLUMNAS && esJugable(f, c)) {
                if (board[f][c] === null) {
                    // Casilla vacía: destino válido
                    let clave = `${f},${c}`;
                    destinos.add(clave);
                    if (!caminos[clave]) caminos[clave] = [{ tipo: 'move', to: [f, c] }];
                    // Avanzar
                    f += df;
                    c += dc;
                } else {
                    // Hay una pieza en (f,c)
                    if (!haSaltado) {
                        // Intentar saltar sobre ella
                        let landF = f + df;
                        let landC = c + dc;
                        if (landF >= 0 && landF < FILAS && landC >= 0 && landC < COLUMNAS &&
                            board[landF][landC] === null && esJugable(landF, landC)) {
                            let piezaSaltada = board[f][c];
                            if (piezaSaltada.jugador === jugador ||
                                (typeof capturaPermitida === 'function' && capturaPermitida('F6', piezaSaltada))) {
                                // Se puede saltar: añadir destino de aterrizaje
                                let clave = `${landF},${landC}`;
                                destinos.add(clave);
                                if (!caminos[clave]) {
                                    caminos[clave] = [{
                                        tipo: 'jump',
                                        over: [f, c],
                                        to: [landF, landC]
                                    }];
                                }
                                haSaltado = true;
                                // Detenerse completamente después del salto
                                break;
                            }
                        }
                    }
                    // Si no se pudo saltar (o ya se saltó), terminamos esta dirección
                    break;
                }
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

        let arr = [];
        for (let clave of destinos) {
            let [f, c] = clave.split(',').map(Number);
            arr.push([f, c]);
        }
        return { destinos: arr, caminos };
    }
}

piezasRegistradas.set('F6', F6);
