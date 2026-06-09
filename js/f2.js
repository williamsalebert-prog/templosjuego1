console.log("✅ f2.js cargado");

class F2 extends Pieza {
    constructor(jugador) {
        super('F2', jugador);
    }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const saltosL = [
            [-2, -1], [-2, 1], [2, -1], [2, 1],
            [-1, -2], [-1, 2], [1, -2], [1, 2]
        ];
        let destinos = new Set();
        let caminos = {};   // clave -> array de rutas {inter, pasos}

        for (let [df, dc] of saltosL) {
            let nf = fila + df, nc = col + dc;
            if (nf < 0 || nf >= FILAS || nc < 0 || nc >= COLUMNAS) continue;
            if (!esJugable(nf, nc)) continue;
            if (board[nf][nc] !== null) continue;   // destino vacío

            // Determinar las dos casillas intermedias (una por cada posible trayectoria)
            let inter1f, inter1c, inter2f, inter2c;
            if (Math.abs(df) === 2) {
                inter1f = fila + Math.sign(df);
                inter1c = col;
                inter2f = fila;
                inter2c = col + Math.sign(dc);
            } else { // |dc| == 2
                inter1f = fila + Math.sign(df);
                inter1c = col;
                inter2f = fila;
                inter2c = col + Math.sign(dc);
            }

            let rutasValidas = [];

            // Ruta 1: pasar por inter1
            if (inter1f >= 0 && inter1f < FILAS && inter1c >= 0 && inter1c < COLUMNAS) {
                let pieza1 = board[inter1f][inter1c];
                if (pieza1 && pieza1.jugador !== jugador && !capturaPermitida(this.tipo, pieza1)) {
                    // Enemiga no capturable → ruta inválida
                } else {
                    let pasos = [];
                    if (pieza1 && pieza1.jugador !== jugador) {
                        pasos.push({ tipo: 'removePiece', over: [inter1f, inter1c] });
                    }
                    pasos.push({ tipo: 'move', to: [nf, nc] });
                    rutasValidas.push({ inter: [inter1f, inter1c], pasos });
                }
            }

            // Ruta 2: pasar por inter2
            if (inter2f >= 0 && inter2f < FILAS && inter2c >= 0 && inter2c < COLUMNAS) {
                let pieza2 = board[inter2f][inter2c];
                if (pieza2 && pieza2.jugador !== jugador && !capturaPermitida(this.tipo, pieza2)) {
                    // inválida
                } else {
                    let pasos = [];
                    if (pieza2 && pieza2.jugador !== jugador) {
                        pasos.push({ tipo: 'removePiece', over: [inter2f, inter2c] });
                    }
                    pasos.push({ tipo: 'move', to: [nf, nc] });
                    // Evitar duplicados si las dos rutas son la misma casilla (poco común)
                    if (!rutasValidas.some(r => r.inter[0] === inter2f && r.inter[1] === inter2c)) {
                        rutasValidas.push({ inter: [inter2f, inter2c], pasos });
                    }
                }
            }

            if (rutasValidas.length > 0) {
                let clave = `${nf},${nc}`;
                destinos.add(clave);
                if (!caminos[clave]) caminos[clave] = [];
                for (let r of rutasValidas) {
                    caminos[clave].push({ inter: r.inter, pasos: r.pasos });
                }
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

piezasRegistradas.set('F2', F2);
