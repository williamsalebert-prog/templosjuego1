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
        let caminos = {};

        for (let [df, dc] of saltosL) {
            let nf = fila + df, nc = col + dc;
            if (nf < 0 || nf >= FILAS || nc < 0 || nc >= COLUMNAS) continue;
            if (!esJugable(nf, nc)) continue;
            if (board[nf][nc] !== null) continue; // destino debe estar vacío

            // Calcular las dos casillas intermedias (x)
            let inter1f, inter1c, inter2f, inter2c;
            if (Math.abs(df) === 2) {
                // Movimiento principal de 2 en fila, 1 en columna
                inter1f = fila + Math.sign(df);   // un paso en la dirección larga
                inter1c = col;
                inter2f = fila + df - Math.sign(df); // el paso restante
                inter2c = nc;
            } else {
                // df = ±1, dc = ±2
                inter1f = fila;
                inter1c = col + Math.sign(dc);
                inter2f = nf;
                inter2c = col + dc - Math.sign(dc);
            }

            let pieza1 = board[inter1f]?.[inter1c];
            let pieza2 = board[inter2f]?.[inter2c];

            // Construir lista de piezas enemigas a capturar
            let capturas = [];
            if (pieza1 && pieza1.jugador !== jugador && capturaPermitida(this.tipo, pieza1)) {
                capturas.push({ f: inter1f, c: inter1c });
            } else if (pieza1 && pieza1.jugador === jugador) {
                // pieza amiga: se puede saltar, no se captura
            } else if (pieza1 && pieza1.jugador !== jugador && !capturaPermitida(this.tipo, pieza1)) {
                continue; // enemiga no capturable (ej: Trampero por no Rey/Reina)
            }

            if (pieza2 && pieza2.jugador !== jugador && capturaPermitida(this.tipo, pieza2)) {
                capturas.push({ f: inter2f, c: inter2c });
            } else if (pieza2 && pieza2.jugador === jugador) {
                // pieza amiga: se puede saltar
            } else if (pieza2 && pieza2.jugador !== jugador && !capturaPermitida(this.tipo, pieza2)) {
                continue;
            }

            let clave = `${nf},${nc}`;
            destinos.add(clave);
            if (!caminos[clave]) {
                if (capturas.length > 0) {
                    // Hay al menos una captura; construimos un camino con varios saltos
                    let pasos = [];
                    for (let cap of capturas) {
                        pasos.push({
                            tipo: 'jump',
                            over: [cap.f, cap.c],
                            to: [nf, nc]
                        });
                    }
                    caminos[clave] = pasos;
                } else {
                    // Movimiento simple
                    caminos[clave] = [{ tipo: 'move', to: [nf, nc] }];
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
