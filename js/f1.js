console.log("✅ f1.js cargado");

class F1 extends Pieza {
    constructor(jugador) {
        super('F1', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        let destinos = new Set();
        let caminos = {};

        const explorar = (f, c, tablero, camino, visitados, haSaltado) => {
            if (!haSaltado) {
                for (let [df, dc] of dirs) {
                    let nf = f+df, nc = c+dc;
                    if (nf>=0 && nf<FILAS && nc>=0 && nc<COLUMNAS &&
                        tablero[nf][nc]===null && esJugable(nf, nc)) {
                        let clave = `${nf},${nc}`;
                        if (!visitados.has(clave)) {
                            visitados.add(clave);
                            let nuevoCamino = [...camino, {tipo:'move', to:[nf,nc]}];
                            destinos.add(clave);
                            if (!caminos[clave]) caminos[clave] = nuevoCamino;
                        }
                    }
                }
            }
            for (let [df, dc] of dirs) {
                let nf = f+df, nc = c+dc;
                let jf = f+df*2, jc = c+dc*2;
                if (nf>=0 && nf<FILAS && nc>=0 && nc<COLUMNAS && tablero[nf][nc]!==null &&
                    jf>=0 && jf<FILAS && jc>=0 && jc<COLUMNAS &&
                    tablero[jf][jc]===null && esJugable(jf, jc)) {
                    let piezaInter = tablero[nf][nc];
                    // Bloquear salto sobre F4 enemiga a menos que seas F6
                    if (piezaInter.tipo === 'F4' && piezaInter.jugador !== jugador && this.tipo !== 'F6') continue;
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
                        let nuevoCamino = [...camino, {tipo:'jump', over:[nf,nc], to:[jf,jc]}];
                        destinos.add(clave);
                        if (!caminos[clave]) caminos[clave] = nuevoCamino;
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

piezasRegistradas.set('F1', F1);
