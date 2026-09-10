// ============================================================================
// WEB WORKER DE LA IA
// ============================================================================
// Corre en un hilo separado para que "pensar" una jugada fuerte (varios
// segundos en dificultad alta) NO congele la interfaz: el tablero, las
// animaciones, los relojes y el resto de la página siguen funcionando con
// normalidad mientras la IA calcula en segundo plano.
//
// Reutiliza el MISMO código de reglas que el resto del juego (zonas.js,
// pieza.js, f0..f6.js, jaque.js, jaquemate.js, ahogado.js) vía importScripts,
// para que la IA evalúe exactamente las mismas reglas que ve el jugador y
// nunca proponga ni evalúe mal un movimiento "ilegal" o un caso especial
// (saltos encadenados, capturas del Trampero F4, enroque, etc.).
// ============================================================================

importScripts(
    'zonas.js',
    'pieza.js',
    'f0.js', 'f1.js', 'f2.js', 'f3.js', 'f4.js', 'f5.js', 'f6.js',
    'jaque.js',
    'enroque.js',
    'jaquemate.js',
    'ahogado.js'
);

// --- Variables globales que las reglas importadas esperan encontrar ---
let board = null;
let turno = 0;
let enroqueRealizado = [false, false];

// --- Valores de material (puntos por pieza) ---
const VALOR_PIEZA = {
    F0: 5,   // Torre
    F1: 1,   // Peón
    F2: 4,   // Caballo
    F3: 9,   // Reina
    F4: 3,   // Trampero (solo lo captura F3/F6: vale más de lo que parece)
    F5: 3.2, // Alfil
    F6: 0    // Rey (su seguridad se evalúa aparte, no como material)
};

// Bonus por avanzar hacia el templo enemigo (incentiva progresar peones e
// invadir el templo rival, que es como se gana la partida).
function avanceBonus(tipo, fila, col, jugador) {
    if (tipo !== 'F1') return 0;
    // Progreso normalizado desde la base del templo propio (3/11) hasta la
    // entrada del templo rival (11/3). Crece de forma no lineal: un peón que
    // está a una o dos jugadas de coronar debe importar mucho más que uno que
    // apenas salió.
    const bruto = jugador === 0 ? (col - 3) / 8 : (11 - col) / 8;
    const progreso = Math.max(0, Math.min(1, bruto));
    return 0.10 * progreso + 0.70 * progreso * progreso;
}

function bonusPosicional(tipo, fila, col, jugador) {
    if (tipo === 'F1') return avanceBonus(tipo, fila, col, jugador);

    let bonus = 0;
    const zona = getZona(fila, col);
    const progresoCols = jugador === 0 ? col - 3 : 11 - col;

    // Sacar piezas al jardín suele aumentar opciones de salto y control. Es un
    // incentivo pequeño: nunca debe superar una ventaja material real.
    if (zona === 'jardin' && tipo !== 'F6') bonus += 0.06;
    bonus += Math.max(-2, Math.min(8, progresoCols)) * 0.012;

    // El Trampero gana valor práctico cuando participa en la zona central,
    // donde puede bloquear rutas sin ser capturable por la mayoría de piezas.
    if (tipo === 'F4' && zona === 'jardin') bonus += 0.08;

    // Infiltrarse en el templo enemigo con una pieza mayor suele restringir
    // muchísimo al rival. Bonus moderado para no forzar aventuras suicidas.
    const temploEnemigo = jugador === 0 ? 'templo2' : 'templo1';
    if (zona === temploEnemigo && tipo !== 'F6') bonus += 0.10;
    return bonus;
}
// Potencial inmediato de salto de un peón. En Templos una pieza propia
// también puede ser una plataforma, así que dos posiciones con el mismo
// material no son equivalentes: una red de apoyos puede abrir cadenas hacia
// el templo rival. El bonus es pequeño para no sustituir cálculo táctico real.
function bonusRedSaltosPeon(tablero, fila, col, pieza) {
    if (!pieza || pieza.tipo !== 'F1') return 0;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    let bonus = 0;
    for (const [df, dc] of dirs) {
        const af = fila + df, ac = col + dc;
        const lf = fila + 2 * df, lc = col + 2 * dc;
        if (af < 0 || af >= FILAS || ac < 0 || ac >= COLUMNAS ||
            lf < 0 || lf >= FILAS || lc < 0 || lc >= COLUMNAS || !esJugable(lf, lc)) continue;
        const apoyo = tablero[af][ac];
        if (!apoyo || tablero[lf][lc] !== null) continue;
        if (apoyo.jugador !== pieza.jugador && !capturaPermitida(pieza.tipo, apoyo)) continue;
        const avanza = pieza.jugador === 0 ? lc > col : lc < col;
        if (!avanza) continue;
        bonus += apoyo.jugador === pieza.jugador ? 0.025 : 0.06;
        const zonaDestino = getZona(lf, lc);
        const temploEnemigo = pieza.jugador === 0 ? 'templo2' : 'templo1';
        if (zonaDestino === temploEnemigo) bonus += 0.06;
    }
    return Math.min(0.18, bonus);
}

