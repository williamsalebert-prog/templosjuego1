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

function dibujarTablero() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < FILAS; i++) {
        for (let j = 0; j < COLUMNAS; j++) {
            let x = j * CELL_SIZE, y = i * CELL_SIZE;
            if (esNoJugable(i, j)) {
                // Zona no jugable: madera oscura lisa, no negro plano
                ctx.fillStyle = '#120c08'; ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
                continue;
            }
            let zona = getZona(i, j);
            let par = (i + j) % 2 === 0;
            let color = zona === 'vacio' ? colores.vacio.par : (par ? colores[zona].par : colores[zona].impar);
            dibujarVetaMadera(ctx, x, y, CELL_SIZE - 1, CELL_SIZE - 1, color, i * 31 + j * 17 + 1);

            // Biselado sutil (luz arriba-izquierda, sombra abajo-derecha) para dar
            // sensación de talla en madera en vez de casillas planas
            ctx.strokeStyle = 'rgba(255,235,200,0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, y + CELL_SIZE - 1); ctx.lineTo(x, y); ctx.lineTo(x + CELL_SIZE - 1, y); ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath(); ctx.moveTo(x + CELL_SIZE - 1, y); ctx.lineTo(x + CELL_SIZE - 1, y + CELL_SIZE - 1); ctx.lineTo(x, y + CELL_SIZE - 1); ctx.stroke();
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
    let enJaqueAhora = reyPos && esJaque(turno);
    if (enJaqueAhora) {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
        ctx.fillRect(reyPos[1]*CELL_SIZE, reyPos[0]*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);

        // Resaltar de naranja la(s) pieza(s) que están dando jaque
        if (typeof obtenerPiezasQueDanJaque === 'function') {
            let atacantes = obtenerPiezasQueDanJaque(turno);
            for (let [af, ac] of atacantes) {
                ctx.fillStyle = 'rgba(255,140,0,0.55)';
                ctx.fillRect(ac*CELL_SIZE, af*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
            }
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

// Dibuja una pieza con aspecto de ficha de madera tallada: gradiente radial,
// sombra proyectada, anillo de equipo grabado y resalte si está seleccionada.
function dibujarPiezaTallada(ctx, cx, cy, radio, pieza, estaSeleccionada) {
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
    // Si el canvas está rotado visualmente (móvil en horizontal), el
    // símbolo se contra-rota para que el jugador siempre lo vea "derecho"
    // en su pantalla, en vez de tumbado de costado.
    const gradosCanvas = (typeof canvas !== 'undefined' && canvas.dataset) ? parseInt(canvas.dataset.rotacion || '0', 10) : 0;
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
