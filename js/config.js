console.log("✅ config.js cargado");

let board = Array(FILAS).fill().map(() => Array(COLUMNAS).fill(null));
let turno = 0;
let selectedPiece = null;
let posiblesMovimientos = [];
let caminosDestino = {};
let piezasAmenazadas = [];

let modoRuta = false;
let rutasAlternativas = [];
let destinoRuta = null;

let enroqueRealizado = [false, false];


const colorBordeEquipo = ['#8B0000', '#00008B'];

// --- Estado de fin de partida (jaque mate / ahogado) ---
let casillaFinJuego = null;    // { f, c } -> se pinta gris (rey perdedor en jaque mate)
let casillasFinJuego = [];     // [{f,c}, {f,c}] -> se pintan verdes (ambos reyes en tablas)

// --- Contador de jugadas ---
let contadorJugadas = 0;
let jugadasPorJugador = [0, 0]; // cuántas jugadas ha completado cada jugador (para bono de jugada 40 en modo clásico)

// --- Modos de temporizador disponibles ---
// segundos: tiempo inicial por jugador (null = sin reloj, usa cronómetro ascendente)
// incremento: segundos que se suman al jugador DESPUÉS de cada jugada suya
// bonoJugada: { jugada, segundos } -> al llegar a esa jugada (de cada jugador) se añade un bono único
const MODOS_TIEMPO = {
    bala:      { nombre: 'Bala (1 min)',            segundos: 60,        incremento: 0,  bonoJugada: null },
    blitz5:    { nombre: 'Blitz 5 min',              segundos: 5 * 60,    incremento: 0,  bonoJugada: null },
    blitz32:   { nombre: 'Blitz 3+2',                segundos: 3 * 60,    incremento: 2,  bonoJugada: null },
    rapidoA:   { nombre: 'Rápido A (10+10)',         segundos: 10 * 60,   incremento: 10, bonoJugada: null },
    rapidoB:   { nombre: 'Rápido B (15+10)',         segundos: 15 * 60,   incremento: 10, bonoJugada: null },
    clasico:   { nombre: 'Clásico (90+30)',          segundos: 90 * 60,   incremento: 30, bonoJugada: { jugada: 40, segundos: 30 * 60 } },
    infinito:  { nombre: 'Infinito (cronómetro)',    segundos: null,      incremento: 0,  bonoJugada: null }
};

// --- Configuración de partida (leída de la URL al iniciar) ---
const parametrosURL = new URLSearchParams(window.location.search);
const CONFIG_JUEGO = {
    modo: parametrosURL.get('mode') === '1' ? 1 : 2,           // 1 = vs IA, 2 = 2 jugadores
    dificultad: parseInt(parametrosURL.get('diff') || '1', 10),
    timer: parametrosURL.get('timer') === '1',
    timerMode: MODOS_TIEMPO[parametrosURL.get('timerMode')] ? parametrosURL.get('timerMode') : 'blitz5',
    online: parametrosURL.get('online') === '1',
    onlineSoyJugador: parametrosURL.get('jugador') === '1' ? 1 : 0,
    // Modo Prueba: 2 jugadores, contador infinito, Ctrl+Z/Ctrl+Y habilitados,
    // y los archivos exportados quedan "marcados" para no mezclarse con
    // partidas normales (ver partida.js).
    modoPrueba: parametrosURL.get('prueba') === '1'
};
if (CONFIG_JUEGO.modoPrueba) {
    CONFIG_JUEGO.modo = 2;
    CONFIG_JUEGO.timer = true;
    CONFIG_JUEGO.timerMode = 'infinito';
    CONFIG_JUEGO.online = false;
}