function clonarTableroIA(tablero) {
    // Copia estructural barata: el árbol de búsqueda no muta piezas que no se
    // mueven. La pieza móvil se clona justo antes de cambiar haMovido. Evita
    // crear decenas de objetos por candidato y reduce mucho la presión del GC.
    return tablero.map(fila => fila.slice());
}

// Aplica un movimiento (camino de pasos) sobre un tablero, igual que hace el
// juego real (animacion.js), pero sin sonido ni dibujo: solo el resultado.
function aplicarCaminoEnTablero(tablero, origen, camino, tipoPromocion = 'F3') {
    let [f, c] = origen;
    let piezaOriginal = tablero[f][c];
    if (!piezaOriginal) return tablero;
    // Es la única pieza cuyo estado persistente cambia en un movimiento.
    let pieza = clonarPieza(piezaOriginal);
    tablero[f][c] = null;
    for (const paso of camino) {
        if (paso.tipo === 'move') {
            const [nf, nc] = paso.to;
            tablero[f][c] = null;
            tablero[nf][nc] = pieza;
            f = nf; c = nc;
        } else if (paso.tipo === 'jump') {
            const [of, oc] = paso.over;
            const [nf, nc] = paso.to;
            const objetivo = tablero[of][oc];
            if (objetivo && objetivo.jugador !== pieza.jugador && capturaPermitida(pieza.tipo, objetivo)) {
                tablero[of][oc] = null;
            }
            tablero[f][c] = null;
            tablero[nf][nc] = pieza;
            f = nf; c = nc;
        } else if (paso.tipo === 'captureDirect') {
            const [of, oc] = paso.over;
            const [nf, nc] = paso.to;
            const objetivo = tablero[of][oc];
            if (objetivo && objetivo.jugador !== pieza.jugador && capturaPermitida(pieza.tipo, objetivo)) {
                tablero[of][oc] = null;
            }
            tablero[f][c] = null;
            tablero[nf][nc] = pieza;
            f = nf; c = nc;
        } else if (paso.tipo === 'removePiece') {
            const [of, oc] = paso.over;
            const objetivo = tablero[of][oc];
            if (objetivo && objetivo.jugador !== pieza.jugador) tablero[of][oc] = null;
        }
    }
    if (pieza) pieza.haMovido = true;

    // La búsqueda puede indicar qué promoción probar. El valor por defecto
    // mantiene compatibilidad con llamadas auxiliares antiguas, pero el
    // generador principal crea las cinco variantes legales cuando corresponde.
    if (pieza && pieza.tipo === 'F1' && tipoPromocion) {
        const zona = getZona(f, c);
        if ((pieza.jugador === 0 && zona === 'templo2') || (pieza.jugador === 1 && zona === 'templo1')) {
            const ClasePromocion = piezasRegistradas.get(tipoPromocion) || F3;
            const promovida = new ClasePromocion(pieza.jugador);
            promovida.haMovido = true;
            tablero[f][c] = promovida;
        }
    }
    return tablero;
}

function aplicarEnroqueEnTablero(tablero, reyFila, reyCol, piezaFila, piezaCol, jugador) {
    const reyOriginal = tablero[reyFila][reyCol];
    const rey = reyOriginal ? clonarPieza(reyOriginal) : null;
    tablero[piezaFila][piezaCol] = rey;
    tablero[reyFila][reyCol] = null;
    if (rey) rey.haMovido = true;
}


