# Templos

## Qué es

Templos es un juego de mesa de estrategia para dos jugadores, inspirado en el ajedrez pero con piezas y reglas propias. Se juega en un tablero de 15 columnas por 10 filas, con una zona de "templo" en cada extremo (izquierda y derecha). El objetivo es dar **jaque mate** al rey rival, igual que en el ajedrez clásico.

## Cómo se juega

- Cada jugador controla un ejército de piezas (peones, torres, caballos, alfiles, un trampero, una reina y un rey) ubicado en su lado del tablero, frente a su templo.
- Las piezas se mueven por turnos. Algunas piezas avanzan paso a paso; otras pueden encadenar saltos sobre piezas propias o rivales en un mismo turno.
- Si un peón llega al templo del rival, **corona**: se convierte en torre, caballo, alfil, trampero o reina, a elección del jugador.
- El **rey** nunca puede moverse a una casilla donde quedaría capturado. Si está en esa situación y no tiene ninguna jugada legal para evitarlo, es **jaque mate** y termina la partida.
- Si al jugador en turno no le queda ninguna jugada legal pero su rey no está en jaque, la partida termina en **tablas** (ahogado).
- También se puede pactar tablas o rendirse en cualquier momento desde el menú del tablero.

### Modos de juego

- **1 Jugador**: contra la IA del juego, en tres niveles de dificultad (Fácil, Medio, Difícil).
- **2 Jugadores (mismo dispositivo)**: para jugar por turnos compartiendo pantalla.
- **2 Jugadores (otro dispositivo)**: partida en línea entre dos navegadores, usando un código de sala (sin necesidad de cuentas ni servidores propios).
- **Modo Prueba**: pensado para practicar, probar el juego y revisar partidas jugada por jugada (incluye deshacer/rehacer y un panel de análisis con reproducción automática).

### Temporizadores disponibles

Bala, Blitz 5, Blitz 3+2, Rápido A, Rápido B, Clásico y modo Infinito (solo cronómetro, sin límite de tiempo).

## Versión

### v0.1 — Primera versión funcional

- Tablero, piezas y reglas completas (movimiento, capturas, jaque, jaque mate, ahogado, enroque, coronación).
- Modo 1 Jugador con IA propia (minimax con poda alfa-beta, corre en segundo plano sin bloquear la pantalla) que adapta cuánto tiempo "piensa" según la dificultad elegida y el tipo de temporizador de la partida.
- Modo 2 Jugadores en el mismo dispositivo, con tablero que se reorienta automáticamente en pantallas de celular.
- Modo en línea (2 jugadores en distintos dispositivos) mediante código de sala, con:
  - Elección de color y tipo de partida a cargo de quien crea la sala; quien se une puede confirmar o sortear el color con una moneda.
  - Recuperación automática de la partida si se recarga la página o se pierde la conexión brevemente (se guarda un respaldo local de las últimas partidas).
  - Sincronización de animaciones y sonidos entre ambos jugadores.
- Modo Prueba con deshacer/rehacer ilimitado, importación y exportación de partidas, y un panel de análisis (jugada por jugada o reproducción automática a distintas velocidades).
- Exportación de partidas a un archivo, con toda la información necesaria para continuarlas más adelante (posición, relojes, turno, tipo de partida).
- Música y efectos de sonido generados con Web Audio (sin archivos de audio externos), con vibración táctil en dispositivos móviles.
