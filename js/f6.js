console.log("✅ f6.js cargado");

class F6 extends Pieza {
    constructor(jugador) {
        super('F6', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const dirs = [
            [-1,0], [1,0], [0,-1], [0,1],
            [-1,-1], [-1,1], [1,-1], [1,1]
        ];
        let destinos = new Set();
        let caminos = {};

        const explorar = (f, c, tablero, camino, visitados, haSaltado) => {
            // Movimiento simple (un paso) si no ha saltado
            if (!haSaltado) {
                for (let [df, dc] of dirs) {
                    let nf = f + df, nc = c + dc;
                    if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS && esJugable(nf, nc)) {
                        let contenido = tablero[nf][nc];
                        if (contenido === null) {
                            // Movimiento normal a casilla vacía
                            let clave = `${nf},${nc}`;
                            if (!visitados.has(clave)) {
                                visitados.add(clave);
                                let nuevoCamino = [...camino, { tipo: 'move', to: [nf, nc] }];
                                destinos.add(clave);
                                if (!caminos[clave]) caminos[clave] = nuevoCamino;
                            }
                        } else if (contenido.jugador !== jugador && capturaPermitida(this.tipo, contenido)) {
                            // Captura directa SOLO si es extremo (no hay casilla jugable detrás)
                            let detrasF = nf + df, detrasC = nc + dc;
                            if (!(detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS &&
                                  esJugable(detrasF, detrasC))) {
                                let clave = `${nf},${nc}`;
                                if (!visitados.has(clave)) {
                                    visitados.add(clave);
                                    let nuevoCamino = [...camino, { tipo: 'captureDirect', over: [nf, nc], to: [nf, nc] }];
                                    destinos.add(clave);
                                    if (!caminos[clave]) caminos[clave] = nuevoCamino;
                                }
                            }
                            // Si hay casilla jugable detrás, NO se ofrece captura directa (se manejará con salto si está vacía)
                        }
                    }
                }
            }

            // Saltos encadenados
            for (let [df, dc] of dirs) {
                let nf = f + df, nc = c + dc;
                let jf = f + df * 2, jc = c + dc * 2;
                if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS && tablero[nf][nc] !== null &&
                    jf >= 0 && jf < FILAS && jc >= 0 && jc < COLUMNAS &&
                    tablero[jf][jc] === null && esJugable(jf, jc)) {
                    let piezaInter = tablero[nf][nc];
                    if (piezaInter.jugador === jugador || capturaPermitida(this.tipo, piezaInter)) {
                        let clave = `${jf},${jc}`;
                        if (!visitados.has(clave)) {
                            visitados.add(clave);
                            let nuevoTab = tablero.map(fila => fila.map(celda => {
                                if (celda === null) return null;
                                const ClasePieza = piezasRegistradas.get(celda.tipo);
                                return ClasePieza ? new ClasePieza(celda.jugador) : null;
                            }));
                            let ficha = nuevoTab[f][c];
                            nuevoTab[f][c] = null;
                            if (piezaInter && piezaInter.jugador !== jugador && capturaPermitida(this.tipo, piezaInter)) {
                                nuevoTab[nf][nc] = null;
                            }
                            nuevoTab[jf][jc] = ficha;
                            let nuevoCamino = [...camino, { tipo: 'jump', over: [nf, nc], to: [jf, jc] }];
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = nuevoCamino;
                            explorar(jf, jc, nuevoTab, nuevoCamino, visitados, true);
                        }
                    }
                }
            }
        };

        let visitados = new Set();
        visitados.add(`${fila},${col}`);
        explorar(fila, col, board, [], visitados, false);

        let arr = [];
        for (let clave of destinos) {
            let [f, c] = clave.split(',').map(Number);
            arr.push([f, c]);
        }
        return { destinos: arr, caminos };
    }
}

piezasRegistradas.set('F6', F6);
