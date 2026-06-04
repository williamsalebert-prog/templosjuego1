class Historial {
    constructor() {
        this.pila = [];
    }
    guardar(estado) {
        this.pila.push(estado);
    }
    deshacer() {
        return this.pila.pop();
    }
    puedeDeshacer() {
        return this.pila.length > 0;
    }
    limpiar() {
        this.pila = [];
    }
}
const historial = new Historial();
