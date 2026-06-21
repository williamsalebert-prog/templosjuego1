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

const imagenesPiezas = {};
const colorBordeEquipo = ['#8B0000', '#00008B'];

// --- Estado de fin de partida (jaque mate / ahogado) ---
let casillaFinJuego = null;    // { f, c } -> se pinta gris (rey perdedor en jaque mate)
let casillasFinJuego = [];     // [{f,c}, {f,c}] -> se pintan verdes (ambos reyes en tablas)

// --- Contador de jugadas ---
let contadorJugadas = 0;

// --- Configuración de partida (leída de la URL al iniciar) ---
const parametrosURL = new URLSearchParams(window.location.search);
const CONFIG_JUEGO = {
    modo: parametrosURL.get('mode') === '1' ? 1 : 2,           // 1 = vs IA, 2 = 2 jugadores
    dificultad: parseInt(parametrosURL.get('diff') || '1', 10),
    timer: parametrosURL.get('timer') === '1'
};
