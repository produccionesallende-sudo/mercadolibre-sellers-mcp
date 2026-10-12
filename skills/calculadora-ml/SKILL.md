---
name: calculadora-ml
description: Calcular comisiones, costos de envío y rentabilidad real de un producto en Mercado Libre. Usar cuando el usuario pregunte "cuánto me queda", "cuánto cobra Mercado Libre", "a qué precio tengo que vender", "me conviene publicar esto", "calcular margen", "comisión de esta categoría" o "cuánto gano por venta".
---

# Calculadora de rentabilidad

## Objetivo
Llevar al usuario, con preguntas simples, desde un precio o un costo hasta la ganancia neta por unidad, mostrando cada descuento (comisión, envío, impuestos, publicidad) por separado.

## Flujo
1. Identificar el caso: (a) producto ya publicado (`item_id`), (b) producto nuevo con título o categoría, (c) precio hipotético. Si falta el dato de arranque, preguntar.
2. Reunir los datos pidiéndolos de a uno y en este orden, sin inventar ninguno:
   - Precio de venta (o precio objetivo si todavía no decide).
   - Costo del producto puesto en depósito (compra + flete de importación si aplica).
   - Porcentaje de impuestos que el usuario quiere descontar (IVA, ingresos brutos, monotributo, según su situación). Si no sabe, dejarlo en 0 y advertirlo.
   - Si el vendedor absorbe envío: costo estimado del envío o peso en gramos.
   - Tipo de publicación (clásica o premium) y logística (propio, Mercado Envíos, Full) si el producto no está publicado.
3. Si es un ítem publicado: llamar `ml_rentabilidad(cuenta?, item_id, precio?, costo, impuestos_pct?, costo_envio?, dias_ads?)`. Incluye comisión real de la categoría y, si hay campañas, el gasto en ads del período.
4. Si es un producto nuevo: predecir la categoría con `ml_categorias(cuenta?, titulo)` y luego `ml_comisiones(cuenta?, precio, categoria, sitio?, tipo_publicacion?, logistica?, peso_gramos?)`. Con la comisión y el envío devueltos, armar el desglose.
5. Mostrar el desglose completo (ver formato) y el precio mínimo para no perder (costo + comisión + envío + impuestos) y el precio necesario para el margen que el usuario quiera (preguntarle el porcentaje objetivo).
6. Ofrecer comparar escenarios: clásica vs. premium, con o sin envío gratis, dos o tres precios distintos. Cada escenario es una nueva llamada a `ml_comisiones` o `ml_rentabilidad`.

## Formato de salida
```
Producto: <título o descripción> — categoría <id/nombre> — <sitio>

Precio de venta           $ 25.000
- Comisión ML (<n> %)      -$ 3.250
- Costo fijo por unidad    -$   800   (si aplica por precio bajo)
- Envío a cargo del vendedor -$ 2.100
- Impuestos (<n> %)        -$ 1.500
- Publicidad (promedio)    -$   600   (solo si hay datos de ads)
= Ingreso neto             $ 16.750
- Costo del producto       -$ 10.000
= GANANCIA POR UNIDAD      $  6.750  (27 % sobre precio / 67 % sobre costo)

Precio mínimo sin pérdida: $<x>
Precio para margen objetivo <n> %: $<x>
```

## Reglas
- Nunca inventar datos: comisiones y costos de envío salen de `ml_comisiones` o `ml_rentabilidad`; costo, impuestos y margen objetivo los da el usuario. Si no los da, mostrar el cálculo parcial y decir qué falta.
- Aclarar siempre que los impuestos dependen de la situación fiscal del usuario y que el cálculo no reemplaza a un contador.
- Mostrar la moneda y el sitio que devuelve la herramienta; no convertir divisas.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Este skill no modifica precios; si el usuario quiere aplicar uno, derivar a mejorar-publicaciones-ml.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo.
