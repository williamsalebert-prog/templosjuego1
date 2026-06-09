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
            if (board[nf][nc] !== null) continue; // destino vacío obligatorio

            // Determinar las CUATRO casillas intermedias posibles
            let intermedias = [];
            if (Math.abs(df) === 2) {
                // Trayectoria priorizando fila: (f+sign(df), c) y (f+2*sign(df), c) 
                // Pero la segunda es (f+df, c) que puede ser una esquina
                intermedias.push([fila + Math.sign(df), col]);
                intermedias.push([fila + df, col]); // esta puede ser (f+2*sign(df),c) o (f-2*sign(df),c)
                // Trayectoria priorizando columna: (fila, c+sign(dc)) y (fila+sign(df), c+dc) 
                intermedias.push([fila, col + Math.sign(dc)]);
                intermedias.push([fila + Math.sign(df), col + dc]);
            } else { // df = ±1, dc = ±2
                intermedias.push([fila, col + Math.sign(dc)]);
                intermedias.push([fila, col + dc]); // (f, c+2*sign(dc))
                intermedias.push([fila + Math.sign(df), col]);
                intermedias.push([fila + df, col + Math.sign(dc)]);
            }

            // Filtrar casillas repetidas y fuera del tablero
            let unicas = [];
            let seen = new Set();
            for (let [f, c] of intermedias) {
                if (f < 0 || f >= FILAS || c < 0 || c >= COLUMNAS) continue;
                let key = `${f},${c}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    unicas.push([f, c]);
                }
            }

            let pasos = [];
            let movimientoValido = true;

            for (let [fInt, cInt] of unicas) {
                let pieza = board[fInt]?.[cInt];
                if (!pieza) continue; // vacía, sin problema
                if (pieza.jugador === jugador) continue; // amiga, se puede saltar
                // Enemigo
                if (capturaPermitida(this.tipo, pieza)) {
                    pasos.push({ tipo: 'removePiece', over: [fInt, cInt] });
                } else {
                    // Enemigo no capturable (ej. Trampero para no Reina/Rey)
                    movimientoValido = false;
                    break;
                }
            }

            if (!movimientoValido) continue;

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