function valorCapturadoPorCamino(tablero, jugador, tipoAtacante, camino) {
    let valor = 0;
    const contadas = new Set();
    for (const paso of (camino || [])) {
        if (!Array.isArray(paso.over)) continue;
        const clave = `${paso.over[0]},${paso.over[1]}`;
        if (contadas.has(clave)) continue;
        const objetivo = tablero[paso.over[0]]?.[paso.over[1]];
        if (!objetivo || objetivo.jugador === jugador) continue;
        if ((paso.tipo === 'jump' || paso.tipo === 'captureDirect') && !capturaPermitida(tipoAtacante, objetivo)) continue;
        if (paso.tipo === 'jump' || paso.tipo === 'captureDirect' || paso.tipo === 'removePiece') {
            contadas.add(clave);
            valor += VALOR_PIEZA[objetivo.tipo] || 0;
        }
    }
    return valor;
}

function prioridadOrdenJugada(tableroAntes, pieza, camino, tableroDespues, origen, destino, tipoMovimiento) {
    if (tipoMovimiento === 'enroque') return 2;
    let prioridad = valorCapturadoPorCamino(tableroAntes, pieza.jugador, pieza.tipo, camino) * 100;
    if (pieza.tipo === 'F1') {
        const final = tableroDespues[destino[0]]?.[destino[1]];
        if (final && final.tipo !== 'F1') prioridad += 850; // coronación
    }
    // Para las jugadas tranquilas, probar primero las que mejoran realmente
    // la posición de ESA pieza; antes se usaba solo la columna absoluta y el
    // orden podía ser casi arbitrario para piezas del mismo bando.
    const antes = bonusPosicional(pieza.tipo, origen[0], origen[1], pieza.jugador);
    const despues = bonusPosicional(pieza.tipo, destino[0], destino[1], pieza.jugador);
    prioridad += (despues - antes) * 12;
    return prioridad;
}

// Genera todas las jugadas legales de "jugador" en forma de lista plana, cada
// una con su tablero resultante ya calculado (listo para evaluar/recursar).
function generarJugadas(tablero, jugador, enroqueEstado, fechaLimite = null) {
    const turnoPrevio = turno, boardPrevio = board, enroquePrevio = enroqueRealizado;
    board = tablero; turno = jugador; enroqueRealizado = enroqueEstado;

    const jugadas = [];
    const fueraDeTiempo = () => fechaLimite !== null && Date.now() > fechaLimite;
    const cerrar = (agotado = false) => {
        board = boardPrevio; turno = turnoPrevio; enroqueRealizado = enroquePrevio;
        if (agotado) jugadas.agotado = true;
        return jugadas;
    };

    // Antes se construía primero obtenerTodosMovimientosLegales() para TODO el
    // bando y luego se recorría esa estructura una segunda vez para crear los
    // tableros hijos. Aquí hacemos ambas cosas pieza por pieza, ahorrando una
    // capa intermedia y permitiendo respetar el deadline entre piezas/rutas.
    for (let fila = 0; fila < FILAS; fila++) {
        for (let col = 0; col < COLUMNAS; col++) {
            if (fueraDeTiempo()) return cerrar(true);
            const pieza = tablero[fila][col];
            if (!pieza || pieza.jugador !== jugador) continue;

            const res = pieza.obtenerMovimientos(fila, col, tablero);
            const movimientosBase = [...res.destinos];
            if (pieza.tipo === 'F6' && typeof obtenerEnroquesLegales === 'function') {
                movimientosBase.push(...obtenerEnroquesLegales(fila, col, jugador, tablero, enroqueEstado));
            }
            const filtrado = filtrarMovimientosJaque(
                { fila, col }, movimientosBase, res.caminos, tablero, jugador
            );

            for (const mov of filtrado.posiblesMovimientos) {
                if (fueraDeTiempo()) return cerrar(true);
                if (mov.tipoMov === 'enroque') {
                    const nuevoTab = clonarTableroIA(tablero);
                    aplicarEnroqueEnTablero(nuevoTab, fila, col, mov.f, mov.c, jugador);
                    const nuevoEnroque = [...enroqueEstado];
                    nuevoEnroque[jugador] = true;
                    jugadas.push({
                        tipo: 'enroque', origen: [fila, col], destino: [mov.f, mov.c],
                        tablero: nuevoTab, enroqueRealizado: nuevoEnroque, prioridad: 2
                    });
                    continue;
                }

                const fDest = Array.isArray(mov) ? mov[0] : mov.f;
                const cDest = Array.isArray(mov) ? mov[1] : mov.c;
                const info = filtrado.caminosDestino?.[`${fDest},${cDest}`];
                let rutas = [];
                if (Array.isArray(info) && info.length > 0 && info[0] && Object.prototype.hasOwnProperty.call(info[0], 'pasos')) {
                    rutas = info.map(r => r.pasos);
                } else if (Array.isArray(info)) {
                    rutas = [info];
                }

                for (const camino of rutas) {
                    if (fueraDeTiempo()) return cerrar(true);
                    const zonaDestino = getZona(fDest, cDest);
                    const esPromocion = pieza.tipo === 'F1' &&
                        ((jugador === 0 && zonaDestino === 'templo2') || (jugador === 1 && zonaDestino === 'templo1'));
                    const promociones = esPromocion ? ['F0', 'F2', 'F3', 'F4', 'F5'] : [null];

                    for (const promocion of promociones) {
                        if (fueraDeTiempo()) return cerrar(true);
                        const nuevoTab = clonarTableroIA(tablero);
                        if (esPromocion) aplicarCaminoEnTablero(nuevoTab, [fila, col], camino, promocion);
                        else aplicarCaminoEnTablero(nuevoTab, [fila, col], camino, null);
                        let prioridad = prioridadOrdenJugada(tablero, pieza, camino, nuevoTab, [fila, col], [fDest, cDest], 'mover');
                        if (promocion) prioridad += (VALOR_PIEZA[promocion] || 0) * 2;
                        jugadas.push({
                            tipo: 'mover', origen: [fila, col], destino: [fDest, cDest], camino,
                            promocion, tablero: nuevoTab, enroqueRealizado: [...enroqueEstado], prioridad
                        });
                    }
                }
            }
        }
    }
    return cerrar(false);
}

