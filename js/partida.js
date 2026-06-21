console.log("✅ partida.js cargado");

function serializarBoard(tab) {
    return tab.map(fila => fila.map(c => c ? { tipo: c.tipo, jugador: c.jugador } : null));
}

function deserializarBoard(data) {
    return data.map(fila => fila.map(c => {
        if (!c) return null;
        const Clase = piezasRegistradas.get(c.tipo);
        return Clase ? new Clase(c.jugador) : null;
    }));
}

function serializarEstadoHistorial(estado) {
    return {
        board: serializarBoard(estado.board),
        turno: estado.turno,
        enroqueRealizado: [...estado.enroqueRealizado]
    };
}

function deserializarEstadoHistorial(estado) {
    return {
        board: deserializarBoard(estado.board),
        turno: estado.turno,
        enroqueRealizado: estado.enroqueRealizado || [false, false]
    };
}

function exportarPartida() {
    const datos = {
        version: 1,
        turno,
        enroqueRealizado: [...enroqueRealizado],
        board: serializarBoard(board),
        carcela: carcela.obtenerTodas().map(p => ({ tipo: p.tipo, jugador: p.jugador })),
        contadorJugadas,
        juegoTerminado,
        historialPila: historial.pila.map(serializarEstadoHistorial),
        historialFuturos: historial.futuros.map(serializarEstadoHistorial)
    };
    const blob = new Blob([JSON.stringify(datos)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partida_templos_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function importarPartida(archivo) {
    const lector = new FileReader();
    lector.onload = (e) => {
        try {
            const datos = JSON.parse(e.target.result);
            if (!datos || !Array.isArray(datos.board)) throw new Error('Formato inválido');

            board = deserializarBoard(datos.board);
            turno = datos.turno || 0;
            enroqueRealizado = datos.enroqueRealizado || [false, false];

            carcela.limpiar();
            (datos.carcela || []).forEach(c => {
                const Clase = piezasRegistradas.get(c.tipo);
                if (Clase) carcela.agregar(new Clase(c.jugador));
            });

            contadorJugadas = datos.contadorJugadas || 0;

            historial.pila = (datos.historialPila || []).map(deserializarEstadoHistorial);
            historial.futuros = (datos.historialFuturos || []).map(deserializarEstadoHistorial);

            selectedPiece = null; posiblesMovimientos = []; caminosDestino = {}; piezasAmenazadas = [];
            modoRuta = false; rutasAlternativas = []; destinoRuta = null;
            coronacionPendiente = null;
            if (typeof menuCoronacion !== 'undefined' && menuCoronacion) menuCoronacion.style.display = 'none';

            reiniciarFinJuego();
            // Si la partida importada ya estaba en jaque mate / tablas, lo recalculamos
            // en vez de fiarnos solo del flag guardado, para que sea coherente con las reglas actuales.
            if (esJaqueMate(turno)) { juegoTerminado = true; mostrarFinJuego('jaquemate', turno); }
            else if (esAhogado(turno)) { juegoTerminado = true; mostrarFinJuego('tablas', turno); }

            actualizarInterfaz();
            dibujarTablero();
        } catch (err) {
            alert('No se pudo importar la partida: el archivo no es válido.');
        }
    };
    lector.readAsText(archivo);
}

function configurarBotonesPartida() {
    const btnExportar = document.getElementById('btnExportarPartida');
    const btnImportar = document.getElementById('btnImportarPartida');
    const inputImportar = document.getElementById('inputImportarPartida');
    if (btnExportar) btnExportar.addEventListener('click', exportarPartida);
    if (btnImportar && inputImportar) {
        btnImportar.addEventListener('click', () => inputImportar.click());
        inputImportar.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) importarPartida(e.target.files[0]);
            e.target.value = '';
        });
    }
}
configurarBotonesPartida();
