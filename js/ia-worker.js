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
    // Cuanta más cerca esté de coronar (columna objetivo), más vale.
    const colObjetivoMin = jugador === 0 ? 11 : 3;
    const distancia = jugador === 0 ? Math.max(0, 11 - col) : Math.max(0, col - 3);
    return Math.max(0, (8 - distancia)) * 0.05;
}

function clonarTableroIA(tablero) {
    return tablero.map(fila => fila.map(celda => {
        if (celda === null) return null;
        const Clase = piezasRegistradas.get(celda.tipo);
        return Clase ? new Clase(celda.jugador) : null;
    }));
}

// Aplica un movimiento (camino de pasos) sobre un tablero, igual que hace el
// juego real (animacion.js), pero sin sonido ni dibujo: solo el resultado.
function aplicarCaminoEnTablero(tablero, origen, camino) {
    let [f, c] = origen;
    let pieza = tablero[f][c];
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
    // Coronación automática del peón (la IA siempre corona a Reina: es la
    // pieza más fuerte y simplifica la búsqueda; un jugador humano sí puede
    // elegir otra cosa, pero para la IA esto es lo más fuerte).
    if (pieza && pieza.tipo === 'F1') {
        const zona = getZona(f, c);
        if ((pieza.jugador === 0 && zona === 'templo2') || (pieza.jugador === 1 && zona === 'templo1')) {
            tablero[f][c] = new F3(pieza.jugador);
        }
    }
    return tablero;
}

function aplicarEnroqueEnTablero(tablero, reyFila, reyCol, piezaFila, piezaCol, jugador) {
    tablero[piezaFila][piezaCol] = tablero[reyFila][reyCol];
    tablero[reyFila][reyCol] = null;
}

// Genera todas las jugadas legales de "jugador" en forma de lista plana, cada
// una con su tablero resultante ya calculado (listo para evaluar/recursar).
function generarJugadas(tablero, jugador, enroqueEstado) {
    const turnoPrevio = turno, boardPrevio = board, enroquePrevio = enroqueRealizado;
    board = tablero; turno = jugador; enroqueRealizado = enroqueEstado;

    const jugadas = [];
    const movs = obtenerTodosMovimientosLegales(jugador, tablero);

    for (const entrada of movs) {
        const { fila, col, movimientos } = entrada;
        const pieza = tablero[fila][col];
        for (const mov of movimientos) {
            if (mov.tipoMov === 'enroque') {
                const nuevoTab = clonarTableroIA(tablero);
                aplicarEnroqueEnTablero(nuevoTab, fila, col, mov.f, mov.c, jugador);
                const nuevoEnroque = [...enroqueEstado];
                nuevoEnroque[jugador] = true;
                jugadas.push({ tipo: 'enroque', origen: [fila, col], destino: [mov.f, mov.c], tablero: nuevoTab, enroqueRealizado: nuevoEnroque });
                continue;
            }
            const fDest = Array.isArray(mov) ? mov[0] : mov.f;
            const cDest = Array.isArray(mov) ? mov[1] : mov.c;
            const res = pieza.obtenerMovimientos(fila, col, tablero);
            const info = res.caminos[`${fDest},${cDest}`];
            let rutas = [];
            if (Array.isArray(info) && info.length > 0 && info[0].hasOwnProperty('pasos')) {
                rutas = info.map(r => r.pasos);
            } else if (Array.isArray(info)) {
                rutas = [info];
            }
            for (const camino of rutas) {
                const nuevoTab = clonarTableroIA(tablero);
                aplicarCaminoEnTablero(nuevoTab, [fila, col], camino);
                jugadas.push({ tipo: 'mover', origen: [fila, col], destino: [fDest, cDest], camino, tablero: nuevoTab, enroqueRealizado: [...enroqueEstado] });
            }
        }
    }

    board = boardPrevio; turno = turnoPrevio; enroqueRealizado = enroquePrevio;
    return jugadas;
}

// --- Evaluación de posición (mayor = mejor para el jugador 0 / rojo) ---
function evaluarPosicion(tablero, enroqueEstado) {
    let total = 0;
    const turnoPrevio = turno, boardPrevio = board, enroquePrevio = enroqueRealizado;
    board = tablero; enroqueRealizado = enroqueEstado;

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            const pieza = tablero[i][j];
            if (!pieza) continue;
            const signo = pieza.jugador === 0 ? 1 : -1;
            total += signo * VALOR_PIEZA[pieza.tipo];
            total += signo * avanceBonus(pieza.tipo, i, j, pieza.jugador);
        }
    }

    // Seguridad del rey: estar en jaque es muy malo; tener pocas casillas de
    // huida también penaliza levemente (rey acorralado).
    turno = 0;
    if (esJaque(0, tablero)) total -= 1.5;
    turno = 1;
    if (esJaque(1, tablero)) total += 1.5;

    board = boardPrevio; turno = turnoPrevio; enroqueRealizado = enroquePrevio;
    return total;
}

