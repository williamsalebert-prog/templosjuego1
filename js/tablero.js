console.log("✅ tablero.js cargado");
const canvas = document.getElementById('tableroCanvas');
const ctx = canvas.getContext('2d');
canvas.width = COLUMNAS * CELL_SIZE;
canvas.height = FILAS * CELL_SIZE;

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

// Botones empate
const btnOfrecer = document.getElementById('btnOfrecerEmpate');
const btnAceptar = document.getElementById('btnAceptarEmpate');
const btnRechazar = document.getElementById('btnRechazarEmpate');
let empateOfrecido = false;

// Estado de jaque
let enJaque = false;
let jaqueMate = false;
let ahogado = false;

// Contadores para tablas
let movimientosSinCapturaOPeon = 0;
let historialPosiciones = []; // array de strings "tablero|turno|enroque0|enroque1"
let tripleRepeticion = false;

// Inactividad
let turnosSinSalir = [0, 0]; // turnos consecutivos de cada jugador sin 1/3 fuera del templo
let totalPiezas = [18, 18]; // se actualiza dinámicamente

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
// UTILIDADES DE JAQUE / MATE / TABLAS
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
    if (!reyPos) return false; // rey capturado
    let enemigo = 1 - jugador;
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = tablero[i][j];
            if (pieza && pieza.jugador === enemigo) {
                if (pieza.puedeAtacarRey(i, j, reyPos[0], reyPos[1], tablero))
                    return true;
            }
        }
    }
    return false;
}

function esJaqueMate(jugador) {
    if (!esJaque(jugador)) return false;
    return !hayMovimientoLegal(jugador);
}

function esAhogado(jugador) {
    if (esJaque(jugador)) return false;
    return !hayMovimientoLegal(jugador);
}

function hayMovimientoLegal(jugador) {
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = board[i][j];
            if (!pieza || pieza.jugador !== jugador) continue;
            let res = pieza.obtenerMovimientos(i, j, board);
            for (let dest of res.destinos) {
                let copia = copiarBoard();
                // Simular movimiento
                let clave = `${dest[0]},${dest[1]}`;
                let caminos = res.caminos[clave];
                if (!caminos) continue;
                let caminoReal = Array.isArray(caminos) ? (caminos[0].pasos || caminos[0]) : caminos;
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

function materialInsuficiente() {
    let piezas0 = [], piezas1 = [];
    for (let i = 0; i < FILAS; i++)
        for (let j = 0; j < COLUMNAS; j++)
            if (board[i][j]) {
                if (board[i][j].jugador === 0) piezas0.push(board[i][j].tipo);
                else piezas1.push(board[i][j].tipo);
            }
    // Solo reyes
    if (piezas0.length === 1 && piezas1.length === 1) return true;
    // Rey y alfil / rey y trampero (no pueden dar mate)
    if (piezas0.length === 2 && piezas0.includes('F4') && piezas1.length === 1) return true;
    if (piezas1.length === 2 && piezas1.includes('F4') && piezas0.length === 1) return true;
    // Rey y alfil vs rey (sin posibilidad de mate)
    if (piezas0.length === 2 && (piezas0.includes('F5') || piezas0.includes('F0')) && piezas1.length === 1) return true;
    if (piezas1.length === 2 && (piezas1.includes('F5') || piezas1.includes('F0')) && piezas0.length === 1) return true;
    return false;
}

function contarPiezasFueraTemplo(jugador) {
    let dentro = 0;
    let total = 0;
    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            if (board[i][j] && board[i][j].jugador === jugador) {
                total++;
                let zona = getZona(i, j);
                if ((jugador === 0 && zona === 'templo1') || (jugador === 1 && zona === 'templo2'))
                    dentro++;
            }
        }
    }
    totalPiezas[jugador] = total;
    let umbral = Math.ceil(total / 3);
    let fuera = total - dentro;
    return fuera >= umbral;
}

// ----------------------------------------------------------
// PRECARGA Y ESTADO
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
    historial.guardar({ board: copiarBoard(), turno, enroqueRealizado: [...enroqueRealizado], movimientosSinCapturaOPeon, turnosSinSalir: [...turnosSinSalir], empateOfrecido });
    btnDeshacer.disabled = false;
}

