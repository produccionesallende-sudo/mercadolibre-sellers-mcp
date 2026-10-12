---
name: panel-ventas-ml
description: Vistazo diario del negocio en Mercado Libre. Usar cuando el usuario pregunte "cómo venimos", "cómo van las ventas hoy", "qué se vendió", "dame el panel", "resumen rápido de hoy" o inicie el día sin pedir un reporte formal.
---

# Panel de ventas diario

## Objetivo
Responder en menos de un minuto cómo va el día y el mes, qué productos empujan la facturación y si hay algo que atender ahora mismo.

## Flujo
1. Si hay varias cuentas y el usuario no indicó cuál, llamar `ml_cuentas()` y usar la predeterminada; mencionar cuál se está mostrando.
2. Llamar `ml_panel_ventas(cuenta?, muestra_envios=true)`. Extraer: facturación y cantidad de ventas de hoy, acumulado del mes, top de productos, métodos de envío y provincias.
3. Llamar `ml_ordenes(cuenta?, dias=1, limite=20)` para listar las ventas de hoy con comprador, producto, monto y estado de envío.
4. Llamar `ml_preguntas(cuenta?, estado="UNANSWERED", limite=10)`. Si hay pendientes, marcarlas como pendiente urgente: en Mercado Libre el tiempo de respuesta afecta la conversión.
5. Si el usuario pide comparar ("¿mejor que ayer?"), llamar `ml_metricas(cuenta?, dias=7)` y comparar el período con el anterior.
6. Cerrar con una acción sugerida concreta y, si corresponde, indicar qué skill la cubre (responder-preguntas-ml, mejorar-publicaciones-ml).

## Formato de salida
```
Cuenta: <alias>  |  <fecha>

HOY: $<x> en <n> ventas    MES: $<x> en <n> ventas
Top productos del mes:
 1. <título corto> — <n> unidades — $<x>
 2. ...
Envíos: <método> <n>% | <método> <n>%
Provincias: <prov> <n>% | <prov> <n>%

Ventas de hoy:
 - #<orden> <producto> $<x> — envío: <estado>

Pendientes: <n> preguntas sin responder (urgente)
Acción sugerida: <una línea>
```

## Reglas
- Nunca inventar datos: si una herramienta no devuelve un campo (por ejemplo provincias), omitir la línea en vez de estimar.
- No redondear de forma que cambie el sentido; mantener la moneda que devuelve el MCP.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Este skill es de solo lectura.
- Si el MCP responde que está en solo lectura al intentar cualquier cambio derivado, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo.
- Mantener la salida breve; si el usuario quiere profundidad, derivar a reporte-ventas-ml.
