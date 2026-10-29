# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JS vanilla + Canvas. Sin dependencias, sin build, sin tests, sin linter. Idioma de UI y README: español.

## Ejecutar

- `open index.html`, o servidor estático: `python3 -m http.server 8000`
- Verificación = jugar en el navegador (no hay suite de tests).

## Arquitectura

Tres archivos: `index.html` (DOM + 2 canvas: `#board` 300x600, `#next-canvas` 120x120), `style.css`, `game.js` (toda la lógica, script clásico, `'use strict'`).

`game.js` usa estado global mutable (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) declarado en una línea y reinicializado en `init()`. Puntos clave:

- **Tablero**: matriz `ROWS x COLS` de índices de color (0 = vacío). Los índices 1–7 de `PIECES` y `COLORS` son paralelos (el valor de cada celda de la pieza es su propio índice de color).
- **Flujo de pieza**: `spawn()` (current = next, genera nueva next, `endGame()` si colisiona) → mover/rotar con `collide(shape, ox, oy)` → `lockPiece()` = `merge()` + `clearLines()` + `spawn()`.
- **Game loop**: `loop(ts)` con `requestAnimationFrame`; acumula `dropAccum` hasta `dropInterval` para caída por gravedad. `init`, `togglePause` y `endGame` gestionan `animId` con `cancelAnimationFrame`; mantener ese patrón para evitar loops duplicados.
- **Rotación**: `rotateCW` + wall kicks simples en `tryRotate` (offsets horizontales `[0,-1,1,-2,2]`).
- **Puntuación/nivel**: `LINE_SCORES[cleared] * level`; nivel = `floor(lines/10)+1`; `dropInterval = max(100, 1000 - (level-1)*90)` (se recalcula en `clearLines`). Soft drop +1/celda, hard drop +2/celda.
- **Render**: `draw()` repinta todo cada frame (grid, tablero, ghost con alpha 0.2, pieza actual); `drawNext()` solo al hacer `spawn()`. HUD vía `updateHUD()` escribiendo en `#score/#lines/#level`.
- **Input**: un único listener `keydown` (flechas, X rotar, Space hard drop, P pausa). El overlay (`#overlay`) sirve para pausa y game over; el botón `#restart-btn` llama a `init`.
