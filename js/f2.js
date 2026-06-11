console.log("✅ f2.js cargado");

class F2 extends Pieza {
    constructor(jugador) { super('F2', jugador); }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const saltosL = [
            [-2, -1], [-2, 1], [2, -1], [2, 1],
            [-1, -2], [-1, 2], [1, -2], [1, 2]
        ];
        let destinos = new Set();
        let caminos = {};

        for (let [df, dc] of saltosL) {
            let nf = fila + df, nc = col + dc;
            if (nf < 0 || nf >= FILAS || nc < 0 || nc >= COLUMNAS) continue;
            if (!esJugable(nf, nc)) continue;

            let contenido = board[nf][nc];

            // Caso 1: destino ocupado enemigo (solo extremo)
            if (contenido !== null) {
                if (contenido.jugador !== jugador && capturaPermitida(this.tipo, contenido)) {
                    let detrasF = nf + Math.sign(df);
                    let detrasC = nc + Math.sign(dc);
                    if (!(detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS && esJugable(detrasF, detrasC))) {
                        let clave = `${nf},${nc}`;
                        destinos.add(clave);
                        if (!caminos[clave]) caminos[clave] = [{ tipo: 'captureDirect', over: [nf, nc], to: [nf, nc] }];
                    }
                }
                continue;
            }

            // Caso 2: destino vacío → verificar todas las casillas intermedias posibles
            let intermedias = new Set(); // usaremos string "f,c"

            // Trayectoria A: primero todo el largo, luego el corto
            if (Math.abs(df) === 2) {
                intermedias.add(`${fila + Math.sign(df)},${col}`);
                intermedias.add(`${fila + 2*Math.sign(df)},${col}`);
            } else {
                intermedias.add(`${fila},${col + Math.sign(dc)}`);
                intermedias.add(`${fila},${col + 2*Math.sign(dc)}`);
            }

            // Trayectoria B: primero el corto, luego el largo
            if (Math.abs(df) === 2) {
                intermedias.add(`${fila},${col + Math.sign(dc)}`);
                intermedias.add(`${fila + Math.sign(df)},${col + Math.sign(dc)}`);
            } else {
                intermedias.add(`${fila + Math.sign(df)},${col}`);
                intermedias.add(`${fila + Math.sign(df)},${col + Math.sign(dc)}`);
            }

            let rutasValidas = [];

            // Convertir a arrays y filtrar dentro del tablero
            let casillas = [];
            for (let clave of intermedias) {
                let [ff, cc] = clave.split(',').map(Number);
                if (ff >= 0 && ff < FILAS && cc >= 0 && cc < COLUMNAS) {
                    casillas.push([ff, cc]);
                }
            }

            // Para cada casilla intermedia distinta, crear una ruta si es válida
            for (let [fInt, cInt] of casillas) {
                let pieza = board[fInt][cInt];
                let enemigo = pieza && pieza.jugador !== jugador && capturaPermitida(this.tipo, pieza);
                if (pieza && pieza.jugador !== jugador && !capturaPermitida(this.tipo, pieza)) continue; // enemigo no capturable
                let pasos = [];
                if (enemigo) pasos.push({ tipo: 'removePiece', over: [fInt, cInt] });
                pasos.push({ tipo: 'move', to: [nf, nc] });
                // Evitar duplicados (misma casilla intermedia)
                if (!rutasValidas.some(r => r.inter[0] === fInt && r.inter[1] === cInt)) {
                    rutasValidas.push({
                        inter: [fInt, cInt],
                        pasos,
                        tieneEnemigo: !!enemigo
                    });
                }
            }

            if (rutasValidas.length > 0) {
                let clave = `${nf},${nc}`;
                destinos.add(clave);
                if (!caminos[clave]) caminos[clave] = [];
                for (let r of rutasValidas) {
                    caminos[clave].push(r);
                }
            }
        }

        let arr = [];
        for (let clave of destinos) {
            let [ff, cc] = clave.split(',').map(Number);
            arr.push([ff, cc]);
        }
        return { destinos: arr, caminos, piezasAmenazadas: [] };
    }
}
piezasRegistradas.set('F2', F2);
