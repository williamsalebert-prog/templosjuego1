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

            // --- Caso 2: Destino vacío → dos rutas, cada una captura todos los enemigos que pisa ---
            let rutaA = []; // casillas intermedias de la trayectoria A
            let rutaB = []; // casillas intermedias de la trayectoria B

            if (Math.abs(df) === 2) {
                // Trayectoria A: largo, luego corto
                rutaA.push([fila + Math.sign(df), col]);
                rutaA.push([fila + 2*Math.sign(df), col]);
                // Trayectoria B: corto, luego largo
                rutaB.push([fila, col + Math.sign(dc)]);
                rutaB.push([fila + Math.sign(df), col + Math.sign(dc)]);
            } else { // |dc| == 2
                rutaA.push([fila, col + Math.sign(dc)]);
                rutaA.push([fila, col + 2*Math.sign(dc)]);
                rutaB.push([fila + Math.sign(df), col]);
                rutaB.push([fila + Math.sign(df), col + Math.sign(dc)]);
            }

            let rutasValidas = [];

            for (let ruta of [rutaA, rutaB]) {
                let [c1, c2] = ruta;
                // Verificar que ambas casillas están en el tablero
                if (c1[0] < 0 || c1[0] >= FILAS || c1[1] < 0 || c1[1] >= COLUMNAS) continue;
                if (c2[0] < 0 || c2[0] >= FILAS || c2[1] < 0 || c2[1] >= COLUMNAS) continue;

                let p1 = board[c1[0]][c1[1]];
                let p2 = board[c2[0]][c2[1]];
                let pasos = [];
                let invalida = false;

                // Revisar primera casilla
                if (p1) {
                    if (p1.jugador !== jugador) {
                        if (capturaPermitida(this.tipo, p1)) {
                            pasos.push({ tipo: 'removePiece', over: [c1[0], c1[1]] });
                        } else {
                            invalida = true;
                        }
                    }
                }
                // Revisar segunda casilla
                if (p2 && !invalida) {
                    if (p2.jugador !== jugador) {
                        if (capturaPermitida(this.tipo, p2)) {
                            pasos.push({ tipo: 'removePiece', over: [c2[0], c2[1]] });
                        } else {
                            invalida = true;
                        }
                    }
                }

                if (!invalida) {
                    pasos.push({ tipo: 'move', to: [nf, nc] });
                    rutasValidas.push({
                        inter: c1,   // primera casilla de la ruta para colorear
                        pasos,
                        tieneEnemigo: pasos.some(p => p.tipo === 'removePiece')
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
