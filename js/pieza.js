console.log("✅ pieza.js cargado");

// Registro global de todas las piezas (tipo -> clase)
const piezasRegistradas = new Map();

class Pieza {
    constructor(tipo, jugador) {
        this.tipo = tipo;
        this.jugador = jugador; // 0 = rojo, 1 = azul
        // Estado persistente de movimiento. Es especialmente importante para
        // el enroque: salir y volver a la casilla original NO recupera el derecho.
        this.haMovido = false;
    }
    obtenerMovimientos(fila, col, board) {
        throw new Error("Método obtenerMovimientos no implementado");
    }
}

// Crea una copia de una pieza conservando su estado persistente. Centralizar
// esto evita que las simulaciones de jaque/IA 'olviden' que una pieza ya se movió.
function clonarPieza(pieza) {
    if (!pieza) return null;
    const ClasePieza = piezasRegistradas.get(pieza.tipo);
    if (!ClasePieza) return null;
    const copia = new ClasePieza(pieza.jugador);
    copia.haMovido = !!pieza.haMovido;
    return copia;
}


// Normaliza un camino como "ruta" para que varias secuencias distintas puedan
// terminar en la misma casilla sin que el motor pierda información. F2 ya
// usaba este formato; F1/F6 lo comparten desde Pulido 03.
function agregarRutaAlternativa(caminos, clave, pasos, tableroReferencia, jugador) {
    if (!Array.isArray(pasos)) return;
    if (!caminos[clave]) caminos[clave] = [];

    const firma = JSON.stringify(pasos);
    if (caminos[clave].some(r => JSON.stringify(r.pasos) === firma)) return;

    let tieneEnemigo = false;
    let inter = null;
    for (const paso of pasos) {
        if (!inter) {
            if (Array.isArray(paso.over)) inter = [...paso.over];
            else if (Array.isArray(paso.to)) inter = [...paso.to];
        }
        if (paso.tipo === 'captureDirect' || paso.tipo === 'removePiece') {
            tieneEnemigo = true;
        } else if (paso.tipo === 'jump' && Array.isArray(paso.over)) {
            const p = tableroReferencia?.[paso.over[0]]?.[paso.over[1]];
            if (p && p.jugador !== jugador) tieneEnemigo = true;
        }
    }

    caminos[clave].push({ inter, pasos, tieneEnemigo });
}
