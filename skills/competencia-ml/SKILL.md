---
name: competencia-ml
description: Analizar competidores y posición de precio en Mercado Libre. Usar cuando el usuario pregunte "cómo estoy contra la competencia", "quién vende lo mismo", "a cuánto lo venden otros", "estoy ganando la buy box", "qué cambió la competencia" o antes de decidir una suba o baja de precio.
---

# Análisis de competencia

## Objetivo
Mostrar con datos reales dónde está cada producto frente a sus competidores (precio, posición en búsqueda, buy box de catálogo, reputación) y recomendar movimientos de precio solo después de verificar que siguen siendo rentables.

## Flujo
1. Definir el alcance: un ítem propio (`item_id`), una búsqueda ("fundas iphone 15") o un vendedor rival. Si el usuario no lo aclara, preguntar.
2. Si es un ítem propio, llamar `ml_publicacion(cuenta?, item_id)` para tener título, precio, tipo de publicación y vendidos. Luego `ml_precio_catalogo(cuenta?, item_id)`: indica si está en catálogo, si gana la buy box y qué precio haría falta para ganarla.
3. Llamar `ml_buscar(cuenta?, consulta=<título o palabras clave>, limite=20, orden?)` con la misma búsqueda que haría un comprador. Registrar posición del ítem propio, precios mínimo/mediana/máximo, vendedores con más ventas y si ofrecen envío gratis o Full.
4. Si el usuario señala un rival concreto, llamar `ml_buscar(cuenta?, vendedor=<id o nickname>, limite=30)` para ver su catálogo y rango de precios.
5. Llamar `ml_vigilar(cuenta?, accion="listar")`. Si el ítem, búsqueda o vendedor ya está vigilado, llamar `ml_novedades_competencia(cuenta?)` y `ml_historial_competencia(ref)` para ver cambios de precio o stock recientes. Si no está vigilado, ofrecer agregarlo (ver skill vigilancia-ml).
6. Antes de recomendar cualquier precio, llamar `ml_rentabilidad(cuenta?, item_id, precio=<propuesto>, costo, impuestos_pct?, costo_envio?)`. Pedir costo e impuestos al usuario si no los dio en la conversación; nunca inventarlos. Complementar con `ml_comisiones` si cambia el tipo de publicación.
7. Entregar el informe y, si el usuario quiere aplicar un precio, derivar a mejorar-publicaciones-ml (que usa `ml_actualizar_publicacion` con confirmación).

## Formato de salida
```
Producto: <título> (<item_id>) — precio actual $<x> — vendidos <n>
Catálogo: sí/no | Buy box: ganando / perdiendo frente a <vendedor> a $<x> | precio para ganar: $<x>

Búsqueda "<consulta>": tu posición #<n> de <total>
| Pos | Vendedor | Precio | Envío | Ventas | Reputación |
Rango de precios: mín $<x> | mediana $<x> | máx $<x>

Novedades vigiladas (últimos 7 días): ...

Recomendación:
- Precio sugerido $<x>: margen estimado <n> % (según costo informado $<x>)
- Riesgos: ...
```

## Reglas
- Nunca inventar datos: posiciones, precios y vendedores salen de `ml_buscar` y `ml_precio_catalogo`; si la búsqueda no encuentra el ítem propio, decirlo.
- No recomendar igualar o bajar el precio sin pasar por `ml_rentabilidad`; si el usuario no entrega costo, presentar el escenario como "sin verificar rentabilidad".
- No hacer afirmaciones sobre la estrategia interna de un competidor; solo describir lo observable.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Este skill no escribe sobre publicaciones; `ml_vigilar(agregar)` es una acción local que igual se confirma con el usuario.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo.
