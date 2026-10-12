---
name: reporte-ventas-ml
description: Reporte ejecutivo de ventas en Mercado Libre por día, semana o mes. Usar cuando el usuario pida "reporte de ventas", "informe semanal", "cómo cerró el mes", "comparar con el período anterior", "resumen para el contador/socio" o cualquier balance formal con cifras y tendencias.
---

# Reporte ejecutivo de ventas

## Objetivo
Entregar un informe ordenado y comparable (período actual vs. anterior) con facturación, unidades, productos destacados, logística, pendientes urgentes y recomendaciones, listo para compartir con un socio o contador.

## Flujo
1. Definir el período: día (`dias=1`), semana (`dias=7`) o mes (`dias=30`). Si el usuario no lo dice, preguntar. Definir la cuenta: si hay varias y se pide consolidado, usar `cuenta="todas"` donde la herramienta lo admita.
2. Llamar `ml_metricas(cuenta?|"todas", dias)`. Tomar facturación, cantidad de ventas, ticket promedio y la variación contra el período anterior.
3. Llamar `ml_panel_ventas(cuenta?, muestra_envios=true)` para el top de productos, mezcla de métodos de envío y provincias.
4. Llamar `ml_ordenes(cuenta?, dias, limite=50)`. Contar órdenes por estado (pagadas, enviadas, entregadas, canceladas) y detectar envíos demorados o reclamos.
5. Llamar `ml_preguntas(cuenta?, estado="UNANSWERED", limite=20)`. Toda pregunta sin responder va en la sección URGENTE con antigüedad.
6. Opcional si el usuario lo pide: `ml_reputacion(cuenta?)` para incluir nivel, reclamos y demoras.
7. Redactar el reporte con el formato de abajo. Las recomendaciones deben salir de los datos (por ejemplo, un producto que concentra más del 40 % de la facturación es un riesgo de dependencia).

## Formato de salida
```
REPORTE DE VENTAS — <cuenta> — <período> (<fecha inicio> a <fecha fin>)

1. Resumen
   Facturación: $<x> (<+/-n %> vs. período anterior)
   Ventas: <n> (<+/-n %>)   Ticket promedio: $<x>

2. Productos destacados
   | # | Producto | Unidades | Facturación | % del total |

3. Logística
   Métodos de envío: ...   Provincias principales: ...
   Órdenes por estado: pagadas <n> | enviadas <n> | entregadas <n> | canceladas <n>

4. URGENTE
   - <n> preguntas sin responder (la más antigua: <hs/días>)
   - Envíos demorados: ...

5. Recomendaciones (máximo 3, accionables)
```

## Reglas
- Nunca inventar datos: cada cifra debe corresponder a una respuesta de herramienta; si falta el período anterior, decir "sin comparación disponible".
- No mezclar monedas ni cuentas sin indicarlo explícitamente en el encabezado.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Este skill no escribe.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo.
- Si el usuario pide el reporte como archivo, generar Markdown o texto plano; no afirmar que se envió por correo o se guardó en ningún lado salvo que efectivamente se haya hecho con una herramienta.
