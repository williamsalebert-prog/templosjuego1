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

            // Determinar las dos trayectorias completas (cada una con dos casillas intermedias)
            let rutas = []; // cada ruta será un array de [f, c] para los intermedios

            if (Math.abs(df) === 2) {
                // |df|=2, |dc|=1
                // Ruta A (primero largo, luego corto)
                let rutaA = [];
                rutaA.push([fila + Math.sign(df), col]);               // paso 1 en largo
                rutaA.push([fila + df, col]);                          // paso 2 en largo
                // Ruta B (primero corto, luego largo)
                let rutaB = [];
                rutaB.push([fila, col + Math.sign(dc)]);               // paso 1 en corto
                rutaB.push([fila + Math.sign(df), col + Math.sign(dc)]); // paso 2 en corto + 1 en largo
                rutas = [rutaA, rutaB];
            } else {
                // |dc|=2, |df|=1
                // Ruta A (primero largo, luego corto)
                let rutaA = [];
                rutaA.push([fila, col + Math.sign(dc)]);
                rutaA.push([fila, col + dc]);
                // Ruta B (primero corto, luego largo)
                let rutaB = [];
                rutaB.push([fila + Math.sign(df), col]);
                rutaB.push([fila + Math.sign(df), col + Math.sign(dc)]);
                rutas = [rutaA, rutaB];
            }

            let rutasValidas = [];

            for (let ruta of rutas) {
                let pasos = [];
                let enemigosEnRuta = false;
                let rutaValida = true;

                for (let [fInt, cInt] of ruta) {
                    // Verificar que la casilla intermedia está dentro del tablero y es jugable
                    if (fInt < 0 || fInt >= FILAS || cInt < 0 || cInt >= COLUMNAS || !esJugable(fInt, cInt)) {
                        // Si una casilla intermedia está fuera del tablero o no es jugable, la ruta es inválida
                        rutaValida = false;
                        break;
                    }
                    let pieza = board[fInt][cInt];
                    if (pieza) {
                        if (pieza.jugador !== jugador) {
                            // Pieza enemiga
                            if (capturaPermitida(this.tipo, pieza)) {
                                pasos.push({ tipo: 'removePiece', over: [fInt, cInt] });
                                enemigosEnRuta = true;
                            } else {
                                // Enemigo no capturable → ruta inválida
                                rutaValida = false;
                                break;
                            }
                        }
                        // Si es amiga, se ignora (se puede saltar)
                    }
                }

                if (rutaValida) {
                    // Agregar el movimiento final
                    pasos.push({ tipo: 'move', to: [nf, nc] });
                    // Guardar la primera casilla intermedia como referencia visual (para colorear)
                    rutasValidas.push({
                        inter: ruta[0],        // solo el primer intermedio se usa para pintar
                        pasos,
                        tieneEnemigo: enemigosEnRuta
                    });
                }
            }

            // Si hay al menos una ruta válida, añadir el destino
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
