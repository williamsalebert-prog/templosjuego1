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

            // --- Caso 2: Destino vacío → calcular las dos rutas ---
            // Para cada salto en L, hay dos trayectorias diferentes.
            // Cada trayectoria tiene dos casillas intermedias (aunque solo una puede contener pieza).
            // Vamos a definirlas explícitamente.
            let rutas = []; // cada ruta será un array de {f, c} de las casillas intermedias

            if (Math.abs(df) === 2 && Math.abs(dc) === 1) {
                // Trayectoria A: avanzar 1 en la dirección larga, luego 1 en la corta, luego 1 en la larga
                rutas.push([ [fila + Math.sign(df), col], [fila + df, col] ]);
                // Trayectoria B: avanzar 1 en la corta, luego 1 en la larga
                rutas.push([ [fila, col + Math.sign(dc)], [fila + Math.sign(df), col + Math.sign(dc)] ]);
            } else { // |df| == 1, |dc| == 2
                // Trayectoria A: avanzar 1 en la larga (dc), luego 1 en la corta (df)
                rutas.push([ [fila, col + Math.sign(dc)], [fila, col + dc] ]);
                // Trayectoria B: avanzar 1 en la corta, luego 1 en la larga
                rutas.push([ [fila + Math.sign(df), col], [fila + Math.sign(df), col + Math.sign(dc)] ]);
            }

            let rutasValidas = [];

            for (let ruta of rutas) {
                let [cas1, cas2] = ruta;
                // Verificar que ambas casillas intermedias están dentro del tablero y son jugables
                if (cas1[0] < 0 || cas1[0] >= FILAS || cas1[1] < 0 || cas1[1] >= COLUMNAS) continue;
                if (cas2[0] < 0 || cas2[0] >= FILAS || cas2[1] < 0 || cas2[1] >= COLUMNAS) continue;
                // Solo nos importa si hay pieza en alguna de las dos casillas intermedias
                // (el caballo salta por encima, así que pueden estar ocupadas)
                let pieza1 = board[cas1[0]][cas1[1]];
                let pieza2 = board[cas2[0]][cas2[1]];
                let enemigo = null;

                if (pieza1 && pieza1.jugador !== jugador && capturaPermitida(this.tipo, pieza1)) {
                    enemigo = cas1;
                } else if (pieza1 && pieza1.jugador !== jugador && !capturaPermitida(this.tipo, pieza1)) {
                    continue; // enemigo no capturable, ruta inválida
                } else if (pieza2 && pieza2.jugador !== jugador && capturaPermitida(this.tipo, pieza2)) {
                    enemigo = cas2;
                } else if (pieza2 && pieza2.jugador !== jugador && !capturaPermitida(this.tipo, pieza2)) {
                    continue;
                }
                // Si hay pieza amiga en alguna casilla, no bloquea (se puede saltar)

                let pasos = [];
                if (enemigo) {
                    pasos.push({ tipo: 'removePiece', over: [enemigo[0], enemigo[1]] });
                }
                pasos.push({ tipo: 'move', to: [nf, nc] });

                rutasValidas.push({
                    inter: ruta[0], // la primera casilla intermedia se usa como referencia visual
                    pasos,
                    tieneEnemigo: !!enemigo
                });
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
