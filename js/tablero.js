console.log("✅ tablero.js cargado");
const canvas = document.getElementById('tableroCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 650;
canvas.height = 500;

let board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
let turno = 0;
let selectedPiece = null;
let posiblesMovimientos = [];
let caminosDestino = {};

let modoRuta = false;
let rutasAlternativas = [];
let destinoRuta = null;

const menuCoronacion = document.getElementById('menuCoronacion');
const opcionesCoronacion = document.getElementById('opcionesCoronacion');
let coronacionPendiente = null;

let enroqueRealizado = [false, false];

const imagenesPiezas = {};
const colorBordeEquipo = ['#8B0000', '#00008B']; // rojo oscuro, azul oscuro

// 🔊 Sistema de sonido
let audioCtx = null;
function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}
function playTone(frecuencia, duracion, tipo = 'square') {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const ganancia = ctx.createGain();
        osc.type = tipo;
        osc.frequency.value = frecuencia;
        ganancia.gain.setValueAtTime(0.15, ctx.currentTime);
        ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duracion);
        osc.connect(ganancia);
        ganancia.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duracion);
    } catch(e) {}
}
function sonidoMovimiento() { playTone(250, 0.08, 'triangle'); }
function sonidoSalto() { playTone(500, 0.12, 'square'); }
function sonidoEnroque() { playTone(300, 0.2, 'sine'); playTone(400, 0.2, 'sine'); }

// 🎬 Animación
let animando = false;
let colaAnimacion = [];
let origenAnimacion = null;
let piezaAnimacion = null;

