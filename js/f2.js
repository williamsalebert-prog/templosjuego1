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

            // --- Caso 1: Destino ocupado por enemigo (solo extremo) ---
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

            // --- Caso 2: Destino vacío → verificar las dos casillas intermedias ---
            // Casilla intermedia 1: un paso en la dirección de la fila
            let inter1f = fila + Math.sign(df);
            let inter1c = col;
            // Casilla intermedia 2: un paso en la dirección de la columna
            let inter2f = fila;
            let inter2c = col + Math.sign(dc);

            let rutasValidas = [];

            // Ruta pasando por inter1
            if (inter1f >= 0 && inter1f < FILAS && inter1c >= 0 && inter1c < COLUMNAS) {
                let p1 = board[inter1f][inter1c];
                let enemigo1 = p1 && p1.jugador !== jugador && capturaPermitida(this.tipo, p1);
                if (p1 && p1.jugador !== jugador && !capturaPermitida(this.tipo, p1)) {
                    // enemigo no capturable, esta ruta no vale
                } else {
                    let pasos = [];
                    if (enemigo1) pasos.push({ tipo: 'removePiece', over: [inter1f, inter1c] });
                    pasos.push({ tipo: 'move', to: [nf, nc] });
                    rutasValidas.push({
                        inter: [inter1f, inter1c],
                        pasos,
                        tieneEnemigo: !!enemigo1
                    });
                }
            }

            // Ruta pasando por inter2
            if (inter2f >= 0 && inter2f < FILAS && inter2c >= 0 && inter2c < COLUMNAS) {
                let p2 = board[inter2f][inter2c];
                let enemigo2 = p2 && p2.jugador !== jugador && capturaPermitida(this.tipo, p2);
                if (p2 && p2.jugador !== jugador && !capturaPermitida(this.tipo, p2)) {
                    // inválida
                } else {
                    let pasos = [];
                    if (enemigo2) pasos.push({ tipo: 'removePiece', over: [inter2f, inter2c] });
                    pasos.push({ tipo: 'move', to: [nf, nc] });
                    if (!rutasValidas.some(r => r.inter[0] === inter2f && r.inter[1] === inter2c)) {
                        rutasValidas.push({
                            inter: [inter2f, inter2c],
                            pasos,
                            tieneEnemigo: !!enemigo2
                        });
                    }
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
