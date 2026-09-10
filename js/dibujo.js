console.log("✅ dibujo.js cargado");

// ------------------------------------------------------------------
// Generador de "ruido" determinístico (sin dependencias) para dibujar
// vetas de madera siempre iguales en cada casilla, dándole un aspecto
// más realista que un simple color plano.
// ------------------------------------------------------------------
function pseudoAleatorio(semilla) {
    let x = Math.sin(semilla) * 10000;
    return x - Math.floor(x);
}

function dibujarVetaMadera(ctx, x, y, w, h, colorBase, semilla) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = colorBase;
    ctx.fillRect(x, y, w, h);

    // Vetas onduladas suaves, en tono ligeramente más oscuro que la base
    const numVetas = 4;
    for (let v = 0; v < numVetas; v++) {
        const offset = pseudoAleatorio(semilla * 13.7 + v * 3.1);
        const opacidad = 0.05 + pseudoAleatorio(semilla + v) * 0.06;
        ctx.strokeStyle = `rgba(40,20,8,${opacidad})`;
        ctx.lineWidth = 1 + pseudoAleatorio(semilla + v * 7) * 1.5;
        ctx.beginPath();
        const yBase = y + (h / (numVetas + 1)) * (v + 1) + offset * h * 0.3 - h * 0.15;
        ctx.moveTo(x, yBase);
        const ampli = h * 0.12;
        ctx.bezierCurveTo(
            x + w * 0.3, yBase + ampli * (pseudoAleatorio(semilla + v + 1) - 0.5) * 2,
            x + w * 0.7, yBase + ampli * (pseudoAleatorio(semilla + v + 2) - 0.5) * 2,
            x + w, yBase + ampli * (pseudoAleatorio(semilla + v + 3) - 0.5) * 2
        );
        ctx.stroke();
    }

    // Viñeta sutil: ligero sombreado hacia los bordes de la casilla para dar profundidad
    const grad = ctx.createRadialGradient(x + w/2, y + h/2, w*0.1, x + w/2, y + h/2, w*0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.10)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    ctx.restore();
}

let fondoTableroCache = null;

// El estado de jaque no cambia al seleccionar una pieza o abrir un selector de
// ruta. Cachearlo evita regenerar todos los caminos enemigos en cada clic.
let cacheJaqueVisual = { firma: null, turno: null, enJaque: false, atacantes: [] };

function firmaLigeraTableroVisual() {
    let h = 2166136261 >>> 0;
    for (let f = 0; f < FILAS; f++) {
        for (let c = 0; c < COLUMNAS; c++) {
            const p = board[f][c];
            let n = 0;
            if (p) n = ((parseInt(p.tipo.slice(1), 10) + 1) * 3) + p.jugador + 1;
            h ^= n; h = Math.imul(h, 16777619) >>> 0;
        }
    }
    return h;
}

function fijarCacheJaqueVisual(analisis, jugador = turno) {
    if (!analisis) return;
    cacheJaqueVisual = {
        firma: firmaLigeraTableroVisual(),
        turno: jugador,
        enJaque: !!analisis.enJaque,
        atacantes: Array.isArray(analisis.atacantes) ? analisis.atacantes.map(p => [...p]) : []
    };
}

function obtenerEstadoJaqueVisual() {
    if (animando) return { enJaque: false, atacantes: [] };
    const firma = firmaLigeraTableroVisual();
    if (cacheJaqueVisual.firma === firma && cacheJaqueVisual.turno === turno) return cacheJaqueVisual;
    const atacantes = (typeof obtenerPiezasQueDanJaque === 'function') ? obtenerPiezasQueDanJaque(turno, board) : [];
    cacheJaqueVisual = { firma, turno, enJaque: atacantes.length > 0, atacantes };
    return cacheJaqueVisual;
}

