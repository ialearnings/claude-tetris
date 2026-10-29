# Instrucciones para agentes

## Antes de cambiar codigo

- Lee [CLAUDE.md](CLAUDE.md): convenciones, arquitectura y patrones que deben preservarse.
- Consulta [README.md](README.md) para ejecutar el juego, controles y ajustes de dimensiones del canvas.
- Conserva JavaScript vanilla y Canvas, sin dependencias ni build, salvo que la tarea requiera cambiarlos.
- Manten el idioma de la UI y del README en espanol, respetando el estilo existente.

## Verificacion de cambios

- No hay tests automatizados ni linter configurados; no inventes comandos de npm.
- Ejecuta el juego como indica el README y comprueba en navegador las mecanicas afectadas.
- Para cambios en la logica compartida, comprueba movimiento, rotacion junto a paredes, soft/hard drop, limpieza de lineas, puntuacion/nivel y vista previa.
- Comprueba pausa/reanudacion y reinicios repetidos: la gravedad no debe acelerarse por bucles de animacion duplicados.
- Para cambios visuales, comprueba tablero, HUD y overlays sin solapamientos ni recortes.
- Indica que comprobaciones realizaste y cuales quedaron pendientes; leer el codigo no sustituye jugar en navegador.