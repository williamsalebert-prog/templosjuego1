console.log("✅ zonas.js cargado");

const FILAS = 10;
const COLUMNAS = 13;
const CELL_SIZE = 50;

function esNoJugable(f, c) {
    return (f === 0 && c === 0) ||
           (f === 0 && c === 12) ||
           (f === 9 && c === 0) ||
           (f === 9 && c === 12);
}

function esTemploIzquierdo(f, c) {
    if (esNoJugable(f, c)) return false;
    if (c === 2 && f >= 1 && f <= 8) return true;
    if (c === 1 && f >= 2 && f <= 7) return true;
    if (c === 0 && f >= 3 && f <= 6) return true;
    return false;
}

function esTemploDerecho(f, c) {
    if (esNoJugable(f, c)) return false;
    if (c === 10 && f >= 1 && f <= 8) return true;
    if (c === 11 && f >= 2 && f <= 7) return true;
    if (c === 12 && f >= 3 && f <= 6) return true;
    return false;
}

function esJardin(f, c) {
    if (esNoJugable(f, c)) return false;
    return c >= 3 && c <= 9 && f >= 1 && f <= 8;
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

// 🎨 Paleta café (madera)
const colores = {
    templo1: { par: '#D2B48C', impar: '#8B4513' },   // tan / saddle brown
    templo2: { par: '#D2B48C', impar: '#8B4513' },
    jardin:  { par: '#F5DEB3', impar: '#A0522D' },   // wheat / sienna
    vacio:   { par: '#000000', impar: '#000000' }
};
