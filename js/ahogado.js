console.log("✅ ahogado.js cargado");

// Ahogado (stalemate): al jugador le toca mover, NO está en jaque,
// pero no tiene ningún movimiento legal disponible -> tablas.
function esAhogado(jugador, tablero = board) {
    return !esJaque(jugador, tablero) && !tieneMovimientosLegales(jugador, tablero);
}
