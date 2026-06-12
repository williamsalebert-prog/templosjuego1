console.log("✅ tablero.js cargado");
const canvas = document.getElementById('tableroCanvas');
const ctx = canvas.getContext('2d');
canvas.width = COLUMNAS * CELL_SIZE;   // 900
canvas.height = FILAS * CELL_SIZE;     // 600

let board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
let turno = 0;
let selectedPiece = null;
let posiblesMovimientos = [];
let caminosDestino = {};
let piezasAmenazadas = [];

let modoRuta = false;
let rutasAlternativas = [];
let destinoRuta = null;

const menuCoronacion = document.getElementById('menuCoronacion');
const opcionesCoronacion = document.getElementById('opcionesCoronacion');
let coronacionPendiente = null;

let enroqueRealizado = [false, false];

const btnDeshacer = document.getElementById('btnDeshacer'); // aunque lo ocultamos, mantenemos la lógica Ctrl+Z

const imagenesPiezas = {};
const colorBordeEquipo = ['#8B0000', '#00008B'];

// 🔊 Sonido
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}
function playTone(frec, dur, tipo = 'triangle', vol = 0.1) {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tipo; osc.frequency.value = frec;
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + dur);
    } catch(e) {}
}
function sonidoMovimiento() { playTone(300, 0.1, 'triangle', 0.08); }
function sonidoSalto() { playTone(500, 0.12, 'square', 0.1); }
function sonidoEnroque() { playTone(400, 0.2, 'sine', 0.12); playTone(600, 0.2, 'sine', 0.12); }

let animando = false;
let colaAnimacion = [];
let origenAnimacion = null;
let piezaAnimacion = null;

// ----------------------------------------------------------
// FUNCIONES DE JAQUE
// ----------------------------------------------------------
function obtenerPosicionRey(jugador) {
    for (let i = 0; i < FILAS; i++)
        for (let j = 0; j < COLUMNAS; j++)
            if (board[i][j] && board[i][j].tipo === 'F6' && board[i][j].jugador === jugador)
                return [i, j];
    return null;
}

function esJaque(jugador, tablero = board) {
    let reyPos = obtenerPosicionRey(jugador);
    if (!reyPos) return false;
    let enemigo = 1 - jugador;
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = tablero[i][j];
            if (pieza && pieza.jugador === enemigo && pieza.puedeAtacarRey(i, j, reyPos[0], reyPos[1], tablero))
                return true;
        }
    }
    return false;
}

function esJaqueMate(jugador) {
    if (!esJaque(jugador)) return false;
    return !hayMovimientoLegal(jugador);
}

function hayMovimientoLegal(jugador) {
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = board[i][j];
            if (!pieza || pieza.jugador !== jugador) continue;
            let res = pieza.obtenerMovimientos(i, j, board);
            for (let dest of res.destinos) {
                let clave = `${dest[0]},${dest[1]}`;
                let caminos = res.caminos[clave];
                if (!caminos) continue;
                let caminoReal = Array.isArray(caminos) ? (caminos[0].pasos || caminos[0]) : caminos;
                let copia = copiarBoard();
                if (simularMovimiento(copia, i, j, dest, caminoReal, jugador)) {
                    if (!esJaque(jugador, copia)) return true;
                }
            }
        }
    }
    return false;
}

function simularMovimiento(tablero, fromF, fromC, dest, camino, jugador) {
    let f = fromF, c = fromC;
    let pieza = tablero[f][c];
    for (let paso of camino) {
        if (paso.tipo === 'move') {
            let [nf, nc] = paso.to;
            tablero[f][c] = null; tablero[nf][nc] = pieza; f = nf; c = nc;
        } else if (paso.tipo === 'jump' || paso.tipo === 'captureDirect') {
            let [of, oc] = paso.over;
            let [nf, nc] = paso.to;
            if (of !== undefined && oc !== undefined) tablero[of][oc] = null;
            tablero[f][c] = null; tablero[nf][nc] = pieza; f = nf; c = nc;
        } else if (paso.tipo === 'removePiece') {
            let [of, oc] = paso.over;
            tablero[of][oc] = null;
        }
    }
    return true;
}

