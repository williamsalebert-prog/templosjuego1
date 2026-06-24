console.log("✅ elo.js cargado");

// ============================================================================
// SISTEMA DE PUNTAJE (estilo ELO, adaptado a Templos)
// ============================================================================
// Cada jugador local tiene un puntaje que sube o baja según el resultado de
// sus partidas (igual que el ELO de ajedrez), guardado en localStorage. Solo
// aplica a partidas "reales" con resultado claro: 2 Jugadores (mismo o
// distinto dispositivo) y partidas contra la IA. El Modo Prueba no afecta el
// puntaje (es para practicar, no para competir).
//
// Al no haber cuentas de usuario, el puntaje se guarda por NAVEGADOR: cada
// dispositivo/navegador lleva su propio historial. En partidas de 2
// jugadores en el mismo dispositivo, cada "color" tiene su propio puntaje
// guardado por separado (como si fueran dos perfiles locales).
// ============================================================================

const ELO_KEY = 'templos_elo_v1';
const ELO_INICIAL = 1000;
const ELO_K_FACTOR = 24; // qué tan rápido sube/baja el puntaje por partida

// Puntaje fijo de referencia para cada nivel de IA, para poder calcular el
// cambio de ELO del humano al jugar contra ella (la IA no acumula puntaje
// propio, solo sirve como "rival de referencia").
const ELO_REFERENCIA_IA = { 1: 800, 2: 1100, 3: 1500 };

function _leerEloDatos() {
    try {
        const raw = localStorage.getItem(ELO_KEY);
        const datos = raw ? JSON.parse(raw) : null;
        return datos || { rojo: ELO_INICIAL, azul: ELO_INICIAL, historial: [] };
    } catch (e) {
        return { rojo: ELO_INICIAL, azul: ELO_INICIAL, historial: [] };
    }
}
function _guardarEloDatos(datos) {
    try { localStorage.setItem(ELO_KEY, JSON.stringify(datos)); } catch (e) {}
}

function obtenerEloActual() {
    const d = _leerEloDatos();
    return { rojo: d.rojo, azul: d.azul };
}

// Fórmula estándar de ELO: probabilidad esperada de ganar según la
// diferencia de puntaje, y ajuste proporcional al resultado real.
function _probabilidadEsperada(eloPropio, eloRival) {
    return 1 / (1 + Math.pow(10, (eloRival - eloPropio) / 400));
}

// resultado: 1 = victoria, 0.5 = tablas, 0 = derrota (desde el punto de vista
// del color indicado).
function _calcularNuevoElo(eloPropio, eloRival, resultado) {
    const esperado = _probabilidadEsperada(eloPropio, eloRival);
    return Math.round(eloPropio + ELO_K_FACTOR * (resultado - esperado));
}

// Registra el resultado de una partida terminada y actualiza el puntaje.
// ganador: 0 (rojo) | 1 (azul) | null (tablas)
function registrarResultadoElo(ganador) {
    if (CONFIG_JUEGO.modoPrueba) return null; // Prueba no cuenta para el puntaje

    const datos = _leerEloDatos();
    let eloRojoAntes = datos.rojo;
    let eloAzulAntes = datos.azul;
    let eloRivalAzul = eloAzulAntes;

    // Contra la IA, el "rival" tiene un puntaje fijo de referencia según la
    // dificultad, en vez de un puntaje azul que vaya cambiando con el tiempo.
    if (CONFIG_JUEGO.modo === 1) {
        eloRivalAzul = ELO_REFERENCIA_IA[CONFIG_JUEGO.dificultad] || ELO_REFERENCIA_IA[1];
    }

    const resultadoRojo = ganador === 0 ? 1 : (ganador === 1 ? 0 : 0.5);
    const resultadoAzul = 1 - resultadoRojo;

    const nuevoRojo = _calcularNuevoElo(eloRojoAntes, eloRivalAzul, resultadoRojo);
    // Si es vs IA, no se guarda un "nuevo azul" real (la IA no acumula
    // puntaje); si es 2 jugadores, sí se actualiza el azul también.
    const nuevoAzul = (CONFIG_JUEGO.modo === 1) ? eloAzulAntes : _calcularNuevoElo(eloAzulAntes, eloRojoAntes, resultadoAzul);

    datos.rojo = nuevoRojo;
    datos.azul = nuevoAzul;
    datos.historial = datos.historial || [];
    datos.historial.unshift({
        fecha: Date.now(),
        modo: CONFIG_JUEGO.modo === 1 ? 'vs_ia' : 'dos_jugadores',
        dificultadIA: CONFIG_JUEGO.modo === 1 ? CONFIG_JUEGO.dificultad : null,
        ganador,
        eloRojoAntes, eloRojoDespues: nuevoRojo,
        eloAzulAntes, eloAzulDespues: nuevoAzul
    });
    if (datos.historial.length > 50) datos.historial = datos.historial.slice(0, 50);
    _guardarEloDatos(datos);

    return {
        rojo: { antes: eloRojoAntes, despues: nuevoRojo, diferencia: nuevoRojo - eloRojoAntes },
        azul: { antes: eloAzulAntes, despues: nuevoAzul, diferencia: nuevoAzul - eloAzulAntes }
    };
}

// Texto corto para mostrar en el banner de fin de partida, ej: "+8 ELO" / "-6 ELO"
function textoCambioElo(cambioElo, color) {
    if (!cambioElo || !cambioElo[color]) return '';
    const diff = cambioElo[color].diferencia;
    if (diff === 0) return '';
    return diff > 0 ? ` (+${diff} ELO)` : ` (${diff} ELO)`;
}
