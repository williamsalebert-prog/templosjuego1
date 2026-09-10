console.log("✅ elo.js cargado");

// ============================================================================
// ELO DEL PERFIL LOCAL — SOLO ONLINE JUGADOR VS JUGADOR
// ============================================================================
// El perfil vive en este navegador (perfil.js). IA, dos jugadores locales y
// Modo Prueba NO modifican ELO. En online ambos clientes intercambian nombre y
// ELO al conectarse; cada dispositivo actualiza únicamente su propio perfil.
// ============================================================================

const ELO_K_FACTOR = 24;
const ELO_RIVAL_POR_DEFECTO = 1000;

function _probabilidadEsperada(eloPropio, eloRival) {
    return 1 / (1 + Math.pow(10, (eloRival - eloPropio) / 400));
}

function _calcularNuevoElo(eloPropio, eloRival, resultado) {
    const esperado = _probabilidadEsperada(eloPropio, eloRival);
    return Math.round(eloPropio + ELO_K_FACTOR * (resultado - esperado));
}

function obtenerEloActual() {
    const p = (typeof obtenerPerfilLocalActivo === 'function') ? obtenerPerfilLocalActivo() : null;
    return p ? { perfil: p.elo, nombre: p.nombre } : null;
}

// ganador: 0 (rojo) | 1 (azul) | null (tablas)
function registrarResultadoElo(ganador) {
    if (!CONFIG_JUEGO.online || CONFIG_JUEGO.modo !== 2 || CONFIG_JUEGO.modoPrueba) return null;
    const perfil = (typeof obtenerPerfilLocalActivo === 'function') ? obtenerPerfilLocalActivo() : null;
    if (!perfil) return null;

    // Si el cliente remoto aún no ha enviado identidad/ELO, no inventamos un
    // resultado competitivo. Es preferible no puntuar esa partida a calcularla
    // contra un rival ficticio.
    const rival = window.perfilRivalOnline;
    if (!rival || !Number.isFinite(Number(rival.elo))) return null;

    const miColor = Number(CONFIG_JUEGO.onlineSoyJugador);
    const resultado = ganador === null ? 0.5 : (ganador === miColor ? 1 : 0);
    const eloAntes = Number.isFinite(Number(perfil.elo)) ? Number(perfil.elo) : ELO_RIVAL_POR_DEFECTO;
    const eloRival = Number(rival.elo);
    const eloDespues = _calcularNuevoElo(eloAntes, eloRival, resultado);
    const actualizado = (typeof actualizarEloPerfilLocal === 'function')
        ? actualizarEloPerfilLocal(perfil.id, eloDespues, resultado)
        : null;
    if (!actualizado) return null;

    return {
        local: {
            nombre: actualizado.nombre,
            antes: eloAntes,
            despues: actualizado.elo,
            diferencia: actualizado.elo - eloAntes,
            resultado
        },
        rival: { nombre: rival.nombre || 'Rival', elo: eloRival }
    };
}

function textoCambioElo(cambioElo) {
    if (!cambioElo || !cambioElo.local) return '';
    const diff = Number(cambioElo.local.diferencia) || 0;
    if (diff === 0) return ` · Tu ELO: ${cambioElo.local.despues}`;
    return ` · Tu ELO ${diff > 0 ? '+' : ''}${diff} → ${cambioElo.local.despues}`;
}
