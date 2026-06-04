console.log("✅ zonas.js cargado");
const FILAS = 15, COLUMNAS = 23, CELL_SIZE = 50;

function esTemploIzquierdo(f, c) {
    return (c===0&&f===7) || (c===1&&f>=6&&f<=8) || (c===2&&f>=5&&f<=9) || (c===3&&f>=4&&f<=10);
}
function esTemploDerecho(f, c) {
    return (c===22&&f===7) || (c===21&&f>=6&&f<=8) || (c===20&&f>=5&&f<=9) || (c===19&&f>=4&&f<=10);
}
function esJardin(f, c) {
    if (c<4 || c>19) return false;
    if (f<=7) return !(c <= 6-f || c >= 22-(6-f));
    else return !(c <= f-8 || c >= 30-f);
}
function getZona(f, c) {
    if (esTemploIzquierdo(f,c)) return 'templo1';
    if (esTemploDerecho(f,c)) return 'templo2';
    if (esJardin(f,c)) return 'jardin';
    return 'vacio';
}
function esJugable(f, c) {
    return getZona(f, c) !== 'vacio';
}

const colores = {
    templo1: { par: '#FFCCCC', impar: '#CC0000' },
    templo2: { par: '#BBDFFF', impar: '#1E3A8A' },
    jardin:  { par: '#B0E0B0', impar: '#228B22' },
    vacio:   { par: '#2c2c2c', impar: '#2c2c2c' }
};
/**
 * Determina si una pieza atacante puede capturar a la pieza objetivo.
 * Regla especial: F4 solo puede ser capturada por F6.
 */
function capturaPermitida(tipoAtacante, piezaObjetivo) {
    if (piezaObjetivo.tipo === 'F4') {
        return tipoAtacante === 'F6';  // solo F6 puede capturar F4
    }
    return true; // para el resto de piezas, siempre se permite la captura
}