// --- Evaluación de posición (mayor = mejor para el jugador 0 / rojo) ---
// En una posición legal, tras una jugada solo el jugador al que le toca mover
// puede estar en jaque. Recibir ese dato ya calculado evita volver a generar
// TODOS los caminos enemigos dos veces en cada hoja del árbol.
function evaluarPosicion(tablero, enroqueEstado, jugadorAMover = null, enJaqueJugador = false) {
    let total = 0;

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            const pieza = tablero[i][j];
            if (!pieza) continue;
            const signo = pieza.jugador === 0 ? 1 : -1;
            total += signo * VALOR_PIEZA[pieza.tipo];
            total += signo * bonusPosicional(pieza.tipo, i, j, pieza.jugador);
            if (pieza.tipo === 'F1') total += signo * bonusRedSaltosPeon(tablero, i, j, pieza);
        }
    }

    if (enJaqueJugador && jugadorAMover === 0) total -= 1.5;
    else if (enJaqueJugador && jugadorAMover === 1) total += 1.5;
    return total;
}


let tablaTransposicion = new Map();
const TT_MAX = 80000;
const MATE_SCORE = 100000;

// Heurísticas de ordenación que sobreviven entre profundidades de una misma
// pensada. No cambian qué jugadas son legales ni su evaluación: simplemente
// ayudan a alfa-beta a probar antes las jugadas que históricamente provocaron
// cortes, reduciendo muchísimo ramas inútiles.
let killerMoves = [];
let historyMoves = new Map();

// La profundidad ya NO forma parte de la clave. Una misma posición puede
// reutilizar una entrada calculada a mayor profundidad; la entrada conserva
// su profundidad y si el valor es exacto o un límite alfa/beta.
function clavePosicionIA(tablero, enroqueEstado, jugadorAMover) {
    let h1 = 2166136261 >>> 0;
    let h2 = 2246822519 >>> 0;
    const mezclar = (n) => {
        h1 ^= n & 0xff; h1 = Math.imul(h1, 16777619) >>> 0;
        h2 ^= (n + 0x9d) & 0xff; h2 = Math.imul(h2, 3266489917) >>> 0;
    };
    mezclar(jugadorAMover + 11);
    mezclar(enroqueEstado?.[0] ? 1 : 0);
    mezclar(enroqueEstado?.[1] ? 1 : 0);
    for (let f = 0; f < FILAS; f++) {
        for (let c = 0; c < COLUMNAS; c++) {
            const p = tablero[f][c];
            if (!p) { mezclar(0); continue; }
            mezclar((parseInt(p.tipo.slice(1), 10) || 0) + 1);
            mezclar(p.jugador + 1);
            mezclar(p.haMovido ? 1 : 0);
        }
    }
    return `${h1.toString(36)}:${h2.toString(36)}:${jugadorAMover}`;
}

