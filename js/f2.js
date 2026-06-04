console.log("✅ f2.js cargado");

class F2 extends Pieza {
    constructor(jugador) {
        super('F2', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        // Solo 4 direcciones diagonales
        const dirs = [[-1,-1], [-1,1], [1,-1], [1,1]];
        let destinos = new Set();
        let caminos = {};

        const explorar = (f, c, tablero, camino, visitados, haSaltado) => {
            // Movimiento simple (solo si no se ha saltado)
            if (!haSaltado) {
                for (let [df, dc] of dirs) {
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

            // Saltos diagonales
            for (let [df, dc] of dirs) {
                let nf = f + df, nc = c + dc;                 // pieza adyacente
                let jf = f + df * 2, jc = c + dc * 2;        // destino del salto
                if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS &&
                    tablero[nf][nc] !== null &&               // hay pieza sobre la que saltar
                    jf >= 0 && jf < FILAS && jc >= 0 && jc < COLUMNAS &&
                    tablero[jf][jc] === null && esJugable(jf, jc)) {
                    let clave = `${jf},${jc}`;
                    if (!visitados.has(clave)) {
                        visitados.add(clave);
                        // Clonar el tablero para simular el salto
                        let nuevoTab = tablero.map(fila => fila.map(celda => {
                            if (celda === null) return null;
                            const ClasePieza = piezasRegistradas.get(celda.tipo);
                            return ClasePieza ? new ClasePieza(celda.jugador) : null;
                        }));
                        let piezaInter = nuevoTab[nf][nc];
                        let ficha = nuevoTab[f][c];
                        nuevoTab[f][c] = null;
                        // Capturar solo si es enemiga
                        if (piezaInter && piezaInter.jugador !== jugador) {
                            nuevoTab[nf][nc] = null;
                        }
                        nuevoTab[jf][jc] = ficha;
                        let nuevoCamino = [...camino, { tipo: 'jump', over: [nf, nc], to: [jf, jc] }];
                        destinos.add(clave);
                        if (!caminos[clave]) caminos[clave] = nuevoCamino;
                        // Seguir saltando desde la nueva posición
                        explorar(jf, jc, nuevoTab, nuevoCamino, visitados, true);
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

piezasRegistradas.set('F2', F2);