// ----------------------------------------------------------
// PRECARGA Y DIBUJO
// ----------------------------------------------------------
function precargarImagenes() {
    const extensiones = ['.jpg', '.jpeg', '.png'];
    for (let tipo of piezasRegistradas.keys()) {
        if (imagenesPiezas[tipo]) continue;
        extensiones.forEach(ext => {
            const img = new Image();
            img.src = `img/${tipo.toLowerCase()}${ext}`;
            img.onload = () => { imagenesPiezas[tipo] = img; dibujarTablero(); };
            img.onerror = () => {};
        });
    }
}

function copiarBoard() {
    return board.map(fila => fila.map(celda => {
        if (celda === null) return null;
        const ClasePieza = piezasRegistradas.get(celda.tipo);
        return ClasePieza ? new ClasePieza(celda.jugador) : null;
    }));
}

function guardarEstado() {
    historial.guardar({ board: copiarBoard(), turno, enroqueRealizado: [...enroqueRealizado] });
}

function dibujarTablero() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let x = j * CELL_SIZE, y = i * CELL_SIZE;
            if (esNoJugable(i, j)) {
                ctx.fillStyle = '#000000'; ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                continue;
            }
            let zona = getZona(i, j);
            let par = (i + j) % 2 === 0;
            let color = zona === 'vacio' ? colores.vacio.par : (par ? colores[zona].par : colores[zona].impar);
            ctx.fillStyle = color; ctx.fillRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
            ctx.strokeStyle = '#000000'; ctx.lineWidth = 1; ctx.strokeRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
        }
    }
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = board[i][j];
            if (pieza) {
                let x = j * CELL_SIZE, y = i * CELL_SIZE;
                let cx = x + CELL_SIZE/2, cy = y + CELL_SIZE/2;
                let radio = CELL_SIZE * 0.4;
                ctx.globalAlpha = 1.0;
                ctx.strokeStyle = colorBordeEquipo[pieza.jugador];
                ctx.lineWidth = 2.5; ctx.fillStyle = '#FFFFFF';
                ctx.beginPath(); ctx.arc(cx, cy, radio, 0, 2*Math.PI); ctx.fill(); ctx.stroke();
                let img = imagenesPiezas[pieza.tipo];
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radio-2, 0, 2*Math.PI); ctx.clip();
                    ctx.drawImage(img, cx - radio + 2, cy - radio + 2, (radio-2)*2, (radio-2)*2);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#000000'; ctx.font = `bold ${CELL_SIZE*0.3}px monospace`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pieza.tipo, cx, cy);
                }
                if (selectedPiece && selectedPiece.fila === i && selectedPiece.col === j) {
                    ctx.strokeStyle = '#FFDD44'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(cx, cy, radio, 0, 2*Math.PI); ctx.stroke();
                }
            }
        }
    }
    ctx.globalAlpha = 1.0;

    // Marcador de jaque (rojo)
    let reyPos = obtenerPosicionRey(turno);
    if (reyPos && esJaque(turno)) {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
        ctx.fillRect(reyPos[1]*CELL_SIZE, reyPos[0]*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
    }

    if (!animando) {
        // Amenazas (naranja)
        if (selectedPiece && piezasAmenazadas.length > 0 &&
            !['F2','F4'].includes(board[selectedPiece.fila][selectedPiece.col]?.tipo)) {
            for (let [af, ac] of piezasAmenazadas) {
                ctx.fillStyle = 'rgba(255,165,0,0.45)';
                ctx.fillRect(ac*CELL_SIZE, af*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
            }
        }
        // Movimientos (amarillo) y enroque (morado)
        for (let mov of posiblesMovimientos) {
            let f, c;
            if (mov.hasOwnProperty('f')) { f = mov.f; c = mov.c; }
            else { f = mov[0]; c = mov[1]; }
            if (mov.tipoMov === 'enroque') ctx.fillStyle = 'rgba(128,0,128,0.5)';
            else ctx.fillStyle = 'rgba(255,215,0,0.5)';
            ctx.fillRect(c*CELL_SIZE, f*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
        }
        // Rutas caballo (azul)
        if (modoRuta && rutasAlternativas.length > 0) {
            for (let ruta of rutasAlternativas) {
                let [fInter, cInter] = ruta.inter;
                ctx.fillStyle = 'rgba(0,100,200,0.5)';
                ctx.fillRect(cInter*CELL_SIZE, fInter*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
            }
            let [df, dc] = destinoRuta;
            ctx.strokeStyle = '#FFFF00'; ctx.lineWidth = 3;
            ctx.strokeRect(dc*CELL_SIZE, df*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
        }
    }
}

// ----------------------------------------------------------
// VALIDACIÓN ENROQUE
// ----------------------------------------------------------
function validarEnroque(reyFila, reyCol, piezaFila, piezaCol, jugador) {
    if (enroqueRealizado[jugador]) return false;
    const pieza = board[piezaFila][piezaCol];
    if (!pieza || pieza.jugador !== jugador || !['F3','F0','F5'].includes(pieza.tipo)) return false;
    if (reyFila === piezaFila && reyCol === piezaCol) return false;
    let df = piezaFila - reyFila, dc = piezaCol - reyCol;
    let dirF = df === 0 ? 0 : df / Math.abs(df);
    let dirC = dc === 0 ? 0 : dc / Math.abs(dc);
    if (pieza.tipo === 'F0' && df !== 0 && dc !== 0) return false;
    if (pieza.tipo === 'F5' && Math.abs(df) !== Math.abs(dc)) return false;
    if (pieza.tipo === 'F3' && !(df === 0 || dc === 0 || Math.abs(df) === Math.abs(dc))) return false;
    let fichasAmigas = 0;
    let f = reyFila + dirF, c = reyCol + dirC;
    while (f !== piezaFila || c !== piezaCol) {
        if (board[f][c]) {
            if (board[f][c].jugador === jugador) fichasAmigas++;
            else return false;
        }
        f += dirF; c += dirC;
    }
    return fichasAmigas <= 1;
}

function ejecutarEnroque(reyFila, reyCol, piezaFila, piezaCol, jugador) {
    guardarEstado();
    let piezaEliminada = board[piezaFila][piezaCol];
    carcela.agregar(piezaEliminada);
    board[piezaFila][piezaCol] = board[reyFila][reyCol];
    board[reyFila][reyCol] = null;
    enroqueRealizado[jugador] = true;
    sonidoEnroque();
    dibujarTablero();
}

// ----------------------------------------------------------
// ANIMACIÓN
// ----------------------------------------------------------
function iniciarAnimacion(origen, camino) {
    animando = true;
    colaAnimacion = [...camino];
    origenAnimacion = origen;
    piezaAnimacion = board[origen[0]][origen[1]];
    board[origen[0]][origen[1]] = null;
    procesarSiguientePaso();
}

function procesarSiguientePaso() {
    if (colaAnimacion.length === 0) { finalizarAnimacion(); return; }
    const paso = colaAnimacion.shift();
    let [fromF, fromC] = origenAnimacion;
    let toF, toC;
    if (paso.tipo === 'move') { [toF, toC] = paso.to; sonidoMovimiento(); }
    else if (paso.tipo === 'jump') {
        [toF, toC] = paso.to; sonidoSalto();
        let [of, oc] = paso.over;
        let p = board[of]?.[oc];
        if (p && p.jugador !== piezaAnimacion.jugador) {
            if (p.tipo === 'F4' && piezaAnimacion.tipo !== 'F3' && piezaAnimacion.tipo !== 'F6') {}
            else { carcela.agregar(p); board[of][oc] = null; }
        }
    } else if (paso.tipo === 'captureDirect') {
        [toF, toC] = paso.to; sonidoSalto();
        let [of, oc] = paso.over;
        let p = board[of]?.[oc];
        if (p && p.jugador !== piezaAnimacion.jugador) {
            if (p.tipo !== 'F4' || piezaAnimacion.tipo === 'F3' || piezaAnimacion.tipo === 'F6') {
                carcela.agregar(p); board[of][oc] = null;
            }
        }
    } else if (paso.tipo === 'removePiece') {
        let [of, oc] = paso.over;
        let p = board[of]?.[oc];
        if (p) { carcela.agregar(p); board[of][oc] = null; }
        procesarSiguientePaso(); return;
    }
    const inicio = performance.now();
    const duracion = 200;
    const origenX = fromC * CELL_SIZE + CELL_SIZE/2;
    const origenY = fromF * CELL_SIZE + CELL_SIZE/2;
    const destinoX = toC * CELL_SIZE + CELL_SIZE/2;
    const destinoY = toF * CELL_SIZE + CELL_SIZE/2;
    function animarPaso(timestamp) {
        const progreso = Math.min((timestamp - inicio) / duracion, 1.0);
        const x = origenX + (destinoX - origenX) * progreso;
        const y = origenY + (destinoY - origenY) * progreso + (paso.tipo === 'jump' ? Math.sin(progreso * Math.PI) * 15 : 0);
        dibujarTablero();
        ctx.save();
        let radio = CELL_SIZE * 0.4;
        ctx.strokeStyle = colorBordeEquipo[piezaAnimacion.jugador];
        ctx.lineWidth = 2.5; ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(x, y, radio, 0, 2*Math.PI); ctx.fill(); ctx.stroke();
        let img = imagenesPiezas[piezaAnimacion.tipo];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.beginPath(); ctx.arc(x, y, radio-2, 0, 2*Math.PI); ctx.clip();
            ctx.drawImage(img, x - radio + 2, y - radio + 2, (radio-2)*2, (radio-2)*2);
        } else {
            ctx.fillStyle = '#000000'; ctx.font = `bold ${CELL_SIZE*0.3}px monospace`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(piezaAnimacion.tipo, x, y);
        }
        ctx.restore();
        if (progreso < 1.0) requestAnimationFrame(animarPaso);
        else { origenAnimacion = [toF, toC]; procesarSiguientePaso(); }
    }
    requestAnimationFrame(animarPaso);
}

function finalizarAnimacion() {
    let [ff, cc] = origenAnimacion;
    board[ff][cc] = piezaAnimacion;
    animando = false;

    let pieza = board[ff][cc];
    if (pieza && pieza.tipo === 'F1') {
        let zona = getZona(ff, cc);
        if ((pieza.jugador === 0 && zona === 'templo2') || (pieza.jugador === 1 && zona === 'templo1')) {
            coronacionPendiente = { jugador: pieza.jugador, f: ff, c: cc };
            mostrarMenuCoronacion();
            return;
        }
    }

    turno = 1 - turno;
    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = []; destinoRuta = null;
    dibujarTablero();
}

function aplicarMovimiento(origen, destino, caminoElegido = null) {
    let clave = `${destino[0]},${destino[1]}`;
    let camino;
    if (caminoElegido) camino = caminoElegido;
    else {
        let info = caminosDestino[clave];
        if (!info) return false;
        if (Array.isArray(info)) {
            if (info.length > 0 && info[0].hasOwnProperty('pasos')) camino = info[0].pasos;
            else camino = info;
        } else camino = info;
    }
    guardarEstado();
    iniciarAnimacion(origen, camino);
    return true;
}

function mostrarMenuCoronacion() { /* ... igual que antes ... */ }
function coronar(tipo) { /* ... igual que antes ... */ }

// ----------------------------------------------------------
// INICIO Y EVENTOS
// ----------------------------------------------------------
function iniciarJuego() {
    board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
    // Templo izquierdo (jugador 0, columnas 1-3)
    for (let f = 1; f <= 8; f++) board[f][3] = new F1(0);
    board[2][2] = new F5(0); board[3][2] = new F2(0); board[4][2] = new F0(0);
    board[5][2] = new F0(0); board[6][2] = new F2(0); board[7][2] = new F5(0);
    board[3][1] = new F4(0); board[4][1] = new F6(0); board[5][1] = new F3(0); board[6][1] = new F4(0);
    // Templo derecho (jugador 1, columnas 11-13)
    for (let f = 1; f <= 8; f++) board[f][11] = new F1(1);
    board[2][12] = new F5(1); board[3][12] = new F2(1); board[4][12] = new F0(1);
    board[5][12] = new F0(1); board[6][12] = new F2(1); board[7][12] = new F5(1);
    board[3][13] = new F4(1); board[4][13] = new F6(1); board[5][13] = new F3(1); board[6][13] = new F4(1);

    turno = 0; selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = []; destinoRuta = null;
    enroqueRealizado = [false, false]; coronacionPendiente = null;
    menuCoronacion.style.display = 'none';
    historial.limpiar(); carcela.limpiar();
    precargarImagenes();
    dibujarTablero();
}

canvas.addEventListener('click', (e) => {
    if (coronacionPendiente || animando) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const col = Math.floor(((e.clientX - rect.left) * scaleX) / CELL_SIZE);
    const fila = Math.floor(((e.clientY - rect.top) * scaleY) / CELL_SIZE);
    if (fila < 0 || fila >= FILAS || col < 0 || col >= COLUMNAS) return;

    if (modoRuta) {
        let fichaClicRuta = board[fila][col];
        if (fichaClicRuta && fichaClicRuta.jugador === turno) {
            modoRuta = false; rutasAlternativas = [];
            seleccionarNuevaPieza(fila, col);
            return;
        }
        for (let ruta of rutasAlternativas) {
            let [if_, ic] = ruta.inter;
            if (if_ === fila && ic === col) {
                let caminoElegido = ruta.pasos;
                aplicarMovimiento([selectedPiece.fila, selectedPiece.col], destinoRuta, caminoElegido);
                return;
            }
        }
        modoRuta = false; rutasAlternativas = []; selectedPiece = null;
        posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        dibujarTablero(); return;
    }

    if (!selectedPiece) {
        seleccionarNuevaPieza(fila, col);
        return;
    }

    let movEnroque = posiblesMovimientos.find(m => m.tipoMov === 'enroque' && m.f === fila && m.c === col);
    if (movEnroque) {
        ejecutarEnroque(selectedPiece.fila, selectedPiece.col, fila, col, turno);
        turno = 1 - turno;
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        dibujarTablero(); return;
    }

    let clave = `${fila},${col}`;
    let esValido = posiblesMovimientos.some(mov => {
        if (Array.isArray(mov)) return mov[0] === fila && mov[1] === col;
        return false;
    });
    if (esValido) {
        let info = caminosDestino[clave];
        if (Array.isArray(info) && info.length > 0 && info[0].hasOwnProperty('pasos')) {
            if (info.length > 1) {
                let algunaConEnemigo = info.some(ruta => ruta.tieneEnemigo);
                if (algunaConEnemigo) {
                    rutasAlternativas = info; destinoRuta = [fila, col]; modoRuta = true;
                    dibujarTablero(); return;
                } else {
                    aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col], info[0].pasos);
                    return;
                }
            } else {
                aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col], info[0].pasos);
                return;
            }
        }
        aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col]);
        return;
    }

    seleccionarNuevaPieza(fila, col);
});

