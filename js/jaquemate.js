console.log("✅ jaquemate.js cargado");

// Recorre TODAS las piezas de "jugador" y, para cada una, filtra sus movimientos
// con la misma lógica de seguridad que ya usa la interfaz (filtrarMovimientosJaque
// de jaque.js), de forma que un movimiento solo cuenta como "legal" si después de
// hacerlo el propio rey no queda en jaque.
function obtenerTodosMovimientosLegales(jugador, tablero = board) {
    let resultado = [];
    const turnoOriginal = turno;
    turno = jugador; // filtrarMovimientosJaque/simularMovimiento usan la variable global "turno"

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = tablero[i][j];
            if (!pieza || pieza.jugador !== jugador) continue;

            let res = pieza.obtenerMovimientos(i, j, tablero);
            let seleccionTemp = { fila: i, col: j };
            let filtrado = filtrarMovimientosJaque(seleccionTemp, res.destinos, res.caminos);

            if (filtrado.posiblesMovimientos.length > 0) {
                resultado.push({ fila: i, col: j, movimientos: filtrado.posiblesMovimientos });
            }
        }
    }

    turno = turnoOriginal;
    return resultado;
}

function tieneMovimientosLegales(jugador, tablero = board) {
    return obtenerTodosMovimientosLegales(jugador, tablero).length > 0;
}

// Jaque mate: el jugador está en jaque y no tiene ningún movimiento legal que lo libre.
function esJaqueMate(jugador, tablero = board) {
    return esJaque(jugador, tablero) && !tieneMovimientosLegales(jugador, tablero);
}