function obtenerFondoTableroCache() {
    const ratio = (typeof PIXEL_RATIO !== 'undefined') ? PIXEL_RATIO : 1;
    const ancho = (typeof ANCHO_LOGICO !== 'undefined') ? ANCHO_LOGICO : COLUMNAS * CELL_SIZE;
    const alto = (typeof ALTO_LOGICO !== 'undefined') ? ALTO_LOGICO : FILAS * CELL_SIZE;
    if (fondoTableroCache && fondoTableroCache._templosRatio === ratio &&
        fondoTableroCache.width === Math.round(ancho * ratio) && fondoTableroCache.height === Math.round(alto * ratio)) {
        return fondoTableroCache;
    }
    const fondo = document.createElement('canvas');
    fondo.width = Math.round(ancho * ratio); fondo.height = Math.round(alto * ratio);
    fondo._templosRatio = ratio;
    const fctx = fondo.getContext('2d');
    fctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            const x = j * CELL_SIZE, y = i * CELL_SIZE;
            if (esNoJugable(i, j)) {
                fctx.fillStyle = '#120c08'; fctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                continue;
            }
            const zona = getZona(i, j);
            const par = (i + j) % 2 === 0;
            const color = zona === 'vacio' ? colores.vacio.par : (par ? colores[zona].par : colores[zona].impar);
            dibujarVetaMadera(fctx, x, y, CELL_SIZE - 1, CELL_SIZE - 1, color, i * 31 + j * 17 + 1);

            fctx.strokeStyle = 'rgba(255,235,200,0.18)';
            fctx.lineWidth = 1;
            fctx.beginPath(); fctx.moveTo(x, y + CELL_SIZE - 1); fctx.lineTo(x, y); fctx.lineTo(x + CELL_SIZE - 1, y); fctx.stroke();
            fctx.strokeStyle = 'rgba(0,0,0,0.22)';
            fctx.beginPath(); fctx.moveTo(x + CELL_SIZE - 1, y); fctx.lineTo(x + CELL_SIZE - 1, y + CELL_SIZE - 1); fctx.lineTo(x, y + CELL_SIZE - 1); fctx.stroke();
        }
    }
    fondoTableroCache = fondo;
    return fondoTableroCache;
}

