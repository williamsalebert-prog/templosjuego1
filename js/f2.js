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

            // Calcular las dos casillas intermedias correctamente
            let inter1f, inter1c, inter2f, inter2c;
            if (Math.abs(df) === 2) {
                // Movimiento principal de 2 en fila
                inter1f = fila + Math.sign(df);
                inter1c = col;
                inter2f = fila + df - Math.sign(df);
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
            let pasos = [];

            // Revisar primera casilla intermedia
            if (pieza1) {
                if (pieza1.jugador !== jugador && capturaPermitida(this.tipo, pieza1)) {
                    // Enemigo capturable → añadir eliminación
                    pasos.push({ tipo: 'removePiece', over: [inter1f, inter1c] });
                } else if (pieza1.jugador !== jugador && !capturaPermitida(this.tipo, pieza1)) {
                    continue; // Enemigo no capturable (ej: Trampero para no Rey/Reina)
                }
                // Si es amiga, no se hace nada (se permite saltar)
            }

            // Revisar segunda casilla intermedia
            if (pieza2) {
                if (pieza2.jugador !== jugador && capturaPermitida(this.tipo, pieza2)) {
                    pasos.push({ tipo: 'removePiece', over: [inter2f, inter2c] });
                } else if (pieza2.jugador !== jugador && !capturaPermitida(this.tipo, pieza2)) {
                    continue;
                }
            }

            // Paso final: mover el caballo a la casilla vacía
            pasos.push({ tipo: 'move', to: [nf, nc] });

            let clave = `${nf},${nc}`;
            destinos.add(clave);
            if (!caminos[clave]) caminos[clave] = pasos;
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