function guardarTT(clave, entrada) {
    if (!clave || !entrada) return;
    // Evitar el viejo "clear()" total: justo cuando la tabla se llenaba se
    // perdía de golpe toda la información útil de la búsqueda. Map conserva
    // orden de inserción, así que retiramos solo una fracción de lo más viejo.
    if (tablaTransposicion.size >= TT_MAX) {
        let quitar = Math.ceil(TT_MAX * 0.15);
        for (const k of tablaTransposicion.keys()) {
            tablaTransposicion.delete(k);
            if (--quitar <= 0) break;
        }
    }
    tablaTransposicion.set(clave, entrada);
}

function firmaJugadaIA(jugada) {
    if (!jugada) return '';
    const o = jugada.origen || [];
    const d = jugada.destino || [];
    let pasos = '';
    if (Array.isArray(jugada.camino)) {
        pasos = jugada.camino.map(p => `${p.tipo}:${(p.over || []).join(',')}>${(p.to || []).join(',')}`).join('|');
    }
    return `${jugada.tipo}:${o.join(',')}:${d.join(',')}:${jugada.promocion || ''}:${pasos}`;
}

function valorMate(jugadorAMover, ply) {
    // Distancia REAL al mate desde la raíz. Con la fórmula antigua basada en
    // "profundidad restante" podían invertirse preferencias: ahora el bando
    // ganador siempre prefiere mate antes y el condenado retrasa el mate.
    return jugadorAMover === 0 ? -MATE_SCORE + ply : MATE_SCORE - ply;
}

function puntuacionOrdenDinamica(jugada, ply, firmaTT) {
    const firma = firmaJugadaIA(jugada);
    let p = jugada.prioridad || 0;
    if (firmaTT && firma === firmaTT) p += 1000000;
    const killers = killerMoves[ply];
    if (killers) {
        if (firma === killers[0]) p += 90;
        else if (firma === killers[1]) p += 70;
    }
    p += Math.min(60, (historyMoves.get(firma) || 0) * 0.02);
    return p;
}

function registrarCorteOrden(jugada, profundidad, ply) {
    if (!jugada) return;
    const firma = firmaJugadaIA(jugada);
    // Capturas/coronaciones ya tienen una prioridad táctica alta. Killer es
    // más útil para recordar movimientos tranquilos que sorprendentemente
    // refutan una rama.
    if ((jugada.prioridad || 0) < 100) {
        if (!killerMoves[ply]) killerMoves[ply] = [null, null];
        if (killerMoves[ply][0] !== firma) {
            killerMoves[ply][1] = killerMoves[ply][0];
            killerMoves[ply][0] = firma;
        }
    }
    historyMoves.set(firma, Math.min(3000, (historyMoves.get(firma) || 0) + profundidad * profundidad));
}

