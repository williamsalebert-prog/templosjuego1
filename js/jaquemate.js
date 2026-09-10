console.log("✅ jaquemate.js cargado");

// Recorre todas las piezas y devuelve sus movimientos ya filtrados por
// seguridad. También conserva los caminos filtrados para que otros sistemas
// (especialmente la IA) no tengan que generarlos por segunda vez.
function obtenerTodosMovimientosLegales(jugador, tablero = board) {
    const resultado = [];

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            const pieza = tablero[i][j];
            if (!pieza || pieza.jugador !== jugador) continue;

            const res = pieza.obtenerMovimientos(i, j, tablero);
            const movimientosBase = [...res.destinos];
            if (pieza.tipo === 'F6' && typeof obtenerEnroquesLegales === 'function') {
                movimientosBase.push(...obtenerEnroquesLegales(i, j, jugador, tablero, enroqueRealizado));
            }
            const seleccionTemp = { fila: i, col: j };
            const filtrado = filtrarMovimientosJaque(
                seleccionTemp,
                movimientosBase,
                res.caminos,
                tablero,
                jugador
            );

            if (filtrado.posiblesMovimientos.length > 0) {
                resultado.push({
                    fila: i,
                    col: j,
                    movimientos: filtrado.posiblesMovimientos,
                    caminos: filtrado.caminosDestino
                });
            }
        }
    }
    return resultado;
}

// Para mate/ahogado solo necesitamos saber si EXISTE una jugada. Antes se
// construía la lista completa de todas las jugadas para luego preguntar si
// length > 0; ahora se detiene en cuanto encuentra la primera legal.
function tieneMovimientosLegales(jugador, tablero = board) {
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            const pieza = tablero[i][j];
            if (!pieza || pieza.jugador !== jugador) continue;
            const res = pieza.obtenerMovimientos(i, j, tablero);
            const movimientosBase = [...res.destinos];
            if (pieza.tipo === 'F6' && typeof obtenerEnroquesLegales === 'function') {
                movimientosBase.push(...obtenerEnroquesLegales(i, j, jugador, tablero, enroqueRealizado));
            }
            const filtrado = filtrarMovimientosJaque(
                { fila: i, col: j },
                movimientosBase,
                res.caminos,
                tablero,
                jugador
            );
            if (filtrado.posiblesMovimientos.length > 0) return true;
        }
    }
    return false;
}

function esJaqueMate(jugador, tablero = board) {
    return esJaque(jugador, tablero) && !tieneMovimientosLegales(jugador, tablero);
}

// Analiza una sola vez el estado del jugador al que le toca mover. La UI y el
// cierre de partida antes preguntaban por mate, luego ahogado y luego jaque,
// repitiendo varias veces la misma generación de amenazas/movimientos.
function analizarEstadoTurno(jugador, tablero = board) {
    const atacantes = (typeof obtenerPiezasQueDanJaque === 'function')
        ? obtenerPiezasQueDanJaque(jugador, tablero)
        : [];
    const enJaque = atacantes.length > 0;
    const hayMovimientos = tieneMovimientosLegales(jugador, tablero);
    return {
        jugador,
        enJaque,
        atacantes,
        hayMovimientos,
        jaqueMate: enJaque && !hayMovimientos,
        ahogado: !enJaque && !hayMovimientos
    };
}
