class Pieza {
    constructor(tipo, jugador) {
        this.tipo = tipo;
        this.jugador = jugador; // 0 o 1
    }
    obtenerMovimientos(fila, col, board) {
        throw new Error("Método obtenerMovimientos no implementado");
    }
}
