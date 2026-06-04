<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Templos - Juego</title>
    <style>
        body { background: #1a472a; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: 'Segoe UI', sans-serif; margin: 0; }
        .game-container { background: #2c5e2e; padding: 20px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; }
        canvas { display: block; margin: 0 auto; box-shadow: 0 0 0 4px #c9a87b, 0 0 0 8px #6b3e1c; border-radius: 8px; cursor: pointer; }
        .info { margin-top: 15px; color: #f9e0a0; background: #2d2b1fcc; padding: 8px; border-radius: 16px; font-size: 0.9rem; }
        .turno { font-weight: bold; background: #c99e3a; color: #1e2a0e; display: inline-block; padding: 4px 12px; border-radius: 20px; margin-top: 10px; }
        .boton-deshacer { margin-top: 15px; padding: 8px 20px; font-size: 1rem; font-weight: bold; background: #c9a87b; color: #1e2a0e; border: none; border-radius: 20px; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
        .boton-deshacer:hover { background: #dbb87c; }
        .boton-deshacer:disabled { background: #888; color: #ccc; cursor: not-allowed; }
    </style>
</head>
<body>
<div class="game-container">
    <canvas id="tableroCanvas" width="1150" height="750"></canvas>
    <div class="info">
        <div>🔴 Jugador 1 (Rojo)  |  🔵 Jugador 2 (Azul)</div>
        <div class="turno" id="turnoTexto">Turno: Jugador 1</div>
        <div>✅ Mover 1 casilla o saltar sobre pieza adyacente. ⚔️ Saltar sobre enemiga = captura.<br>
        Tras un salto solo se pueden encadenar más saltos. Movimiento solo en zonas jugables.</div>
    </div>
    <button id="btnDeshacer" class="boton-deshacer" disabled>↩️ Deshacer movimiento</button>
</div>

<script src="js/zonas.js"></script>
<script src="js/pieza.js"></script>
<!-- Piezas -->
<script src="js/f1.js"></script>
<script src="js/f2.js"></script>
<script src="js/f3.js"></script>
<script src="js/f4.js"></script>
<script src="js/f5.js"></script>
<script src="js/f6.js"></script>
<!-- Sistema -->
<script src="js/carcela.js"></script>
<script src="js/historial.js"></script>
<script src="js/tablero.js"></script>
</body>
</html>
