console.log("✅ historial.js cargado");

// Historial con pila de deshacer (pila) y pila de rehacer (futuros).
// guardar(): se llama ANTES de aplicar un movimiento nuevo -> limpia "futuros"
// porque al jugar una nueva jugada se pierde la rama que se podía rehacer.
class Historial {
    constructor() {
        this.pila = [];
        this.futuros = [];
    }
    guardar(estado) {
        this.pila.push(estado);
        this.futuros = [];
    }
    // estadoActual: el estado vigente ANTES de deshacer, para poder rehacerlo después
    deshacer(estadoActual) {
        if (this.pila.length === 0) return null;
        if (estadoActual) this.futuros.push(estadoActual);
        return this.pila.pop();
    }
    rehacer(estadoActual) {
        if (this.futuros.length === 0) return null;
        if (estadoActual) this.pila.push(estadoActual);
        return this.futuros.pop();
    }
    puedeDeshacer() {
        return this.pila.length > 0;
    }
    puedeRehacer() {
        return this.futuros.length > 0;
    }
    limpiar() {
        this.pila = [];
        this.futuros = [];
    }
}
const historial = new Historial();
