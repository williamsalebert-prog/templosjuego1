console.log("✅ cache.js cargado");

// ============================================================================
// CACHÉ LOCAL DE PARTIDAS (últimas 5)
// ============================================================================
// Guarda en localStorage un snapshot completo de la partida tras cada jugada,
// para poder seguir donde se quedó si:
//   - se recarga la página por accidente,
//   - se cae la conexión (corta o larga) en una partida online,
//   - se cierra el navegador sin haber exportado.
// Solo se guarda automáticamente fuera de Modo Prueba (en Prueba se exporta/
// importa a mano, como se pidió).
//
// No requiere servidor ni cuenta: vive enteramente en el navegador del
// jugador. Si se borran los datos del sitio o se cambia de navegador/
// dispositivo, el caché no estará disponible (limitación de localStorage).
// ============================================================================

const CACHE_KEY = 'templos_partidas_cache_v1';
const CACHE_MAX_PARTIDAS = 5;

function _leerCachePartidas() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        const datos = raw ? JSON.parse(raw) : [];
        return Array.isArray(datos) ? datos : [];
    } catch (e) {
        return [];
    }
}

function _guardarCachePartidas(lista) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(lista));
        return true;
    } catch (e) {
        // localStorage lleno o bloqueado (modo privado, etc.): no es crítico,
        // el juego sigue funcionando, solo no habrá recuperación posible.
        return false;
    }
}

// Identificador estable de "esta partida" durante toda su duración, para
// poder actualizar el mismo registro en el caché en vez de crear uno nuevo
// en cada jugada. Se genera una vez al cargar tablero.html.
function _idPartidaActual() {
    if (!window._idPartidaActualCache) {
        window._idPartidaActualCache = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }
    return window._idPartidaActualCache;
}

// Guarda/actualiza el snapshot de la partida actual en el caché de las
// últimas 5. Se llama tras cada jugada real (ver finjuego.js).
function guardarPartidaEnCache() {
    if (CONFIG_JUEGO.modoPrueba) return; // Prueba usa export/import manual, no caché automático
    if (typeof estadoCompletoActual !== 'function') return;

    const snapshot = {
        id: _idPartidaActual(),
        fecha: Date.now(),
        modo: CONFIG_JUEGO.modo,
        online: !!CONFIG_JUEGO.online,
        sala: CONFIG_JUEGO.online ? (new URLSearchParams(window.location.search).get('sala') || null) : null,
        onlineSoyJugador: CONFIG_JUEGO.onlineSoyJugador,
        dificultad: CONFIG_JUEGO.dificultad,
        timer: CONFIG_JUEGO.timer,
        timerMode: CONFIG_JUEGO.timerMode,
        urlParams: window.location.search,
        estado: estadoCompletoActual()
    };

    let lista = _leerCachePartidas();
    lista = lista.filter(p => p.id !== snapshot.id); // reemplaza el registro de esta misma partida
    lista.unshift(snapshot); // la más reciente primero
    if (lista.length > CACHE_MAX_PARTIDAS) lista = lista.slice(0, CACHE_MAX_PARTIDAS);
    _guardarCachePartidas(lista);
}

// Marca la partida actual como terminada: ya no tiene sentido ofrecer
// "continuar" una partida que llegó a su fin con normalidad.
function quitarPartidaActualDelCache() {
    let lista = _leerCachePartidas();
    lista = lista.filter(p => p.id !== _idPartidaActual());
    _guardarCachePartidas(lista);
}

// Busca en el caché la partida más reciente que coincida con esta sala
// online (para recuperar tras una desconexión/recarga en esa sala concreta).
function buscarPartidaEnCachePorSala(sala) {
    if (!sala) return null;
    const lista = _leerCachePartidas();
    return lista.find(p => p.online && p.sala === sala) || null;
}

// Devuelve el snapshot más reciente de todo el caché (independientemente del
// modo), usado para el aviso genérico de "tenías una partida sin terminar".
function obtenerUltimaPartidaEnCache() {
    const lista = _leerCachePartidas();
    return lista.length > 0 ? lista[0] : null;
}

function listarPartidasEnCache() {
    return _leerCachePartidas();
}