// --- Minimax con poda alfa-beta + límite de tiempo (iterative deepening) ---
function minimax(tablero, enroqueEstado, profundidad, alfa, beta, jugadorAMover, fechaLimite, ply = 0, preferidaRaiz = null) {
    if (Date.now() > fechaLimite) {
        return { valor: evaluarPosicion(tablero, enroqueEstado), agotado: true };
    }

    const alfaEntrada = alfa;
    const betaEntrada = beta;
    const claveTT = ply > 0 ? clavePosicionIA(tablero, enroqueEstado, jugadorAMover) : null;
    let firmaPreferidaTT = null;
    const tt = claveTT ? tablaTransposicion.get(claveTT) : null;
    if (tt) {
        firmaPreferidaTT = tt.mejorFirma || null;
        if (tt.profundidad >= profundidad) {
            if (tt.tipo === 'EXACT') return { valor: tt.valor };
            if (tt.tipo === 'LOWER') alfa = Math.max(alfa, tt.valor);
            else if (tt.tipo === 'UPPER') beta = Math.min(beta, tt.valor);
            if (alfa >= beta) return { valor: tt.valor };
        }
    }

    const turnoPrevio = turno, boardPrevio = board, enroquePrevio = enroqueRealizado;
    board = tablero; turno = jugadorAMover; enroqueRealizado = enroqueEstado;
    const enJaque = esJaque(jugadorAMover, tablero);

    if (profundidad <= 0) {
        const hayMovimientos = tieneMovimientosLegales(jugadorAMover, tablero);
        if (!hayMovimientos) {
            board = boardPrevio; turno = turnoPrevio; enroqueRealizado = enroquePrevio;
            const valor = enJaque ? valorMate(jugadorAMover, ply) : 0;
            guardarTT(claveTT, { profundidad: 0, valor, tipo: 'EXACT', mejorFirma: null });
            return { valor };
        }
        board = boardPrevio; turno = turnoPrevio; enroqueRealizado = enroquePrevio;
        const valor = evaluarPosicion(tablero, enroqueEstado, jugadorAMover, enJaque);
        guardarTT(claveTT, { profundidad: 0, valor, tipo: 'EXACT', mejorFirma: null });
        return { valor };
    }

    const jugadas = generarJugadas(tablero, jugadorAMover, enroqueEstado, fechaLimite);
    board = boardPrevio; turno = turnoPrevio; enroqueRealizado = enroquePrevio;

    if (jugadas.agotado) return { valor: evaluarPosicion(tablero, enroqueEstado, jugadorAMover, enJaque), agotado: true };

    if (jugadas.length === 0) {
        const valor = enJaque ? valorMate(jugadorAMover, ply) : 0;
        guardarTT(claveTT, { profundidad, valor, tipo: 'EXACT', mejorFirma: null });
        return { valor };
    }

    jugadas.sort((a, b) => puntuacionOrdenDinamica(b, ply, firmaPreferidaTT) - puntuacionOrdenDinamica(a, ply, firmaPreferidaTT));

    if (ply === 0 && preferidaRaiz) {
        const idx = jugadas.findIndex(j => firmaJugadaIA(j) === preferidaRaiz);
        if (idx > 0) jugadas.unshift(jugadas.splice(idx, 1)[0]);
    }

    let mejor = null;
    let mejorValor = jugadorAMover === 0 ? -Infinity : Infinity;
    let huboCorte = false;

    if (jugadorAMover === 0) {
        for (const j of jugadas) {
            const resultado = minimax(j.tablero, j.enroqueRealizado, profundidad - 1, alfa, beta, 1, fechaLimite, ply + 1, null);
            if (resultado.agotado) return { valor: mejorValor, jugada: mejor, agotado: true };
            if (resultado.valor > mejorValor) { mejorValor = resultado.valor; mejor = j; }
            alfa = Math.max(alfa, mejorValor);
            if (Date.now() > fechaLimite) return { valor: mejorValor, jugada: mejor, agotado: true };
            if (alfa >= beta) { huboCorte = true; registrarCorteOrden(j, profundidad, ply); break; }
        }
    } else {
        for (const j of jugadas) {
            const resultado = minimax(j.tablero, j.enroqueRealizado, profundidad - 1, alfa, beta, 0, fechaLimite, ply + 1, null);
            if (resultado.agotado) return { valor: mejorValor, jugada: mejor, agotado: true };
            if (resultado.valor < mejorValor) { mejorValor = resultado.valor; mejor = j; }
            beta = Math.min(beta, mejorValor);
            if (Date.now() > fechaLimite) return { valor: mejorValor, jugada: mejor, agotado: true };
            if (alfa >= beta) { huboCorte = true; registrarCorteOrden(j, profundidad, ply); break; }
        }
    }

    let tipoTT = 'EXACT';
    if (mejorValor <= alfaEntrada) tipoTT = 'UPPER';
    else if (mejorValor >= betaEntrada) tipoTT = 'LOWER';
    guardarTT(claveTT, {
        profundidad,
        valor: mejorValor,
        tipo: tipoTT,
        mejorFirma: firmaJugadaIA(mejor)
    });
    return { valor: mejorValor, jugada: mejor };
}

function contarMaterial(tablero) {
    let total = 0;
    for (let i = 0; i < FILAS; i++)
        for (let j = 0; j < COLUMNAS; j++) {
            const p = tablero[i][j];
            if (p) total += VALOR_PIEZA[p.tipo];
        }
    return total;
}

function contarMaterialJugador(tablero, jugador) {
    let total = 0;
    for (let i = 0; i < FILAS; i++)
        for (let j = 0; j < COLUMNAS; j++) {
            const p = tablero[i][j];
            if (p && p.jugador === jugador) total += VALOR_PIEZA[p.tipo];
        }
    return total;
}

function serializarBoardIA(tab) {
    return tab.map(fila => fila.map(c => c ? { tipo: c.tipo, jugador: c.jugador, haMovido: !!c.haMovido } : null));
}
function deserializarBoardIA(data) {
    return data.map(fila => fila.map(c => {
        if (!c) return null;
        const Clase = piezasRegistradas.get(c.tipo);
        if (!Clase) return null;
        const pieza = new Clase(c.jugador);
        pieza.haMovido = !!c.haMovido;
        return pieza;
    }));
}

