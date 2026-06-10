console.log("✅ zonas.js cargado");

const FILAS = 10;
const COLUMNAS = 13;
const CELL_SIZE = 50;

// Esquinas inutilizables (X)
function esNoJugable(f, c) {
    return (f === 0 && c === 0) ||
           (f === 0 && c === 12) ||
           (f === 9 && c === 0) ||
           (f === 9 && c === 12);
}

// Templo izquierdo (columnas 0‑2)
function esTemploIzquierdo(f, c) {
    if (esNoJugable(f, c)) return false;
    if (c === 2 && f >= 1 && f <= 8) return true;
    if (c === 1 && f >= 2 && f <= 7) return true;
    if (c === 0 && f >= 3 && f <= 6) return true;
    return false;
}

// Templo derecho (columnas 10‑12)
function esTemploDerecho(f, c) {
    if (esNoJugable(f, c)) return false;
    if (c === 10 && f >= 1 && f <= 8) return true;
    if (c === 11 && f >= 2 && f <= 7) return true;
    if (c === 12 && f >= 3 && f <= 6) return true;
    return false;
}

// Jardín (centro, columnas 3‑9)
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

// Permiso de captura (solo Reina y Rey pueden capturar Trampero)
function capturaPermitida(tipoAtacante, piezaObjetivo) {
    if (piezaObjetivo && piezaObjetivo.tipo === 'F4') {
        return tipoAtacante === 'F3' || tipoAtacante === 'F6';
    }
    return true;
}

// 🎨 Paleta mexicana
const colores = {
    templo1: { par: '#FFF176', impar: '#E53935' },   // amarillo brillante / rojo intenso
    templo2: { par: '#90CAF9', impar: '#1565C0' },   // azul cielo / azul eléctrico
    jardin:  { par: '#A5D6A7', impar: '#2E7D32' },   // verde claro / verde bosque
    vacio:   { par: '#000000', impar: '#000000' }    // negro puro para las X
};
