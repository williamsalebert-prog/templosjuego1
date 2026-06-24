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
        version: 2,
        // Marca de origen: evita que un archivo de Modo Prueba se abra en una
        // partida normal (mezclaría reglas distintas), aunque al revés sí se
        // permite (el Modo Prueba puede abrir partidas normales para practicar).
        modoPrueba: !!CONFIG_JUEGO.modoPrueba,

        turno,
        enroqueRealizado: [...enroqueRealizado],
        board: serializarBoard(board),
        carcela: carcela.obtenerTodas().map(p => ({ tipo: p.tipo, jugador: p.jugador })),
        contadorJugadas,
        jugadasPorJugador: [...jugadasPorJugador],
        juegoTerminado,
        historialPila: historial.pila.map(serializarEstadoHistorial),
        historialFuturos: historial.futuros.map(serializarEstadoHistorial),

        // Notación de jugadas estilo ajedrez (ver js/notacion.js), tanto en
        // lista como en texto ya formateado, para quien quiera leerla fuera
        // del propio juego.
        notacion: (typeof listaNotacionPartida !== 'undefined') ? [...listaNotacionPartida] : [],
        notacionTexto: (typeof notacionCompletaComoTexto === 'function') ? notacionCompletaComoTexto() : '',

        // --- Metadatos de partida pedidos: contadores/relojes de ambos
        // jugadores, quién tiene el turno, tipo de temporizador usado, y si la
        // partida es contra la máquina o entre dos jugadores (mismo o distinto
        // dispositivo) ---
        metadatos: {
            turnoActual: turno,
            tipoModo: CONFIG_JUEGO.modo === 1 ? 'vs_maquina' : 'dos_jugadores',
            dificultadIA: CONFIG_JUEGO.modo === 1 ? CONFIG_JUEGO.dificultad : null,
            dispositivo: CONFIG_JUEGO.online ? 'distinto_dispositivo' : 'mismo_dispositivo',
            timerActivo: !!CONFIG_JUEGO.timer,
            timerMode: CONFIG_JUEGO.timerMode,
            timerNombre: (MODOS_TIEMPO[CONFIG_JUEGO.timerMode] || {}).nombre || null,
            tiempoRestante: (typeof tiempoRestante !== 'undefined') ? [...tiempoRestante] : null,
            cronometro: (typeof cronometro !== 'undefined') ? [...cronometro] : null
        }
    };
    const blob = new Blob([JSON.stringify(datos)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const prefijo = CONFIG_JUEGO.modoPrueba ? 'prueba_templos_' : 'partida_templos_';
    a.download = `${prefijo}${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function importarPartida(archivo) {
    if (!archivo) return; // Sin archivo seleccionado (diálogo cancelado): no tocar nada, seguir como estaba.
    const lector = new FileReader();
    lector.onload = (e) => {
        try {
            const datos = JSON.parse(e.target.result);
            if (!datos || !Array.isArray(datos.board)) throw new Error('Formato inválido');

            // Un archivo guardado en Modo Prueba NO se puede abrir en una partida
            // normal (mezclaría el Ctrl+Z/Ctrl+Y y el contador infinito con reglas
            // que no aplican fuera de Prueba). Al revés sí se permite: el Modo
            // Prueba puede importar partidas normales para practicar con ellas.
            if (datos.modoPrueba && !CONFIG_JUEGO.modoPrueba) {
                alert('Este archivo se exportó desde el Modo Prueba y solo puede abrirse ahí.');
                return; // El tablero actual no se modifica.
            }

            // Construimos primero TODO el nuevo estado en variables temporales y
            // solo si nada falla lo aplicamos de golpe. Así, si el archivo está
            // corrupto a medio camino, la partida en curso queda intacta en vez
            // de quedar a medio reemplazar (lo que antes podía dejar el tablero
            // vacío o en un estado inconsistente).
            const nuevoBoard = deserializarBoard(datos.board);
            const nuevoTurno = datos.turno || 0;
            const nuevoEnroque = datos.enroqueRealizado || [false, false];
            const nuevaCarcelaDatos = datos.carcela || [];
            const nuevoContadorJugadas = datos.contadorJugadas || 0;
            const nuevoJugadasPorJugador = datos.jugadasPorJugador || [0, 0];
            const nuevaHistorialPila = (datos.historialPila || []).map(deserializarEstadoHistorial);
            const nuevaHistorialFuturos = (datos.historialFuturos || []).map(deserializarEstadoHistorial);
            const meta = datos.metadatos || null;

            // A partir de aquí ya no puede fallar: aplicamos todo.
            board = nuevoBoard;
            turno = nuevoTurno;
            enroqueRealizado = nuevoEnroque;

            carcela.limpiar();
            nuevaCarcelaDatos.forEach(c => {
                const Clase = piezasRegistradas.get(c.tipo);
                if (Clase) carcela.agregar(new Clase(c.jugador));
            });

            contadorJugadas = nuevoContadorJugadas;
            jugadasPorJugador = nuevoJugadasPorJugador;

            historial.pila = nuevaHistorialPila;
            historial.futuros = nuevaHistorialFuturos;

            if (typeof reiniciarNotacionPartida === 'function') {
                reiniciarNotacionPartida(datos.notacion || []);
            }

            // Restaurar relojes/cronómetro si el archivo los trae (partidas con
            // temporizador activo guardan cuánto tiempo le quedaba a cada uno).
            if (meta) {
                if (meta.tiempoRestante && typeof tiempoRestante !== 'undefined') tiempoRestante = meta.tiempoRestante;
                if (meta.cronometro && typeof cronometro !== 'undefined') cronometro = meta.cronometro;
                if (typeof pintarRelojes === 'function') pintarRelojes();
            }

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
            alert('No se pudo importar la partida: el archivo no es válido. La partida actual no se modificó.');
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