function dibujarTablero() {
    const ancho = (typeof ANCHO_LOGICO !== 'undefined') ? ANCHO_LOGICO : COLUMNAS * CELL_SIZE;
    const alto = (typeof ALTO_LOGICO !== 'undefined') ? ALTO_LOGICO : FILAS * CELL_SIZE;
    ctx.clearRect(0, 0, ancho, alto);
    // La madera y las zonas son estáticas: se generan una sola vez y se reutilizan.
    // El cache se genera a la densidad del dispositivo para que no se vea borroso
    // en pantallas HiDPI/Retina, manteniendo las coordenadas lógicas del motor.
    const fondo = obtenerFondoTableroCache();
    ctx.drawImage(fondo, 0, 0, fondo.width, fondo.height, 0, 0, ancho, alto);

    // Última jugada: dos marcas suaves ayudan a reconstruir visualmente qué
    // acaba de ocurrir sin competir con los destinos disponibles actuales.
    if (typeof ultimaJugadaVisual !== 'undefined' && ultimaJugadaVisual) {
        const puntos = [ultimaJugadaVisual.origen, ultimaJugadaVisual.destino];
        puntos.forEach((p, idx) => {
            if (!Array.isArray(p)) return;
            const [f, c] = p;
            ctx.fillStyle = idx === 0 ? 'rgba(228,194,105,0.16)' : 'rgba(228,194,105,0.25)';
            ctx.fillRect(c * CELL_SIZE + 2, f * CELL_SIZE + 2, CELL_SIZE - 5, CELL_SIZE - 5);
            ctx.strokeStyle = idx === 0 ? 'rgba(238,208,127,0.28)' : 'rgba(238,208,127,0.48)';
            ctx.lineWidth = 2;
            ctx.strokeRect(c * CELL_SIZE + 3, f * CELL_SIZE + 3, CELL_SIZE - 7, CELL_SIZE - 7);
        });
    }

    // Hover de escritorio: solo contorno, nunca cambia reglas ni selección.
    if (!animando && typeof casillaHover !== 'undefined' && casillaHover) {
        const { fila, col } = casillaHover;
        if (!esNoJugable(fila, col)) {
            ctx.strokeStyle = 'rgba(245,231,199,0.32)';
            ctx.lineWidth = 2;
            ctx.strokeRect(col * CELL_SIZE + 4, fila * CELL_SIZE + 4, CELL_SIZE - 9, CELL_SIZE - 9);
        }
    }

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let pieza = board[i][j];
            if (pieza) {
                let x = j * CELL_SIZE, y = i * CELL_SIZE;
                let cx = x + CELL_SIZE/2, cy = y + CELL_SIZE/2;
                dibujarPiezaTallada(ctx, cx, cy, CELL_SIZE * 0.4, pieza, i === selectedPiece?.fila && j === selectedPiece?.col);
            }
        }
    }
    ctx.globalAlpha = 1.0;

    let reyPos = obtenerPosicionRey(turno);
    // Un único cálculo (y normalmente cacheado) sirve tanto para saber si hay
    // jaque como para resaltar al/los atacantes. Antes se recorría el motor dos veces.
    const estadoJaqueVisual = reyPos ? obtenerEstadoJaqueVisual() : { enJaque: false, atacantes: [] };
    if (estadoJaqueVisual.enJaque) {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
        ctx.fillRect(reyPos[1]*CELL_SIZE, reyPos[0]*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);

        for (let [af, ac] of estadoJaqueVisual.atacantes) {
            ctx.fillStyle = 'rgba(255,140,0,0.55)';
            ctx.fillRect(ac*CELL_SIZE, af*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
        }
    }

    // Fin de partida: rey perdedor en gris (jaque mate) o ambos reyes en verde (tablas/ahogado)
    if (typeof casillaFinJuego !== 'undefined' && casillaFinJuego) {
        ctx.fillStyle = 'rgba(120,120,120,0.75)';
        ctx.fillRect(casillaFinJuego.c*CELL_SIZE, casillaFinJuego.f*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
    }
    if (typeof casillasFinJuego !== 'undefined' && casillasFinJuego.length > 0) {
        ctx.fillStyle = 'rgba(60,200,90,0.6)';
        for (let cas of casillasFinJuego) {
            ctx.fillRect(cas.c*CELL_SIZE, cas.f*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
        }
    }

    if (!animando && !(typeof juegoTerminado !== 'undefined' && juegoTerminado)) {
        for (let mov of posiblesMovimientos) {
            let f, c;
            if (mov.hasOwnProperty('f')) { f = mov.f; c = mov.c; }
            else { f = mov[0]; c = mov[1]; }
            let x = c*CELL_SIZE, y = f*CELL_SIZE;
            let cx = x + CELL_SIZE/2, cy = y + CELL_SIZE/2;
            const esEnroque = mov.tipoMov === 'enroque';
            ctx.fillStyle = esEnroque ? 'rgba(128,0,128,0.45)' : 'rgba(255,215,0,0.32)';
            ctx.fillRect(x, y, CELL_SIZE-1, CELL_SIZE-1);
            // Punto/anillo central, como en ajedrez online, además del tinte de casilla
            ctx.beginPath();
            ctx.fillStyle = esEnroque ? 'rgba(190,80,190,0.85)' : 'rgba(255,215,0,0.75)';
            ctx.arc(cx, cy, CELL_SIZE * (board[f][c] ? 0.34 : 0.13), 0, 2*Math.PI);
            if (board[f][c]) { ctx.lineWidth = 4; ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); }
            else ctx.fill();
        }
        if (modoRuta && rutasAlternativas.length > 0) {
            // Vista previa completa de las rutas: antes solo aparecía una
            // casilla azul con un número y era difícil saber por dónde pasaría
            // realmente la pieza en una cadena larga.
            rutasAlternativas.forEach((ruta, idx) => {
                if (!selectedPiece || !Array.isArray(ruta.pasos)) return;
                const tono = (210 + idx * 47) % 360;
                const destacada = (typeof rutaPrevisualizadaIndice !== 'undefined' && rutaPrevisualizadaIndice === idx);
                ctx.save();
                ctx.strokeStyle = `hsla(${tono},78%,${destacada ? 75 : 66}%,${destacada ? 0.98 : 0.48})`;
                ctx.lineWidth = Math.max(destacada ? 4 : 2, CELL_SIZE * (destacada ? 0.075 : 0.045));
                ctx.setLineDash(destacada ? [] : [CELL_SIZE * 0.16, CELL_SIZE * 0.10]);
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(selectedPiece.col * CELL_SIZE + CELL_SIZE/2, selectedPiece.fila * CELL_SIZE + CELL_SIZE/2);
                for (const paso of ruta.pasos) {
                    if (!Array.isArray(paso.to)) continue;
                    ctx.lineTo(paso.to[1] * CELL_SIZE + CELL_SIZE/2, paso.to[0] * CELL_SIZE + CELL_SIZE/2);
                }
                ctx.stroke();
                ctx.restore();
            });
            for (let ruta of rutasAlternativas) {
                if (!Array.isArray(ruta.inter)) continue;
                let [fInter, cInter] = ruta.inter;
                ctx.fillStyle = 'rgba(0,100,200,0.5)';
                ctx.fillRect(cInter*CELL_SIZE, fInter*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.font = `bold ${Math.max(12, CELL_SIZE*0.24)}px sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(String(ruta.indiceRuta || ''), cInter*CELL_SIZE + CELL_SIZE/2, fInter*CELL_SIZE + CELL_SIZE/2);
            }
            let [df, dc] = destinoRuta;
            ctx.strokeStyle = '#FFFF00'; ctx.lineWidth = 3;
            ctx.strokeRect(dc*CELL_SIZE, df*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
        }
    }
}

// Dibuja una pieza con aspecto de ficha de madera tallada. Como todas las
// fichas del tablero usan el mismo tamaño, guardamos sprites por tipo/equipo/
// selección/orientación. Durante una animación esto evita crear docenas de
// gradientes radiales y sombras en cada frame.
const cacheSpritesPiezas = new Map();

function dibujarPiezaTallada(ctxDestino, cx, cy, radio, pieza, estaSeleccionada) {
    if (!pieza) return;
    const radioNormal = CELL_SIZE * 0.4;
    const gradosCanvas = (typeof canvas !== 'undefined' && canvas.dataset)
        ? parseInt(canvas.dataset.rotacion || '0', 10)
        : 0;

    // Fuera del tamaño normal conservamos el dibujo directo por seguridad.
    if (Math.abs(radio - radioNormal) > 0.01 || typeof document === 'undefined') {
        dibujarPiezaTalladaDirecta(ctxDestino, cx, cy, radio, pieza, estaSeleccionada, gradosCanvas);
        return;
    }

    const ratio = (typeof PIXEL_RATIO !== 'undefined') ? PIXEL_RATIO : 1;
    const clave = `${pieza.tipo}|${pieza.jugador}|${estaSeleccionada ? 1 : 0}|${gradosCanvas}|${ratio}`;
    let sprite = cacheSpritesPiezas.get(clave);
    if (!sprite) {
        const margen = 12;
        const tamLogico = CELL_SIZE + margen * 2;
        sprite = document.createElement('canvas');
        sprite.width = Math.round(tamLogico * ratio);
        sprite.height = Math.round(tamLogico * ratio);
        sprite._tamLogico = tamLogico;
        const sctx = sprite.getContext('2d');
        sctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        dibujarPiezaTalladaDirecta(sctx, tamLogico / 2, tamLogico / 2, radioNormal, pieza, estaSeleccionada, gradosCanvas);
        cacheSpritesPiezas.set(clave, sprite);
    }
    const tamLogico = sprite._tamLogico || CELL_SIZE + 24;
    ctxDestino.drawImage(sprite, 0, 0, sprite.width, sprite.height, cx - tamLogico / 2, cy - tamLogico / 2, tamLogico, tamLogico);
}

function dibujarPiezaTalladaDirecta(ctx, cx, cy, radio, pieza, estaSeleccionada, gradosCanvas = 0) {
    ctx.save();

    // Sombra proyectada (da volumen, como si la ficha estuviera sobre el tablero)
    ctx.beginPath();
    ctx.ellipse(cx + radio*0.08, cy + radio*0.18, radio*0.95, radio*0.85, 0, 0, 2*Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    // Cuerpo de la ficha: gradiente radial color marfil/hueso con calidez de madera clara
    const gradCuerpo = ctx.createRadialGradient(cx - radio*0.3, cy - radio*0.35, radio*0.1, cx, cy, radio*1.05);
    gradCuerpo.addColorStop(0, '#fbf3e2');
    gradCuerpo.addColorStop(0.55, '#ecdcb8');
    gradCuerpo.addColorStop(1, '#cdb086');
    ctx.beginPath(); ctx.arc(cx, cy, radio, 0, 2*Math.PI);
    ctx.fillStyle = gradCuerpo; ctx.fill();

    // Anillo de equipo (rojo/azul) grabado, con un trazo interior más oscuro para dar relieve
    ctx.lineWidth = radio * 0.13;
    ctx.strokeStyle = colorBordeEquipo[pieza.jugador];
    ctx.beginPath(); ctx.arc(cx, cy, radio - ctx.lineWidth/2, 0, 2*Math.PI); ctx.stroke();
    ctx.lineWidth = radio * 0.04;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(cx, cy, radio - radio*0.13 - 1, 0, 2*Math.PI); ctx.stroke();

    // Símbolo de la pieza (siempre dibujo vectorial, sin imágenes externas)
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.font = `bold ${radio*0.78}px Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (gradosCanvas !== 0) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-gradosCanvas * Math.PI / 180);
        ctx.fillText(SIMBOLO_PIEZA[pieza.tipo] || pieza.tipo, 0, radio*0.04);
        ctx.restore();
    } else {
        ctx.fillText(SIMBOLO_PIEZA[pieza.tipo] || pieza.tipo, cx, cy + radio*0.04);
    }

    // Brillo superior (highlight) para dar aspecto pulido/tallado
    const gradBrillo = ctx.createRadialGradient(cx - radio*0.35, cy - radio*0.45, 0, cx - radio*0.35, cy - radio*0.45, radio*0.7);
    gradBrillo.addColorStop(0, 'rgba(255,255,255,0.35)');
    gradBrillo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath(); ctx.arc(cx, cy, radio, 0, 2*Math.PI);
    ctx.fillStyle = gradBrillo; ctx.fill();

    if (estaSeleccionada) {
        ctx.lineWidth = radio * 0.16;
        ctx.strokeStyle = 'rgba(255,221,68,0.95)';
        ctx.shadowColor = 'rgba(255,221,68,0.8)';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(cx, cy, radio + 2, 0, 2*Math.PI); ctx.stroke();
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

// Símbolos tipográficos elegantes (estilo piezas de ajedrez), dibujo vectorial
// siempre usado para representar cada pieza (sin imágenes externas).
const SIMBOLO_PIEZA = {
    F0: '\u265C', // torre
    F1: '\u265F', // peón
    F2: '\u265E', // caballo
    F3: '\u265B', // reina/dama
    F4: '\u2726', // trampero -> estrella
    F5: '\u265D', // alfil
    F6: '\u265A'  // rey
};
