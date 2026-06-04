console.log("✅ f4.js cargado");
class F4 extends Pieza {
    constructor(jugador) { super('F4', jugador); }
    obtenerMovimientos(fila, col, board) {
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        let destinos = []; let caminos = {};
        for (let [df, dc] of dirs) {
            let nf = fila+df, nc = col+dc;
            if (nf>=0 && nf<FILAS && nc>=0 && nc<COLUMNAS && board[nf][nc]===null && esJugable(nf, nc)) {
                let clave = `${nf},${nc}`; destinos.push([nf, nc]); caminos[clave] = [{tipo:'move', to:[nf,nc]}];
            }
        }
        return { destinos, caminos };
    }
}
piezasRegistradas.set('F4', F4);
