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
