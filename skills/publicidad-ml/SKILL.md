---
name: publicidad-ml
description: Evaluar Product Ads y promociones de Mercado Libre con criterio de rentabilidad. Usar cuando el usuario pregunte "cómo va la publicidad", "qué ACOS tengo", "me conviene esta promoción", "estoy perdiendo plata con los anuncios", "qué campañas apago", "aceptar promoción" o "revisar Product Ads".
---

# Publicidad y promociones

## Objetivo
Decir con números si cada campaña o promoción deja ganancia o la destruye, y aceptar promociones solo cuando el margen lo soporta, con confirmación del usuario y escritura habilitada.

## Flujo
### Product Ads
1. Llamar `ml_publicidad(cuenta?, dias=30)` para ver campañas: inversión, ventas atribuidas, ACOS y ROAS. Si el usuario señala un producto, llamar `ml_publicidad(cuenta?, item_id, dias=30)` para el grupo de anuncios del ítem.
2. Pedir al usuario el costo del producto y el porcentaje de impuestos (nunca inventarlos). Llamar `ml_rentabilidad(cuenta?, item_id, costo, impuestos_pct?, costo_envio?, dias_ads=30)` para obtener el margen real después de comisiones, envío y publicidad.
3. Aplicar la regla central: **si ACOS > margen, el producto se vende a pérdida con publicidad**. Comparar el ACOS de cada ítem con su margen antes de ads y clasificar: rentable (ACOS claramente menor), al límite (diferencia menor a 5 puntos) y a pérdida (ACOS mayor).
4. Proponer acciones por ítem: mantener, bajar presupuesto, pausar la campaña o mejorar la publicación antes de seguir invirtiendo (derivar a mejorar-publicaciones-ml). El MCP no modifica campañas: los cambios se hacen en el panel de Mercado Libre.

### Promociones
5. Llamar `ml_promociones(cuenta?, limite=30)` para listar promociones disponibles o activas (ofertas del día, campañas de Mercado Libre, descuentos cofinanciados). Para una en particular: `ml_promociones(cuenta?, promocion_id, tipo)`.
6. Por cada promoción candidata, calcular el precio final y correr `ml_rentabilidad(cuenta?, item_id, precio=<precio final>, costo, impuestos_pct?)`. Si el margen resultante es negativo o menor al que el usuario considera aceptable, recomendar no participar.
7. Si el usuario decide aceptar una, verificar `ml_estado()` y llamar `ml_aceptar_promocion(cuenta?, item_id, promocion_id, tipo, precio_final?, confirmar=true)`, una promoción por llamada, mostrando antes ítem, tipo, precio final y margen, y esperando el "sí" explícito.

## Formato de salida
```
PRODUCT ADS — últimos 30 días — cuenta <alias>
Inversión total $<x> | Ventas atribuidas $<x> | ACOS global <n> % | ROAS <n>

| Item | Título | Inversión | Ventas ads | ACOS | Margen sin ads | Veredicto |
| MLA123 | ... | $<x> | $<x> | 28 % | 22 % | A PÉRDIDA: pausar o reducir |
| MLA456 | ... | $<x> | $<x> | 9 % | 30 % | Rentable: mantener |

PROMOCIONES
| Promoción | Tipo | Item | Precio actual → final | Margen resultante | Recomendación |

Acciones propuestas: ...
```

## Reglas
- Nunca inventar datos: costo e impuestos los da el usuario; ACOS, ROAS e inversión salen de `ml_publicidad`. Si falta el costo, mostrar el ACOS pero marcar el veredicto como "pendiente de costo".
- No prometer resultados de campañas ni estimar ventas futuras.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Nunca aceptar promociones en lote.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo; indicar que la promoción puede aceptarse desde el panel de Mercado Libre.
- Una promoción aceptada no siempre se puede revertir de inmediato: advertirlo antes de confirmar.
