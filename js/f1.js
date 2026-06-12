console.log("✅ f1.js cargado");

class F1 extends Pieza {
    constructor(jugador) { super('F1', jugador); }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const dirsMovimiento = (jugador === 0) ? [
            [-1, 1], [0, 1], [1, 1]
        ] : [
            [-1, -1], [0, -1], [1, -1]
        ];
        const dirsSalto = [
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];

        let destinos = new Set();
        let caminos = {};
        let amenazas = [];
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
                            // El movimiento simple siempre avanza porque las direcciones son de avance
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = nuevoCamino;
                        }
                    }
                }
            }

            // Saltos (cualquier dirección, en cualquier orden)
            for (let [df, dc] of dirsSalto) {
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
                                amenazas.push([nf, nc]);
                            }
                            nuevoTab[jf][jc] = ficha;
                            let nuevoCamino = [...camino, { tipo: 'jump', over: [nf, nc], to: [jf, jc] }];

                            let colFinal = jc;
                            let avance = (jugador === 0) ? (colFinal > colInicial) : (colFinal < colInicial);
                            if (avance) {
                                destinos.add(clave);
                                if (!caminos[clave]) caminos[clave] = nuevoCamino;
                            }
                            // Siempre seguir explorando, incluso si este destino no avanza
                            explorar(jf, jc, nuevoTab, nuevoCamino, visitados, true);
                        }
                    }
                }
            }

            // Captura directa en extremos (solo en direcciones de movimiento simple)
            if (!haSaltado) {
                for (let [df, dc] of dirsMovimiento) {
                    let nf = f + df, nc = c + dc;
                    if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS && esJugable(nf, nc) &&
                        tablero[nf][nc] !== null && tablero[nf][nc].jugador !== jugador) {
                        let detrasF = nf + df, detrasC = nc + dc;
                        if (!(detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS && esJugable(detrasF, detrasC))) {
                            let clave = `${nf},${nc}`;
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = [{ tipo: 'captureDirect', over: [nf, nc], to: [nf, nc] }];
                            amenazas.push([nf, nc]);
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
            let [ff, cc] = clave.split(',').map(Number);
            arr.push([ff, cc]);
        }
        return { destinos: arr, caminos, piezasAmenazadas: amenazas };
    }
}
piezasRegistradas.set('F1', F1);