// --- Minimax con poda alfa-beta + límite de tiempo (iterative deepening) ---
// El jugador 0 maximiza, el jugador 1 minimiza (convención interna fija,
// independiente de a quién le toque jugar en la posición raíz).
function minimax(tablero, enroqueEstado, profundidad, alfa, beta, jugadorAMover, fechaLimite) {
    if (Date.now() > fechaLimite) {
        return { valor: evaluarPosicion(tablero, enroqueEstado), agotado: true };
    }

    const turnoPrevio = turno, boardPrevio = board, enroquePrevio = enroqueRealizado;
    board = tablero; turno = jugadorAMover; enroqueRealizado = enroqueEstado;
    const enJaqueMate = esJaqueMate(jugadorAMover, tablero);
    const enAhogado = !enJaqueMate && esAhogado(jugadorAMover, tablero);
    board = boardPrevio; turno = turnoPrevio; enroqueRealizado = enroquePrevio;

    if (enJaqueMate) {
        // Jaque mate: muy bueno para quien lo dio, muy malo para quien lo recibe.
        const valor = jugadorAMover === 0 ? -1000 + (10 - profundidad) : 1000 - (10 - profundidad);
        return { valor };
    }
    if (enAhogado) return { valor: 0 };
    if (profundidad <= 0) return { valor: evaluarPosicion(tablero, enroqueEstado) };

    const jugadas = generarJugadas(tablero, jugadorAMover, enroqueEstado);
    if (jugadas.length === 0) return { valor: evaluarPosicion(tablero, enroqueEstado) };

    // Orden simple: las jugadas que capturan material se exploran primero
    // (mejora mucho la poda alfa-beta sin necesitar una búsqueda extra).
    jugadas.sort((a, b) => contarMaterial(b.tablero) - contarMaterial(a.tablero));

    let mejor = null;
    if (jugadorAMover === 0) {
        let valorMax = -Infinity;
        for (const j of jugadas) {
            const resultado = minimax(j.tablero, j.enroqueRealizado, profundidad - 1, alfa, beta, 1, fechaLimite);
            if (resultado.valor > valorMax) { valorMax = resultado.valor; mejor = j; }
            alfa = Math.max(alfa, valorMax);
            if (Date.now() > fechaLimite) break;
            if (alfa >= beta) break;
        }
        return { valor: valorMax, jugada: mejor };
    } else {
        let valorMin = Infinity;
        for (const j of jugadas) {
            const resultado = minimax(j.tablero, j.enroqueRealizado, profundidad - 1, alfa, beta, 0, fechaLimite);
            if (resultado.valor < valorMin) { valorMin = resultado.valor; mejor = j; }
            beta = Math.min(beta, valorMin);
            if (Date.now() > fechaLimite) break;
            if (alfa >= beta) break;
        }
        return { valor: valorMin, jugada: mejor };
    }
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

function serializarBoardIA(tab) {
    return tab.map(fila => fila.map(c => c ? { tipo: c.tipo, jugador: c.jugador } : null));
}
function deserializarBoardIA(data) {
    return data.map(fila => fila.map(c => {
        if (!c) return null;
        const Clase = piezasRegistradas.get(c.tipo);
        return Clase ? new Clase(c.jugador) : null;
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
const PRESUPUESTO_MS = { 1: 1200, 2: 3000, 3: 7000 };
const PROFUNDIDAD_MAX = { 1: 2, 2: 3, 3: 5 };

// Tiempo mínimo de pensada incluso en el modo más rápido, para que la IA no
// se sienta "instantánea"/robótica ni siquiera en Bala.
const PRESUPUESTO_MIN_MS = 250;

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
    const tablero = deserializarBoardIA(boardData);
    const presupuesto = calcularPresupuestoReal(dificultad, infoTiempo);
    const profMax = PROFUNDIDAD_MAX[dificultad] || PROFUNDIDAD_MAX[1];
    const fechaLimite = Date.now() + presupuesto;

    let mejorJugada = null;
    let mejorValor = jugador === 0 ? -Infinity : Infinity;

    // En dificultad fácil añadimos algo de azar (no juega el movimiento
    // objetivamente óptimo siempre), para que sea vencible y no se sienta
    // "perfecta" ni "puramente aleatoria": elige entre las mejores opciones
    // razonables, no necesariamente LA mejor.
    const margenAzarFacil = dificultad === 1 ? 1.0 : 0;

    for (let profundidad = 1; profundidad <= profMax; profundidad++) {
        if (Date.now() > fechaLimite) break;
        const resultado = minimax(tablero, enroqueEstado, profundidad, -Infinity, Infinity, jugador, fechaLimite);
        if (resultado.jugada) {
            mejorJugada = resultado.jugada;
            mejorValor = resultado.valor;
        }
        if (resultado.agotado) break;
    }

    if (!mejorJugada) {
        // Respaldo: si por lo que sea no se encontró nada (no debería pasar
        // salvo jaque mate/ahogado ya detectados fuera), no hay jugada.
        return null;
    }

    if (margenAzarFacil > 0) {
        // Recalculamos las jugadas de raíz a profundidad 1 para elegir entre
        // las "suficientemente buenas" en vez de siempre la mejor exacta.
        const jugadasRaiz = generarJugadas(tablero, jugador, enroqueEstado);
        const evaluadas = jugadasRaiz.map(j => ({
            jugada: j,
            valor: evaluarPosicion(j.tablero, j.enroqueRealizado)
        }));
        const buenas = evaluadas.filter(e =>
            jugador === 0 ? e.valor >= mejorValor - margenAzarFacil : e.valor <= mejorValor + margenAzarFacil
        );
        if (buenas.length > 0) {
            mejorJugada = buenas[Math.floor(Math.random() * buenas.length)].jugada;
        }
    }

    return {
        tipo: mejorJugada.tipo,
        origen: mejorJugada.origen,
        destino: mejorJugada.destino,
        camino: mejorJugada.camino || null
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
