console.log("✅ f6.js cargado");

class F6 extends Pieza {
    constructor(jugador) {
        super('F6', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const dirs = [
            [-1, 0], [1, 0], [0, -1], [0, 1],   // rectas
            [-1, -1], [-1, 1], [1, -1], [1, 1]  // diagonales
        ];
        let saltos = [];
        let movimientos = [];

        // 1. Movimientos largos (deslizantes) – solo si no hay saltos
        for (let [df, dc] of dirs) {
            let f = fila + df;
            let c = col + dc;
            while (f >= 0 && f < FILAS && c >= 0 && c < COLUMNAS && esJugable(f, c) && board[f][c] === null) {
                let clave = `${f},${c}`;
                movimientos.push({ destino: [f, c], camino: [{ tipo: 'move', to: [f, c] }] });
                f += df;
                c += dc;
            }
        }

        // 2. Movimientos en L (caballo)
        const saltosL = [[-2,-1], [-2,1], [2,-1], [2,1], [-1,-2], [-1,2], [1,-2], [1,2]];
        for (let [df, dc] of saltosL) {
            let nf = fila + df;
            let nc = col + dc;
            if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS &&
                board[nf][nc] === null && esJugable(nf, nc)) {
                let clave = `${nf},${nc}`;
                movimientos.push({ destino: [nf, nc], camino: [{ tipo: 'move', to: [nf, nc] }] });
            }
        }

        // 3. Saltos encadenados (igual que F3)
        let destinosSalto = new Set();
        let caminosSalto = {};

        const explorarSaltos = (f, c, tablero, camino, visitados) => {
            for (let [df, dc] of dirs) {
                let nf = f + df, nc = c + dc;                 // pieza adyacente
                let jf = f + df * 2, jc = c + dc * 2;        // destino del salto
                if (nf >= 0 && nf < FILAS && nc >= 0 && nc < COLUMNAS &&
                    tablero[nf][nc] !== null &&
                    jf >= 0 && jf < FILAS && jc >= 0 && jc < COLUMNAS &&
                    tablero[jf][jc] === null && esJugable(jf, jc)) {
                    let clave = `${jf},${jc}`;
                    if (!visitados.has(clave)) {
                        visitados.add(clave);
                        let nuevoTab = tablero.map(fila => fila.map(celda => {
                            if (celda === null) return null;
                            const ClasePieza = piezasRegistradas.get(celda.tipo);
                            return ClasePieza ? new ClasePieza(celda.jugador) : null;
                        }));
                        let piezaInter = nuevoTab[nf][nc];
                        let ficha = nuevoTab[f][c];
                        nuevoTab[f][c] = null;
                        if (piezaInter && piezaInter.jugador !== jugador && capturaPermitida('F6', piezaInter)) {
                            nuevoTab[nf][nc] = null;
                        }
                        nuevoTab[jf][jc] = ficha;
                        let nuevoCamino = [...camino, { tipo: 'jump', over: [nf, nc], to: [jf, jc] }];
                        destinosSalto.add(clave);
                        if (!caminosSalto[clave]) caminosSalto[clave] = nuevoCamino;
                        explorarSaltos(jf, jc, nuevoTab, nuevoCamino, visitados);
                    }
                }
            }
        };

        let visitadosSalto = new Set();
        visitadosSalto.add(`${fila},${col}`);
        explorarSaltos(fila, col, board, [], visitadosSalto);

        // Si hay saltos, solo se permiten saltos (regla de damas)
        if (destinosSalto.size > 0) {
            let destinos = [];
            let caminos = {};
            for (let clave of destinosSalto) {
                let [f, c] = clave.split(',').map(Number);
                destinos.push([f, c]);
                caminos[clave] = caminosSalto[clave];
            }
            return { destinos, caminos };
        }

        // Si no hay saltos, devolver movimientos largos y en L
        let destinos = movimientos.map(m => m.destino);
        let caminos = {};
        for (let m of movimientos) {
            let clave = `${m.destino[0]},${m.destino[1]}`;
            caminos[clave] = m.camino;
        }
        return { destinos, caminos };
    }
}

piezasRegistradas.set('F6', F6);
