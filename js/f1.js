console.log("✅ f1.js cargado");

class F1 extends Pieza {
    constructor(jugador) {
        super('F1', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        // Movimiento simple: misma columna + adelante (5 direcciones, sin retroceso)
        const dirsMovimiento = (jugador === 0) ? [
            [-1, 0], [1, 0],          // misma columna
            [-1, 1], [0, 1], [1, 1]   // diagonales arriba-derecha, derecha, abajo-derecha
        ] : [
            [-1, 0], [1, 0],
            [-1, -1], [0, -1], [1, -1]
        ];
        // Saltos: las mismas 5 + las 3 opuestas (8 direcciones)
        const dirsSalto = (jugador === 0) ? [
            [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],   // adelante + vertical
            [-1, -1], [0, -1], [1, -1]                  // atrás
        ] : [
            [-1, 0], [1, 0], [-1, -1], [0, -1], [1, -1],
            [-1, 1], [0, 1], [1, 1]
        ];

        let destinos = new Set();
        let caminos = {};
        const colInicial = col;

        const explorar = (f, c, tablero, camino, visitados, haSaltado) => {
            // Movimiento simple (solo si no ha saltado)
            if (!haSaltado) {
                for (let [df, dc] of dirsMovimiento) {
                    let nf = f + df, nc = c + dc;
                    if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS &&
                        tablero[nf][nc] === null && esJugable(nf, nc)) {
                        let clave = `${nf},${nc}`;
                        if (!visitados.has(clave)) {
                            visitados.add(clave);
                            let nuevoCamino = [...camino, { tipo: 'move', to: [nf, nc] }];
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = nuevoCamino;
                        }
                    }
                }
            }

            // Saltos (siempre en las 8 direcciones)
            for (let [df, dc] of dirsSalto) {
                let nf = f + df, nc = c + dc;
                let jf = f + df * 2, jc = c + dc * 2;
                if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS && tablero[nf][nc] !== null &&
                    jf >= 0 && jf < FILAS && jc >= 0 && jc < COLUMNAS &&
                    tablero[jf][jc] === null && esJugable(jf, jc)) {
                    let piezaInter = tablero[nf][nc];
                    // Se puede saltar si es amiga o enemiga capturable
                    if (piezaInter.jugador === jugador || capturaPermitida(this.tipo, piezaInter)) {
                        let clave = `${jf},${jc}`;
                        if (!visitados.has(clave)) {
                            visitados.add(clave);
                            let colFinal = jc;
                            let avanceOk = (jugador === 0) ? (colFinal >= colInicial) : (colFinal <= colInicial);
                            if (!haSaltado || avanceOk) {
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
            }

            // Captura directa solo en extremos, usando direcciones de movimiento
            if (!haSaltado) {
                for (let [df, dc] of dirsMovimiento) {
                    let nf = f + df, nc = c + dc;
                    if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS && esJugable(nf, nc) &&
                        tablero[nf][nc] !== null && tablero[nf][nc].jugador !== jugador) {
                        let detrasF = nf + df, detrasC = nc + dc;
                        if (!(detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS &&
                              esJugable(detrasF, detrasC))) {
                            let clave = `${nf},${nc}`;
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = [{
                                tipo: 'captureDirect',
                                over: [nf, nc],
                                to: [nf, nc]
                            }];
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

piezasRegistradas.set('F1', F1);