function precargarImagenes() {
    const extensiones = ['.jpg', '.jpeg', '.png'];
    for (let tipo of piezasRegistradas.keys()) {
        if (imagenesPiezas[tipo]) continue;
        extensiones.forEach(ext => {
            const img = new Image();
            img.src = `img/${tipo.toLowerCase()}${ext}`;
            img.onload = () => {
                imagenesPiezas[tipo] = img;
                console.log(`✅ Imagen cargada: ${img.src}`);
                dibujarTablero();
            };
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
    historial.guardar({ board: copiarBoard(), turno: turno, enroqueRealizado: [...enroqueRealizado] });
}

function deshacerMovimiento() {
    if (animando) return;
    if (!historial.puedeDeshacer()) return;
    let estado = historial.deshacer();
    board = estado.board;
    turno = estado.turno;
    enroqueRealizado = estado.enroqueRealizado || [false, false];
    selectedPiece = null;
    posiblesMovimientos = [];
    caminosDestino = {};
    modoRuta = false;
    rutasAlternativas = [];
    destinoRuta = null;
    coronacionPendiente = null;
    menuCoronacion.style.display = 'none';
    dibujarTablero();
}

function dibujarTablero() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let x = j * CELL_SIZE, y = i * CELL_SIZE;
            if (esNoJugable(i, j)) {
                ctx.fillStyle = '#000000';
                ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                continue;
            }
            let zona = getZona(i, j);
            let par = (i + j) % 2 === 0;
            let color = zona === 'vacio' ? colores.vacio.par : (par ? colores[zona].par : colores[zona].impar);
            ctx.fillStyle = color;
            ctx.fillRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
        }
    }

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = board[i][j];
            if (pieza) {
                let x = j * CELL_SIZE, y = i * CELL_SIZE;
                let cx = x + CELL_SIZE/2, cy = y + CELL_SIZE/2;
                let radio = CELL_SIZE * 0.4;
                let esTurno = pieza.jugador === turno;
                ctx.globalAlpha = esTurno ? 1.0 : 0.4;
                ctx.strokeStyle = colorBordeEquipo[pieza.jugador];
                ctx.lineWidth = 2.5;
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(cx, cy, radio, 0, 2*Math.PI);
                ctx.fill();
                ctx.stroke();
                let img = imagenesPiezas[pieza.tipo];
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, radio-2, 0, 2*Math.PI);
                    ctx.clip();
                    ctx.drawImage(img, cx - radio + 2, cy - radio + 2, (radio-2)*2, (radio-2)*2);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#000000';
                    ctx.font = `bold ${CELL_SIZE*0.3}px monospace`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(pieza.tipo, cx, cy);
                }
                if (selectedPiece && selectedPiece.fila === i && selectedPiece.col === j) {
                    ctx.strokeStyle = '#FFDD44';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(cx, cy, radio, 0, 2*Math.PI);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1.0;
            }
        }
    }

    if (!modoRuta && !animando) {
        for (let mov of posiblesMovimientos) {
            let f, c;
            if (mov.hasOwnProperty('f')) {
                f = mov.f; c = mov.c;
            } else {
                f = mov[0]; c = mov[1];
            }
            if (mov.tipoMov === 'enroque') {
                ctx.fillStyle = '#800080';
            } else {
                ctx.fillStyle = '#FFD700AA';
            }
            ctx.fillRect(c * CELL_SIZE, f * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
    }

    if (modoRuta && !animando && rutasAlternativas.length > 0) {
        for (let idx = 0; idx < rutasAlternativas.length; idx++) {
            let ruta = rutasAlternativas[idx];
            let [fInter, cInter] = ruta.inter;
            ctx.fillStyle = '#800080';
            ctx.fillRect(cInter * CELL_SIZE, fInter * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
        }
        let [df, dc] = destinoRuta;
        ctx.strokeStyle = '#FFFF00';
        ctx.lineWidth = 3;
        ctx.strokeRect(dc * CELL_SIZE, df * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
    }
}

function validarEnroque(reyFila, reyCol, piezaFila, piezaCol, jugador) {
    if (enroqueRealizado[jugador]) return false;
    const pieza = board[piezaFila][piezaCol];
    if (!pieza) return false;
    if (pieza.jugador !== jugador) return false;
    if (!['F3', 'F0', 'F5'].includes(pieza.tipo)) return false;
    if (reyFila === piezaFila && reyCol === piezaCol) return false;

    let df = piezaFila - reyFila;
    let dc = piezaCol - reyCol;
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
    // Animación del enroque
    sonidoEnroque();
    let rey = board[reyFila][reyCol];
    board[reyFila][reyCol] = null;
    board[piezaFila][piezaCol] = rey;
    enroqueRealizado[jugador] = true;
    dibujarTablero();
}

// 🔄 Animación
function iniciarAnimacion(origen, camino) {
    animando = true;
    colaAnimacion = [...camino];
    origenAnimacion = origen;
    piezaAnimacion = board[origen[0]][origen[1]];
    board[origen[0]][origen[1]] = null;
    procesarSiguientePaso();
}

function procesarSiguientePaso() {
    if (colaAnimacion.length === 0) {
        finalizarAnimacion();
        return;
    }
    const paso = colaAnimacion.shift();
    let [fromF, fromC] = origenAnimacion;
    let toF, toC;

    if (paso.tipo === 'move') {
        [toF, toC] = paso.to;
        sonidoMovimiento();
    } else if (paso.tipo === 'jump') {
        [toF, toC] = paso.to;
        sonidoSalto();
        let [of, oc] = paso.over;
        let piezaSaltada = board[of]?.[oc];
        if (piezaSaltada && piezaSaltada.jugador !== piezaAnimacion.jugador) {
            if (piezaSaltada.tipo === 'F4' && piezaAnimacion.tipo !== 'F3' && piezaAnimacion.tipo !== 'F6') {
                // no capturar
            } else {
                carcela.agregar(piezaSaltada);
                board[of][oc] = null;
            }
        }
    } else if (paso.tipo === 'captureDirect') {
        [toF, toC] = paso.to;
        sonidoSalto();
        let [of, oc] = paso.over;
        let piezaObj = board[of]?.[oc];
        if (piezaObj && piezaObj.jugador !== piezaAnimacion.jugador) {
            if (piezaObj.tipo !== 'F4' || piezaAnimacion.tipo === 'F3' || piezaAnimacion.tipo === 'F6') {
                carcela.agregar(piezaObj);
                board[of][oc] = null;
            }
        }
    } else if (paso.tipo === 'removePiece') {
        let [of, oc] = paso.over;
        let piezaEliminar = board[of]?.[oc];
        if (piezaEliminar) {
            carcela.agregar(piezaEliminar);
            board[of][oc] = null;
        }
        procesarSiguientePaso();
        return;
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
        ctx.lineWidth = 2.5;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, radio, 0, 2*Math.PI);
        ctx.fill();
        ctx.stroke();
        let img = imagenesPiezas[piezaAnimacion.tipo];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.beginPath();
            ctx.arc(x, y, radio-2, 0, 2*Math.PI);
            ctx.clip();
            ctx.drawImage(img, x - radio + 2, y - radio + 2, (radio-2)*2, (radio-2)*2);
        } else {
            ctx.fillStyle = '#000000';
            ctx.font = `bold ${CELL_SIZE*0.3}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(piezaAnimacion.tipo, x, y);
        }
        ctx.restore();

        if (progreso < 1.0) {
            requestAnimationFrame(animarPaso);
        } else {
            board[toF][toC] = piezaAnimacion;
            origenAnimacion = [toF, toC];
            procesarSiguientePaso();
        }
    }
    requestAnimationFrame(animarPaso);
}

function finalizarAnimacion() {
    animando = false;
    let [ff, cc] = origenAnimacion;
    let pieza = board[ff][cc];
    if (pieza && pieza.tipo === 'F1') {
        let zona = getZona(ff, cc);
        if ((pieza.jugador === 0 && zona === 'templo2') || (pieza.jugador === 1 && zona === 'templo1')) {
            coronacionPendiente = { jugador: pieza.jugador, f: ff, c: cc };
            mostrarMenuCoronacion();
        }
    }
    turno = 1 - turno;
    selectedPiece = null;
    posiblesMovimientos = [];
    caminosDestino = {};
    modoRuta = false;
    rutasAlternativas = [];
    destinoRuta = null;
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

function mostrarMenuCoronacion() {
    if (!coronacionPendiente) return;
    const opciones = [
        { tipo: 'F0', nombre: 'Torre' },
        { tipo: 'F2', nombre: 'Caballo' },
        { tipo: 'F4', nombre: 'Trampero' },
        { tipo: 'F5', nombre: 'Alfil' }
    ];
    opcionesCoronacion.innerHTML = '';
    opciones.forEach(op => {
        const btn = document.createElement('button');
        const img = document.createElement('img');
        img.src = `img/${op.tipo.toLowerCase()}.jpg`;
        img.onerror = () => { img.style.display = 'none'; btn.textContent = op.tipo; };
        img.onload = () => { btn.textContent = ''; btn.appendChild(img); };
        btn.appendChild(img);
        btn.onclick = () => coronar(op.tipo);
        opcionesCoronacion.appendChild(btn);
    });
    menuCoronacion.style.display = 'block';
}

function coronar(tipo) {
    if (!coronacionPendiente) return;
    const { jugador, f, c } = coronacionPendiente;
    let nuevaPieza;
    switch (tipo) {
        case 'F0': nuevaPieza = new F0(jugador); break;
        case 'F2': nuevaPieza = new F2(jugador); break;
        case 'F4': nuevaPieza = new F4(jugador); break;
        case 'F5': nuevaPieza = new F5(jugador); break;
        default: return;
    }
    board[f][c] = nuevaPieza;
    menuCoronacion.style.display = 'none';
    coronacionPendiente = null;
    dibujarTablero();
}

function iniciarJuego() {
    board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
    for (let f = 1; f <= 8; f++) board[f][2] = new F1(0);
    board[2][1] = new F5(0);
    board[3][1] = new F2(0);
    board[4][1] = new F0(0);
    board[5][1] = new F0(0);
    board[6][1] = new F2(0);
    board[7][1] = new F5(0);
    board[3][0] = new F4(0);
    board[4][0] = new F6(0);
    board[5][0] = new F3(0);
    board[6][0] = new F4(0);
    for (let f = 1; f <= 8; f++) board[f][10] = new F1(1);
    board[2][11] = new F5(1);
    board[3][11] = new F2(1);
    board[4][11] = new F0(1);
    board[5][11] = new F0(1);
    board[6][11] = new F2(1);
    board[7][11] = new F5(1);
    board[3][12] = new F4(1);
    board[4][12] = new F6(1);
    board[5][12] = new F3(1);
    board[6][12] = new F4(1);
    turno = 0;
    selectedPiece = null;
    posiblesMovimientos = [];
    caminosDestino = {};
    modoRuta = false;
    rutasAlternativas = [];
    destinoRuta = null;
    enroqueRealizado = [false, false];
    coronacionPendiente = null;
    menuCoronacion.style.display = 'none';
    historial.limpiar();
    carcela.limpiar();
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
            selectedPiece = { fila, col };
            let res = fichaClicRuta.obtenerMovimientos(fila, col, board);
            posiblesMovimientos = res.destinos; caminosDestino = res.caminos;
            if (fichaClicRuta.tipo === 'F6' && !enroqueRealizado[turno]) {
                for (let i = 0; i < FILAS; i++) {
                    for (let j = 0; j < COLUMNAS; j++) {
                        let piezaObj = board[i][j];
                        if (!piezaObj || piezaObj.jugador !== turno) continue;
                        if (!['F0','F3','F5'].includes(piezaObj.tipo)) continue;
                        if (validarEnroque(selectedPiece.fila, selectedPiece.col, i, j, turno))
                            posiblesMovimientos.push({ f: i, c: j, tipoMov: 'enroque' });
                    }
                }
            }
            dibujarTablero();
            return;
        }
        for (let ruta of rutasAlternativas) {
            let [if_, ic] = ruta.inter;
            if (if_ === fila && ic === col) {
                let caminoElegido = ruta.pasos;
                aplicarMovimiento([selectedPiece.fila, selectedPiece.col], destinoRuta, caminoElegido);
                modoRuta = false; rutasAlternativas = []; selectedPiece = null;
                posiblesMovimientos = []; caminosDestino = {};
                return;
            }
        }
        modoRuta = false; rutasAlternativas = []; selectedPiece = null;
        posiblesMovimientos = []; caminosDestino = {};
        dibujarTablero();
        return;
    }

    if (!selectedPiece) {
        let ficha = board[fila][col];
        if (ficha && ficha.jugador === turno) {
            selectedPiece = { fila, col };
            let res = ficha.obtenerMovimientos(fila, col, board);
            posiblesMovimientos = res.destinos; caminosDestino = res.caminos;
            if (ficha.tipo === 'F6' && !enroqueRealizado[turno]) {
                for (let i = 0; i < FILAS; i++) {
                    for (let j = 0; j < COLUMNAS; j++) {
                        let piezaObj = board[i][j];
                        if (!piezaObj || piezaObj.jugador !== turno) continue;
                        if (!['F0','F3','F5'].includes(piezaObj.tipo)) continue;
                        if (validarEnroque(selectedPiece.fila, selectedPiece.col, i, j, turno))
                            posiblesMovimientos.push({ f: i, c: j, tipoMov: 'enroque' });
                    }
                }
            }
            dibujarTablero();
        }
        return;
    }

    let movEnroque = posiblesMovimientos.find(m => m.tipoMov === 'enroque' && m.f === fila && m.c === col);
    if (movEnroque) {
        ejecutarEnroque(selectedPiece.fila, selectedPiece.col, fila, col, turno);
        turno = 1 - turno;
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {};
        dibujarTablero();
        return;
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
                    rutasAlternativas = info; destinoRuta = [fila, col];
                    modoRuta = true;
                    dibujarTablero();
                    return;
                } else {
                    let rutaElegida = info[0].pasos;
                    aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col], rutaElegida);
                    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {};
                    modoRuta = false;
                    return;
                }
            } else {
                let rutaUnica = info[0].pasos;
                aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col], rutaUnica);
                selectedPiece = null; posiblesMovimientos = []; caminosDestino = {};
                modoRuta = false;
                return;
            }
        }
        aplicarMovimiento([selectedPiece.fila, selectedPiece.col], [fila, col]);
        selectedPiece = null; posiblesMovimientos = []; caminosDestino = {};
        modoRuta = false;
        return;
    }

    let fichaClic = board[fila][col];
    if (fichaClic && fichaClic.jugador === turno) {
        selectedPiece = { fila, col };
        let res = fichaClic.obtenerMovimientos(fila, col, board);
        posiblesMovimientos = res.destinos; caminosDestino = res.caminos;
        if (fichaClic.tipo === 'F6' && !enroqueRealizado[turno]) {
            for (let i = 0; i < FILAS; i++) {
                for (let j = 0; j < COLUMNAS; j++) {
                    let piezaObj = board[i][j];
                    if (!piezaObj || piezaObj.jugador !== turno) continue;
                    if (!['F0','F3','F5'].includes(piezaObj.tipo)) continue;
                    if (validarEnroque(selectedPiece.fila, selectedPiece.col, i, j, turno))
                        posiblesMovimientos.push({ f: i, c: j, tipoMov: 'enroque' });
                }
            }
        }
        dibujarTablero();
        return;
    }

    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {};
    modoRuta = false;
    dibujarTablero();
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        deshacerMovimiento();
    }
});

iniciarJuego();