function seleccionarNuevaPieza(fila, col) {
    let ficha = board[fila][col];
    if (ficha && ficha.jugador === turno) {
        selectedPiece = { fila, col };
        let res = ficha.obtenerMovimientos(fila, col, board);
        posiblesMovimientos = res.destinos;
        caminosDestino = res.caminos;
        piezasAmenazadas = res.piezasAmenazadas || [];

        if (ficha.tipo === 'F6' && !enroqueRealizado[turno]) {
            for (let i = 0; i < FILAS; i++)
                for (let j = 0; j < COLUMNAS; j++) {
                    let piezaObj = board[i][j];
                    if (!piezaObj || piezaObj.jugador !== turno) continue;
                    if (!['F0','F3','F5'].includes(piezaObj.tipo)) continue;
                    if (validarEnroque(selectedPiece.fila, selectedPiece.col, i, j, turno))
                        posiblesMovimientos.push({ f: i, c: j, tipoMov: 'enroque' });
                }
        }

        // Si el jugador está en jaque, filtrar movimientos que no salvan
        if (esJaque(turno)) {
            let nuevosMovs = [];
            let nuevosCaminos = {};
            for (let mov of posiblesMovimientos) {
                let f, c;
                if (mov.hasOwnProperty('f')) { f = mov.f; c = mov.c; }
                else { f = mov[0]; c = mov[1]; }
                let copia = copiarBoard();
                let claveMov = `${f},${c}`;
                let caminosMov = mov.caminos || caminosDestino[claveMov];
                if (!caminosMov) continue;
                let caminoReal = Array.isArray(caminosMov) ? (caminosMov[0].pasos || caminosMov[0]) : caminosMov;
                if (!caminoReal) continue;
                if (simularMovimiento(copia, selectedPiece.fila, selectedPiece.col, [f,c], caminoReal, turno)) {
                    if (!esJaque(turno, copia)) {
                        nuevosMovs.push(mov);
                        nuevosCaminos[claveMov] = caminosMov;
                    }
                }
            }
            posiblesMovimientos = nuevosMovs;
            caminosDestino = nuevosCaminos;
        }

        dibujarTablero();
    } else {
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
        modoRuta = false; dibujarTablero();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (!animando) {
            if (!historial.puedeDeshacer()) return;
            let estado = historial.deshacer();
            board = estado.board; turno = estado.turno;
            enroqueRealizado = estado.enroqueRealizado || [false, false];
            selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
            modoRuta = false; rutasAlternativas = []; destinoRuta = null;
            coronacionPendiente = null; menuCoronacion.style.display = 'none';
            dibujarTablero();
        }
    }
});

iniciarJuego();