// Presupuesto de tiempo de pensada por dificultad (ms) y profundidad máxima
// objetivo. La búsqueda usa "iterative deepening": prueba profundidad 1, 2,
// 3... y se queda con el mejor resultado completo antes de que se acabe el
// tiempo, así siempre devuelve una jugada (nunca se queda "pensando" más allá
// del límite) y aprovecha al máximo el tiempo disponible para ser lo más
// fuerte posible en Difícil.
//
// Estos valores son el TECHO deseado por dificultad cuando el ritmo de la
// partida lo permite (clásico/infinito). En partidas rápidas (bala/blitz) se
// recortan más abajo, en calcularPresupuestoReal, para no pensar 7-8s en una
// partida de 1 minuto; y en partidas largas no se acelera de más.
const PRESUPUESTO_MS = { 1: 180, 2: 300, 3: 550, 4: 1000, 5: 2200 };
const PROFUNDIDAD_MAX = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 4 };

// Tiempo mínimo de pensada incluso en el modo más rápido, para que la IA no
// se sienta "instantánea"/robótica ni siquiera en Bala.
const PRESUPUESTO_MIN_MS = 180;

// Calcula cuánto puede pensar la IA esta jugada, combinando:
// - El techo por dificultad (PRESUPUESTO_MS): lo más que querría pensar.
// - El ritmo del modo de tiempo elegido (segundos iniciales + incremento):
//   en modos rápidos, se limita a una fracción prudente del tiempo medio por
//   jugada disponible; en clásico/infinito no hay ese límite (usa el techo
//   de dificultad completo).
// - El tiempo que de verdad le queda en el reloj a la IA en este momento
//   (info.tiempoRestanteIA): si va muy apurada de tiempo, piensa aún menos
//   que lo que el modo permitiría, para no perder por tiempo agotado.
function calcularPresupuestoReal(dificultad, infoTiempo) {
    const techoDificultad = PRESUPUESTO_MS[dificultad] || PRESUPUESTO_MS[1];

    if (!infoTiempo || !infoTiempo.timerActivo || infoTiempo.esInfinito) {
        // Sin reloj real o modo "Infinito": no hay apuro, usa el techo de la
        // dificultad elegida tal cual (puede ser lo más fuerte posible).
        return techoDificultad;
    }

    const segundosIniciales = infoTiempo.segundosIniciales || 300;
    const incremento = infoTiempo.incremento || 0;
    // Jugadas totales que razonablemente puede llegar a hacer la IA en esta
    // partida con este modo de tiempo (estimación simple pero suficiente:
    // partidas de bala duran pocas jugadas "caras", partidas clásicas duran
    // muchas). Esto evita gastar de más en modos rápidos.
    const segundosPorJugadaDisponiblesDeBase = (segundosIniciales / 40) + incremento;

    // Tiempo restante real de la IA ahora mismo: si está apurada, pensar menos.
    const restante = (typeof infoTiempo.tiempoRestanteIA === 'number') ? infoTiempo.tiempoRestanteIA : segundosIniciales;
    // Nunca usar más de ~6% del tiempo que le queda en una sola jugada, para
    // no arriesgarse a perder por tiempo pensando demasiado en una jugada.
    const limitePorTiempoRestante = Math.max(0.3, restante * 0.06);

    const segundosDisponiblesParaEstaJugada = Math.min(segundosPorJugadaDisponiblesDeBase, limitePorTiempoRestante);
    let presupuestoMs = segundosDisponiblesParaEstaJugada * 1000;

    // Acotar siempre por el techo de la dificultad: en bala/blitz no debe
    // pensar 7-8s aunque la dificultad sea Difícil; en cambio si el modo es
    // lento (clásico) y la dificultad es Fácil, tampoco debe alargarse más
    // allá de lo que esa dificultad pide.
    presupuestoMs = Math.min(presupuestoMs, techoDificultad);
    presupuestoMs = Math.max(presupuestoMs, PRESUPUESTO_MIN_MS);
    return Math.round(presupuestoMs);
}

