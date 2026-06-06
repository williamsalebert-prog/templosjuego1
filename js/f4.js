console.log("✅ f4.js cargado");

class F4 extends Pieza {
    constructor(jugador) {
        super('F4', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const dirs = [
            [-1,0], [1,0], [0,-1], [0,1],
            [-1,-1], [-1,1], [1,-1], [1,1]
        ];
        let destinos = new Set();
        let caminos = {};

        // 1. Movimiento deslizante con saltos sobre piezas (excepto F4 enemiga)
        for (let [df, dc] of dirs) {
            let f = fila + df;
            let c = col + dc;
            let caminoActual = [];  // pasos acumulados para la ruta actual

            while (f >= 0 && f < FILAS && c >= 0 && c < COLUMNAS && esJugable(f, c)) {
                if (board[f][c] === null) {
                    // Casilla vacía: destino válido
                    let clave = `${f},${c}`;
                    destinos.add(clave);
                    if (!caminos[clave]) {
                        caminos[clave] = [...caminoActual, { tipo: 'move', to: [f, c] }];
                    }
                    // Avanzar
                    caminoActual.push({ tipo: 'move', to: [f, c] });
                    f += df;
                    c += dc;
                } else {
                    // Hay una pieza en (f,c)
                    let pieza = board[f][c];
                    // Si es una F4 enemiga, bloquea completamente
                    if (pieza.tipo === 'F4' && pieza.jugador !== jugador) {
                        break; // detener deslizamiento en esta dirección
                    }
                    // Intentar saltar sobre ella (aliada o enemiga no F4)
                    let landF = f + df;
                    let landC = c + dc;
                    if (landF >= 0 && landF < FILAS && landC >= 0 && landC < COLUMNAS &&
                        board[landF][landC] === null && esJugable(landF, landC)) {
                        // Se puede saltar
                        let claveSalto = `${landF},${landC}`;
                        let caminoSalto = [...caminoActual, {
                            tipo: 'jump',
                            over: [f, c],
                            to: [landF, landC]
                        }];
                        destinos.add(claveSalto);
                        if (!caminos[claveSalto]) caminos[claveSalto] = caminoSalto;
                        // Continuar deslizándose desde landF, landC
                        caminoActual = caminoSalto; // actualizar camino para siguientes pasos
                        f = landF + df;
                        c = landC + dc;
                    } else {
                        // No se puede saltar (casilla de aterrizaje ocupada o fuera del tablero)
                        break;
                    }
                }
            }
        }

        // 2. Movimiento en L (caballo) – salta sobre cualquier pieza, solo a casilla vacía
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
