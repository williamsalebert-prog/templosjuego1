console.log("✅ pieza.js cargado");

// Registro global de todas las piezas (tipo -> clase)
const piezasRegistradas = new Map();

class Pieza {
    constructor(tipo, jugador) {
        this.tipo = tipo;
        this.jugador = jugador; // 0 = rojo, 1 = azul
    }
    obtenerMovimientos(fila, col, board) {
        throw new Error("Método obtenerMovimientos no implementado");
    }
}
