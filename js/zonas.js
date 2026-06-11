console.log("✅ zonas.js cargado");

const FILAS = 10;
const COLUMNAS = 15;             // 0 y 14 negras, 1‑3 templo izq, 4‑10 jardín, 11‑13 templo der
const CELL_SIZE = 60;            // 15*60 = 900 px ancho, 10*60 = 600 px alto

// Columnas completas no jugables
function esNoJugable(f, c) {
    return c === 0 || c === 14;
}

// Templo izquierdo (columnas 1‑3)
function esTemploIzquierdo(f, c) {
    if (esNoJugable(f, c)) return false;
    if (c === 3 && f >= 1 && f <= 8) return true;   // base 8
    if (c === 2 && f >= 2 && f <= 7) return true;   // 6
    if (c === 1 && f >= 3 && f <= 6) return true;   // 4
    return false;
}

// Templo derecho (columnas 11‑13)
function esTemploDerecho(f, c) {
    if (esNoJugable(f, c)) return false;
    if (c === 11 && f >= 1 && f <= 8) return true;
    if (c === 12 && f >= 2 && f <= 7) return true;
    if (c === 13 && f >= 3 && f <= 6) return true;
    return false;
}

// Jardín (columnas 4‑10)
function esJardin(f, c) {
    if (esNoJugable(f, c)) return false;
    return c >= 4 && c <= 10 && f >= 1 && f <= 8;
}

function getZona(f, c) {
    if (esTemploIzquierdo(f, c)) return 'templo1';
    if (esTemploDerecho(f, c)) return 'templo2';
    if (esJardin(f, c)) return 'jardin';
    return 'vacio';
}

function esJugable(f, c) {
    return getZona(f, c) !== 'vacio' && !esNoJugable(f, c);
}

function capturaPermitida(tipoAtacante, piezaObjetivo) {
    if (piezaObjetivo && piezaObjetivo.tipo === 'F4') {
        return tipoAtacante === 'F3' || tipoAtacante === 'F6';
    }
    return true;
}

// Paleta café (madera)
const colores = {
    templo1: { par: '#D2B48C', impar: '#8B4513' },
    templo2: { par: '#D2B48C', impar: '#8B4513' },
    jardin:  { par: '#F5DEB3', impar: '#A0522D' },
    vacio:   { par: '#000000', impar: '#000000' }
};
