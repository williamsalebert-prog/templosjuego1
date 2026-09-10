console.log("✅ f2.js cargado");

class F2 extends Pieza {
    constructor(jugador) { super('F2', jugador); }

    puedeAtacarRey(fila, col, reyF, reyC, board) {
        // El caballo de Templos no amenaza simplemente por geometría en L:
        // importa cuál de sus dos rutas puede recorrer y qué captura en ella.
        // Usamos sus caminos reales para no bloquear casillas del rey que en
        // realidad no están atacadas.
        const res = this.obtenerMovimientos(fila, col, board);
        for (const clave in res.caminos) {
            const info = res.caminos[clave];
            const rutas = (Array.isArray(info) && info.length > 0 && info[0] &&
                Object.prototype.hasOwnProperty.call(info[0], 'pasos')) ? info.map(r => r.pasos) : [info];
            for (const pasos of rutas) {
                if (!Array.isArray(pasos)) continue;
                for (const paso of pasos) {
                    if (Array.isArray(paso.over) &&
                        (paso.tipo === 'removePiece' || paso.tipo === 'captureDirect' || paso.tipo === 'jump') &&
                        paso.over[0] === reyF && paso.over[1] === reyC) return true;
                }
            }
        }
        return false;
    }

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

            // Caso 1: destino ocupado por enemigo (solo extremo)
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

            // Caso 2: destino vacío → dos rutas, cada una captura todos los enemigos que pisa
            let rutaA = [];
            let rutaB = [];

            if (Math.abs(df) === 2) {
                rutaA.push([fila + Math.sign(df), col]);
                rutaA.push([fila + 2*Math.sign(df), col]);
                rutaB.push([fila, col + Math.sign(dc)]);
                rutaB.push([fila + Math.sign(df), col + Math.sign(dc)]);
            } else {
                rutaA.push([fila, col + Math.sign(dc)]);
                rutaA.push([fila, col + 2*Math.sign(dc)]);
                rutaB.push([fila + Math.sign(df), col]);
                rutaB.push([fila + Math.sign(df), col + Math.sign(dc)]);
            }

            let rutasValidas = [];

            for (let ruta of [rutaA, rutaB]) {
                let [c1, c2] = ruta;
                if (c1[0] < 0 || c1[0] >= FILAS || c1[1] < 0 || c1[1] >= COLUMNAS) continue;
                if (c2[0] < 0 || c2[0] >= FILAS || c2[1] < 0 || c2[1] >= COLUMNAS) continue;

                let p1 = board[c1[0]][c1[1]];
                let p2 = board[c2[0]][c2[1]];
                let pasos = [];
                let invalida = false;

                if (p1) {
                    if (p1.jugador !== jugador) {
                        if (capturaPermitida(this.tipo, p1)) {
                            pasos.push({ tipo: 'removePiece', over: [c1[0], c1[1]] });
                        } else {
                            invalida = true;
                        }
                    }
                }
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
                        inter: c1,
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