function elegirMejorJugada(boardData, jugador, enroqueEstado, dificultad, infoTiempo) {
    tablaTransposicion.clear();
    const tablero = deserializarBoardIA(boardData);
    const presupuesto = calcularPresupuestoReal(dificultad, infoTiempo);
    const profMax = PROFUNDIDAD_MAX[dificultad] || PROFUNDIDAD_MAX[1];
    const fechaLimite = Date.now() + presupuesto;

    let mejorJugada = null;
    let mejorValor = jugador === 0 ? -Infinity : Infinity;
    let preferidaRaiz = null;

    // En dificultad fácil añadimos algo de azar (no juega el movimiento
    // objetivamente óptimo siempre), para que sea vencible y no se sienta
    // "perfecta" ni "puramente aleatoria": elige entre las mejores opciones
    // razonables, no necesariamente LA mejor.
    const usaAzar = dificultad <= 3;

    let duracionIteracionAnterior = null;
    for (let profundidad = 1; profundidad <= profMax; profundidad++) {
        const ahora = Date.now();
        if (ahora > fechaLimite) break;

        // No iniciar una profundidad que casi seguro no cabrá. Antes Difícil
        // terminaba profundidad 3 y desperdiciaba ~5 s intentando una 4 que no
        // llegaba a completar, por lo que esperaba mucho sin jugar mejor.
        if (mejorJugada && duracionIteracionAnterior !== null && profundidad >= 3) {
            const restante = fechaLimite - ahora;
            const factorEstimado = profundidad >= 4 ? 3.5 : 3.0;
            if (duracionIteracionAnterior * factorEstimado > restante) break;
        }

        const inicioIteracion = Date.now();
        const resultado = minimax(tablero, enroqueEstado, profundidad, -Infinity, Infinity, jugador, fechaLimite, 0, preferidaRaiz);
        duracionIteracionAnterior = Math.max(1, Date.now() - inicioIteracion);
        if (resultado.agotado) break;
        if (resultado.jugada) {
            mejorJugada = resultado.jugada;
            mejorValor = resultado.valor;
            preferidaRaiz = firmaJugadaIA(resultado.jugada);
        }
    }

    if (!mejorJugada) {
        // Respaldo: si por lo que sea no se encontró nada (no debería pasar
        // salvo jaque mate/ahogado ya detectados fuera), no hay jugada.
        return null;
    }

    // No convertir la dificultad baja en ceguera: si minimax encontró una
    // captura grande y evidente (aprox. Torre o superior), no la sustituimos
    // por azar. Los errores de Principiante/Fácil se concentran en decisiones
    // menos obvias, no en regalar una Reina delante de los ojos.
    const hayTacticaObvia = Number(mejorJugada?.prioridad || 0) >= 500;
    if (usaAzar && !hayTacticaObvia) {
        // Los tres niveles inferiores conservan personalidad y errores humanos,
        // pero el azar se restringe a candidatos razonables. Principiante mira
        // un grupo mayor; Fácil uno mediano; Normal apenas varía entre 2-3.
        const jugadasRaiz = generarJugadas(tablero, jugador, enroqueEstado);
        const evaluadas = jugadasRaiz.map(j => ({
            jugada: j,
            valor: evaluarPosicion(j.tablero, j.enroqueRealizado, 1 - jugador, false)
        }));
        evaluadas.sort((a, b) => jugador === 0 ? b.valor - a.valor : a.valor - b.valor);
        const proporcion = dificultad === 1 ? 0.28 : (dificultad === 2 ? 0.16 : 0.08);
        const maximas = dificultad === 1 ? 8 : (dificultad === 2 ? 5 : 3);
        const cantidad = Math.min(maximas, Math.max(1, Math.ceil(evaluadas.length * proporcion)));
        const candidatas = evaluadas.slice(0, cantidad);
        if (candidatas.length > 0) {
            // Sesgo creciente hacia la mejor conforme sube el nivel.
            const exponente = dificultad === 1 ? 1.15 : (dificultad === 2 ? 1.7 : 2.6);
            const r = Math.pow(Math.random(), exponente);
            const idx = Math.min(candidatas.length - 1, Math.floor(r * candidatas.length));
            mejorJugada = candidatas[idx].jugada;
        }
    }

    return {
        tipo: mejorJugada.tipo,
        origen: mejorJugada.origen,
        destino: mejorJugada.destino,
        camino: mejorJugada.camino || null,
        promocion: mejorJugada.promocion || null
    };
}

self.onmessage = function(e) {
    const { boardData, jugador, enroqueRealizado: enroqueEstado, dificultad, peticionId, infoTiempo } = e.data;
    try {
        const resultado = elegirMejorJugada(boardData, jugador, enroqueEstado, dificultad, infoTiempo);
        self.postMessage({ peticionId, resultado });
    } catch (err) {
        self.postMessage({ peticionId, error: String(err && err.message || err) });
    }
};
