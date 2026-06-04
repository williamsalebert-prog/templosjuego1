class Carcela {
    constructor() {
        this.capturadas = [];
    }
    agregar(pieza) {
        this.capturadas.push(pieza);
    }
    obtenerTodas() {
        return this.capturadas;
    }
    limpiar() {
        this.capturadas = [];
    }
}
const carcela = new Carcela();
