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
        let caminos = {};   // clave -> array de rutas {inter, pasos, tieneEnemigo}

        for (let [df, dc] of saltosL) {
            let nf = fila + df, nc = col + dc;
            if (nf < 0 || nf >= FILAS || nc < 0 || nc >= COLUMNAS) continue;
            if (!esJugable(nf, nc)) continue;
            if (board[nf][nc] !== null) continue;   // destino vacío

            // Las dos casillas intermedias (cada una representa una trayectoria distinta)
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

            // Ruta 1 (pasa por inter1)
            if (inter1f >= 0 && inter1f < FILAS && inter1c >= 0 && inter1c < COLUMNAS) {
                let pieza1 = board[inter1f][inter1c];
                let enemigo1 = pieza1 && pieza1.jugador !== jugador && capturaPermitida(this.tipo, pieza1);
                // Si hay pieza enemiga no capturable (ej. Trampero), la ruta es inválida
                if (pieza1 && pieza1.jugador !== jugador && !capturaPermitida(this.tipo, pieza1)) {
                    // No añadir esta ruta
                } else {
                    let pasos = [];
                    if (enemigo1) {
                        pasos.push({ tipo: 'removePiece', over: [inter1f, inter1c] });
                    }
                    pasos.push({ tipo: 'move', to: [nf, nc] });
                    rutasValidas.push({ inter: [inter1f, inter1c], pasos, tieneEnemigo: !!enemigo1 });
                }
            }

            // Ruta 2 (pasa por inter2)
            if (inter2f >= 0 && inter2f < FILAS && inter2c >= 0 && inter2c < COLUMNAS) {
                let pieza2 = board[inter2f][inter2c];
                let enemigo2 = pieza2 && pieza2.jugador !== jugador && capturaPermitida(this.tipo, pieza2);
                if (pieza2 && pieza2.jugador !== jugador && !capturaPermitida(this.tipo, pieza2)) {
                    // No añadir
                } else {
                    let pasos = [];
                    if (enemigo2) {
                        pasos.push({ tipo: 'removePiece', over: [inter2f, inter2c] });
                    }
                    pasos.push({ tipo: 'move', to: [nf, nc] });
                    if (!rutasValidas.some(r => r.inter[0] === inter2f && r.inter[1] === inter2c)) {
                        rutasValidas.push({ inter: [inter2f, inter2c], pasos, tieneEnemigo: !!enemigo2 });
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
            let [f, c] = clave.split(',').map(Number);
            arr.push([f, c]);
        }
        return { destinos: arr, caminos };
    }
}

piezasRegistradas.set('F2', F2);