// ----------------------------------------------------------
// DIBUJO
// ----------------------------------------------------------
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

    // Marcadores (solo si no animando)
    if (!animando) {
        // Estado especial (jaque mate, ahogado)
        if (jaqueMate || ahogado) {
            let rey = obtenerPosicionRey(turno);
            if (rey) {
                ctx.fillStyle = jaqueMate ? 'rgba(120,120,120,0.6)' : 'rgba(100,200,100,0.6)';
                ctx.fillRect(rey[1]*CELL_SIZE, rey[0]*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
            }
        }
        // Jaque
        if (enJaque && !jaqueMate) {
            let rey = obtenerPosicionRey(turno);
            if (rey) {
                ctx.fillStyle = 'rgba(255,50,50,0.5)';
                ctx.fillRect(rey[1]*CELL_SIZE, rey[0]*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
            }
        }
        // Inactividad (café)
        if (turnosSinSalir[turno] >= 22) {
            let rey = obtenerPosicionRey(turno);
            if (rey) {
                ctx.fillStyle = 'rgba(139,90,43,0.5)';
                ctx.fillRect(rey[1]*CELL_SIZE, rey[0]*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
            }
        }
        // Amenazas (naranja) - solo si no es caballo ni trampero
        if (selectedPiece && piezasAmenazadas.length > 0 &&
            !['F2','F4'].includes(board[selectedPiece.fila][selectedPiece.col]?.tipo)) {
            for (let [af, ac] of piezasAmenazadas) {
                ctx.fillStyle = 'rgba(255,165,0,0.45)';
                ctx.fillRect(ac*CELL_SIZE, af*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
            }
        }
        // Destinos (amarillo) y enroque (morado)
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
            else { carcela.agregar(p); board[of][oc] = null; movimientosSinCapturaOPeon = 0; }
        }
    } else if (paso.tipo === 'captureDirect') {
        [toF, toC] = paso.to; sonidoSalto();
        let [of, oc] = paso.over;
        let p = board[of]?.[oc];
        if (p && p.jugador !== piezaAnimacion.jugador) {
            if (p.tipo !== 'F4' || piezaAnimacion.tipo === 'F3' || piezaAnimacion.tipo === 'F6') {
                carcela.agregar(p); board[of][oc] = null; movimientosSinCapturaOPeon = 0;
            }
        }
    } else if (paso.tipo === 'removePiece') {
        let [of, oc] = paso.over;
        let p = board[of]?.[oc];
        if (p) { carcela.agregar(p); board[of][oc] = null; movimientosSinCapturaOPeon = 0; }
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

    // Actualizar contador 50 movimientos
    if (piezaAnimacion.tipo === 'F1') movimientosSinCapturaOPeon = 0;
    else movimientosSinCapturaOPeon++;

    // Guardar posición para repetición
    let clavePos = `${JSON.stringify(board.map(fila => fila.map(c => c ? c.tipo+c.jugador : ' ')))}|${turno}|${enroqueRealizado[0]}|${enroqueRealizado[1]}`;
    historialPosiciones.push(clavePos);
    if (historialPosiciones.filter(p => p === clavePos).length >= 3) tripleRepeticion = true;

    // Inactividad
    if (!contarPiezasFueraTemplo(turno)) turnosSinSalir[turno]++;
    else turnosSinSalir[turno] = 0;

    // Comprobar fin de juego
    let reyEnemigo = obtenerPosicionRey(1 - turno);
    if (!reyEnemigo) {
        alert(`¡Jugador ${turno+1} gana! Rey enemigo capturado.`);
        iniciarJuego(); return;
    }

    // Jaque mate / ahogado
    if (esJaqueMate(1 - turno)) {
        jaqueMate = true;
        alert(`¡Jaque mate! Gana Jugador ${turno+1}`);
        iniciarJuego(); return;
    }
    if (esAhogado(1 - turno)) {
        ahogado = true;
        alert(`¡Ahogado! Tablas.`);
        iniciarJuego(); return;
    }
    enJaque = esJaque(1 - turno);

    // Material insuficiente
    if (materialInsuficiente()) {
        alert(`Tablas por material insuficiente.`);
        iniciarJuego(); return;
    }
    // 50 movimientos
    if (movimientosSinCapturaOPeon >= 100) {
        alert(`Tablas por regla de 50 movimientos.`);
        iniciarJuego(); return;
    }
    // Triple repetición
    if (tripleRepeticion) {
        alert(`Tablas por triple repetición.`);
        iniciarJuego(); return;
    }
    // Inactividad
    if (turnosSinSalir[1 - turno] >= 24) {
        alert(`Jugador ${2-turno} pierde por inactividad.`);
        iniciarJuego(); return;
    }

    // Coronación
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
    actualizarInterfaz();
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
        { tipo: 'F0', nombre: 'Torre' }, { tipo: 'F2', nombre: 'Caballo' },
        { tipo: 'F4', nombre: 'Trampero' }, { tipo: 'F5', nombre: 'Alfil' }
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
    turno = 1 - turno;
    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    actualizarInterfaz();
    dibujarTablero();
}

function actualizarInterfaz() {
    document.getElementById('turnoTexto').innerText = `Turno: Jugador ${turno+1}`;
    let estado = '';
    if (enJaque) estado = '¡JAQUE!';
    if (jaqueMate) estado = 'JAQUE MATE';
    if (ahogado) estado = 'AHOGADO (Tablas)';
    document.getElementById('estadoJuego').innerText = estado;
    btnAceptar.disabled = !empateOfrecido;
    btnRechazar.disabled = !empateOfrecido;
}

// ----------------------------------------------------------
// INICIO Y EVENTOS
// ----------------------------------------------------------
function iniciarJuego() {
    board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
    for (let f = 1; f <= 8; f++) { board[f][3] = new F1(0); board[f][11] = new F1(1); }
    board[2][2] = new F5(0); board[3][2] = new F2(0); board[4][2] = new F0(0);
    board[5][2] = new F0(0); board[6][2] = new F2(0); board[7][2] = new F5(0);
    board[3][1] = new F4(0); board[4][1] = new F6(0); board[5][1] = new F3(0); board[6][1] = new F4(0);
    board[2][12] = new F5(1); board[3][12] = new F2(1); board[4][12] = new F0(1);
    board[5][12] = new F0(1); board[6][12] = new F2(1); board[7][12] = new F5(1);
    board[3][13] = new F4(1); board[4][13] = new F6(1); board[5][13] = new F3(1); board[6][13] = new F4(1);

    turno = 0; selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; rutasAlternativas = []; destinoRuta = null;
    enroqueRealizado = [false, false]; coronacionPendiente = null;
    menuCoronacion.style.display = 'none';
    enJaque = false; jaqueMate = false; ahogado = false;
    movimientosSinCapturaOPeon = 0; historialPosiciones = []; tripleRepeticion = false;
    turnosSinSalir = [0, 0]; empateOfrecido = false;
    btnAceptar.disabled = true; btnRechazar.disabled = true;
    historial.limpiar(); carcela.limpiar();
    precargarImagenes();
    actualizarInterfaz();
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
            posiblesMovimientos = res.destinos; caminosDestino = res.caminos; piezasAmenazadas = res.piezasAmenazadas || [];
            if (fichaClicRuta.tipo === 'F6' && !enroqueRealizado[turno]) agregarEnroques();
            dibujarTablero(); return;
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
        let ficha = board[fila][col];
        if (ficha && ficha.jugador === turno) {
            selectedPiece = { fila, col };
            let res = ficha.obtenerMovimientos(fila, col, board);
            posiblesMovimientos = res.destinos; caminosDestino = res.caminos; piezasAmenazadas = res.piezasAmenazadas || [];
            if (ficha.tipo === 'F6' && !enroqueRealizado[turno]) agregarEnroques();
            // Si en jaque, filtrar movimientos que no salvan
            if (enJaque) filtrarMovimientosJaque();
            dibujarTablero();
        }
        return;
    }

    let movEnroque = posiblesMovimientos.find(m => m.tipoMov === 'enroque' && m.f === fila && m.c === col);
    if (movEnroque) {
        ejecutarEnroque(selectedPiece.fila, selectedPiece.col, fila, col, turno);
        turno = 1 - turno; actualizarInterfaz();
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

    let fichaClic = board[fila][col];
    if (fichaClic && fichaClic.jugador === turno) {
        selectedPiece = { fila, col };
        let res = fichaClic.obtenerMovimientos(fila, col, board);
        posiblesMovimientos = res.destinos; caminosDestino = res.caminos; piezasAmenazadas = res.piezasAmenazadas || [];
        if (fichaClic.tipo === 'F6' && !enroqueRealizado[turno]) agregarEnroques();
        if (enJaque) filtrarMovimientosJaque();
        dibujarTablero(); return;
    }

    selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
    modoRuta = false; dibujarTablero();
});

function agregarEnroques() {
    for (let i = 0; i < FILAS; i++)
        for (let j = 0; j < COLUMNAS; j++) {
            let piezaObj = board[i][j];
            if (!piezaObj || piezaObj.jugador !== turno) continue;
            if (!['F0','F3','F5'].includes(piezaObj.tipo)) continue;
            if (validarEnroque(selectedPiece.fila, selectedPiece.col, i, j, turno))
                posiblesMovimientos.push({ f: i, c: j, tipoMov: 'enroque' });
        }
}

function filtrarMovimientosJaque() {
    let nuevosMovs = [];
    let nuevosCaminos = {};
    for (let mov of posiblesMovimientos) {
        let f, c;
        if (mov.hasOwnProperty('f')) { f = mov.f; c = mov.c; }
        else { f = mov[0]; c = mov[1]; }
        let copia = copiarBoard();
        let clave = `${f},${c}`;
        let caminos = mov.caminos || caminosDestino[clave];
        if (!caminos) continue;
        let caminoReal = Array.isArray(caminos) ? (caminos[0].pasos || caminos[0]) : caminos;
        if (!caminoReal) continue;
        if (simularMovimiento(copia, selectedPiece.fila, selectedPiece.col, [f,c], caminoReal, turno)) {
            if (!esJaque(turno, copia)) {
                nuevosMovs.push(mov);
                nuevosCaminos[clave] = caminos;
            }
        }
    }
    posiblesMovimientos = nuevosMovs;
    caminosDestino = nuevosCaminos;
}

// Botones empate
btnOfrecer.addEventListener('click', () => {
    if (empateOfrecido) return;
    empateOfrecido = true;
    btnAceptar.disabled = false;
    btnRechazar.disabled = false;
    alert(`Jugador ${turno+1} ofrece tablas.`);
});

btnAceptar.addEventListener('click', () => {
    if (!empateOfrecido) return;
    alert('¡Tablas por acuerdo mutuo!');
    iniciarJuego();
});

btnRechazar.addEventListener('click', () => {
    empateOfrecido = false;
    btnAceptar.disabled = true;
    btnRechazar.disabled = true;
    alert('Oferta de tablas rechazada.');
});

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (!animando) {
            if (!historial.puedeDeshacer()) return;
            let estado = historial.deshacer();
            board = estado.board; turno = estado.turno;
            enroqueRealizado = estado.enroqueRealizado || [false, false];
            movimientosSinCapturaOPeon = estado.movimientosSinCapturaOPeon || 0;
            turnosSinSalir = estado.turnosSinSalir || [0,0];
            empateOfrecido = estado.empateOfrecido || false;
            btnAceptar.disabled = !empateOfrecido; btnRechazar.disabled = !empateOfrecido;
            selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
            modoRuta = false; rutasAlternativas = []; destinoRuta = null;
            coronacionPendiente = null; menuCoronacion.style.display = 'none';
            enJaque = esJaque(turno);
            actualizarInterfaz();
            dibujarTablero();
        }
    }
});

iniciarJuego();
