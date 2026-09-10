console.log("✅ perfil.js cargado");

// ============================================================================
// PERFIL / SESIÓN LOCAL
// ============================================================================
// No es una cuenta de Internet: vive únicamente en este navegador. Sirve para
// que el jugador tenga una identidad estable y un ELO propio sin mezclarlo con
// colores, IA o partidas locales. El ELO solo se modifica en partidas online
// jugador contra jugador (ver elo.js).
// ============================================================================

const PERFIL_LOCAL_KEY = 'templos_perfiles_locales_v1';
const ELO_LOCAL_INICIAL = 1000;

function _leerPerfilesLocales() {
    try {
        const raw = localStorage.getItem(PERFIL_LOCAL_KEY);
        const data = raw ? JSON.parse(raw) : null;
        if (!data || !Array.isArray(data.perfiles)) return { activo: null, perfiles: [] };
        return { activo: data.activo || null, perfiles: data.perfiles.filter(Boolean) };
    } catch (e) {
        return { activo: null, perfiles: [] };
    }
}

function _guardarPerfilesLocales(data) {
    try {
        localStorage.setItem(PERFIL_LOCAL_KEY, JSON.stringify(data));
        return true;
    } catch (e) { return false; }
}

function _normalizarNombrePerfil(nombre) {
    return String(nombre || '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\p{L}\p{N} _.-]/gu, '')
        .slice(0, 20);
}

function listarPerfilesLocales() {
    return _leerPerfilesLocales().perfiles.map(p => ({ ...p }));
}

function obtenerPerfilLocalActivo() {
    const data = _leerPerfilesLocales();
    const perfil = data.perfiles.find(p => p.id === data.activo);
    return perfil ? { ...perfil } : null;
}

function crearOActivarPerfilLocal(nombre) {
    const limpio = _normalizarNombrePerfil(nombre);
    if (limpio.length < 2) return { ok: false, error: 'Usa un nombre de al menos 2 caracteres.' };

    const data = _leerPerfilesLocales();
    let perfil = data.perfiles.find(p => String(p.nombre || '').toLocaleLowerCase() === limpio.toLocaleLowerCase());
    const ahora = Date.now();
    if (!perfil) {
        perfil = {
            id: 'u_' + ahora.toString(36) + '_' + Math.random().toString(36).slice(2, 7),
            nombre: limpio,
            elo: ELO_LOCAL_INICIAL,
            partidasOnline: 0,
            victorias: 0,
            derrotas: 0,
            tablas: 0,
            creado: ahora,
            actualizado: ahora
        };
        data.perfiles.push(perfil);
    }
    data.activo = perfil.id;
    perfil.actualizado = ahora;
    if (!_guardarPerfilesLocales(data)) return { ok: false, error: 'El navegador no permitió guardar el perfil.' };
    return { ok: true, perfil: { ...perfil } };
}

function activarPerfilLocal(id) {
    const data = _leerPerfilesLocales();
    const perfil = data.perfiles.find(p => p.id === id);
    if (!perfil) return false;
    data.activo = perfil.id;
    perfil.actualizado = Date.now();
    return _guardarPerfilesLocales(data);
}

function cerrarSesionPerfilLocal() {
    const data = _leerPerfilesLocales();
    data.activo = null;
    return _guardarPerfilesLocales(data);
}

function actualizarEloPerfilLocal(id, nuevoElo, resultado = null) {
    const data = _leerPerfilesLocales();
    const perfil = data.perfiles.find(p => p.id === id);
    if (!perfil) return null;
    perfil.elo = Math.max(100, Math.round(Number(nuevoElo) || ELO_LOCAL_INICIAL));
    perfil.partidasOnline = Math.max(0, Number(perfil.partidasOnline) || 0) + 1;
    if (resultado === 1) perfil.victorias = (Number(perfil.victorias) || 0) + 1;
    else if (resultado === 0) perfil.derrotas = (Number(perfil.derrotas) || 0) + 1;
    else if (resultado === 0.5) perfil.tablas = (Number(perfil.tablas) || 0) + 1;
    perfil.actualizado = Date.now();
    if (!_guardarPerfilesLocales(data)) return null;
    return { ...perfil };
}

function datosPerfilParaOnline() {
    const p = obtenerPerfilLocalActivo();
    if (!p) return null;
    return {
        idSesion: p.id,
        nombre: p.nombre,
        elo: Number.isFinite(Number(p.elo)) ? Number(p.elo) : ELO_LOCAL_INICIAL,
        partidasOnline: Number(p.partidasOnline) || 0
    };
}

window.listarPerfilesLocales = listarPerfilesLocales;
window.obtenerPerfilLocalActivo = obtenerPerfilLocalActivo;
window.crearOActivarPerfilLocal = crearOActivarPerfilLocal;
window.activarPerfilLocal = activarPerfilLocal;
window.cerrarSesionPerfilLocal = cerrarSesionPerfilLocal;
window.actualizarEloPerfilLocal = actualizarEloPerfilLocal;
window.datosPerfilParaOnline = datosPerfilParaOnline;
