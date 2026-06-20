console.log("✅ dibujo.js cargado");

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

    let reyPos = obtenerPosicionRey(turno);
    if (reyPos && esJaque(turno)) {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
        ctx.fillRect(reyPos[1]*CELL_SIZE, reyPos[0]*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
    }

    if (!animando) {
        if (selectedPiece && piezasAmenazadas.length > 0 &&
            !['F2','F4'].includes(board[selectedPiece.fila][selectedPiece.col]?.tipo)) {
            for (let [af, ac] of piezasAmenazadas) {
                ctx.fillStyle = 'rgba(255,165,0,0.45)';
                ctx.fillRect(ac*CELL_SIZE, af*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
            }
        }
        for (let mov of posiblesMovimientos) {
            let f, c;
            if (mov.hasOwnProperty('f')) { f = mov.f; c = mov.c; }
            else { f = mov[0]; c = mov[1]; }
            if (mov.tipoMov === 'enroque') ctx.fillStyle = 'rgba(128,0,128,0.5)';
            else ctx.fillStyle = 'rgba(255,215,0,0.5)';
            ctx.fillRect(c*CELL_SIZE, f*CELL_SIZE, CELL_SIZE-1, CELL_SIZE-1);
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
