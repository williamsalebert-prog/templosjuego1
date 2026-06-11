console.log("✅ f2.js cargado");

class F2 extends Pieza {
    constructor(jugador) { super('F2', jugador); }

    obtenerMovimientos(fila, col, board) {
        const jugador = this.jugador;
        const saltosL = [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]];
        let destinos = new Set();
        let caminos = {};

        for (let [df, dc] of saltosL) {
            let nf = fila + df, nc = col + dc;
            if (nf < 0 || nf >= FILAS || nc < 0 || nc >= COLUMNAS) continue;
            if (!esJugable(nf, nc)) continue;

            let contenido = board[nf][nc];
            // Caso 1: destino vacío -> calcular rutas de salto
            if (contenido === null) {
                let inter1f, inter1c, inter2f, inter2c;
                if (Math.abs(df) === 2) {
                    inter1f = fila + Math.sign(df);
                    inter1c = col;
                    inter2f = fila;
                    inter2c = col + Math.sign(dc);
                } else {
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
                    if (pieza1 && pieza1.jugador !== jugador && !capturaPermitida(this.tipo, pieza1)) {
                        // enemiga no capturable -> ruta inválida
                    } else {
                        let pasos = [];
                        if (enemigo1) pasos.push({ tipo: 'removePiece', over: [inter1f, inter1c] });
                        pasos.push({ tipo: 'move', to: [nf, nc] });
                        rutasValidas.push({ inter: [inter1f, inter1c], pasos, tieneEnemigo: !!enemigo1 });
                    }
                }

                // Ruta 2 (pasa por inter2)
                if (inter2f >= 0 && inter2f < FILAS && inter2c >= 0 && inter2c < COLUMNAS) {
                    let pieza2 = board[inter2f][inter2c];
                    let enemigo2 = pieza2 && pieza2.jugador !== jugador && capturaPermitida(this.tipo, pieza2);
                    if (pieza2 && pieza2.jugador !== jugador && !capturaPermitida(this.tipo, pieza2)) {
                        // inválida
                    } else {
                        let pasos = [];
                        if (enemigo2) pasos.push({ tipo: 'removePiece', over: [inter2f, inter2c] });
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
            // Caso 2: destino ocupado por enemigo -> solo se permite si es un extremo
            else if (contenido.jugador !== jugador && capturaPermitida(this.tipo, contenido)) {
                // Verificar si la casilla detrás (en la dirección del salto) es no jugable o no existe
                let detrasF = nf + Math.sign(df);
                let detrasC = nc + Math.sign(dc);
                // Si la casilla detrás NO es jugable o está fuera del tablero, es un extremo -> captura directa
                if (!(detrasF >= 0 && detrasF < FILAS && detrasC >= 0 && detrasC < COLUMNAS && esJugable(detrasF, detrasC))) {
                    let clave = `${nf},${nc}`;
                    destinos.add(clave);
                    if (!caminos[clave]) caminos[clave] = [{
                        tipo: 'captureDirect',
                        over: [nf, nc],
                        to: [nf, nc]
                    }];
                }
                // Si no es extremo, el caballo no puede moverse a esa casilla (no puede saltar porque el destino no está vacío)
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
