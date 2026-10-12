---
name: vigilancia-ml
description: Armar y revisar la lista de vigilancia de competidores, publicaciones, búsquedas y tendencias en Mercado Libre. Usar cuando el usuario diga "vigilar a este vendedor", "avisame si cambia el precio", "qué novedades hay de la competencia", "armar lista de seguimiento", "revisión semanal de competencia" o "dejar de vigilar".
---

# Vigilancia de competencia

## Objetivo
Mantener una lista de referencias a vigilar (vendedores, publicaciones, búsquedas, tendencias) y convertir las novedades en una revisión semanal corta con acciones concretas.

## Flujo
### Construir la lista
1. Llamar `ml_vigilar(cuenta?, accion="listar")` para ver qué ya se sigue y evitar duplicados.
2. Proponer qué vigilar según el negocio: los 2 o 3 competidores directos (`tipo="vendedor"`), las publicaciones rivales de los productos que más facturan (`tipo="publicacion"`), las búsquedas que usan los compradores (`tipo="busqueda"`) y la categoría principal (`tipo="tendencias"`). Para elegir candidatos usar `ml_buscar` y `ml_panel_ventas`.
3. Por cada referencia aprobada por el usuario, llamar `ml_vigilar(cuenta?, accion="agregar", tipo, ref, nota)`. La nota debe explicar por qué se vigila ("rival directo en fundas", "mi producto estrella").
4. Para quitar: `ml_vigilar(cuenta?, accion="quitar", tipo, ref)`, siempre a pedido del usuario.

### Revisión semanal
5. Llamar `ml_novedades_competencia(cuenta?)`. Clasificar cada novedad: baja de precio, suba de precio, sin stock, publicación nueva, cambio de posición, tendencia nueva.
6. Para las novedades relevantes, llamar `ml_historial_competencia(ref)` y describir la evolución (por ejemplo, tres bajas de precio en dos semanas).
7. Cruzar con el ítem propio afectado: `ml_precio_catalogo(cuenta?, item_id)` si está en catálogo y `ml_rentabilidad` antes de sugerir cualquier reacción de precio (pedir costo, nunca inventarlo).
8. Entregar el resumen y proponer acciones; aplicar cambios solo vía mejorar-publicaciones-ml con confirmación.

## Formato de salida
Lista:
```
Vigilando (<n> referencias) — cuenta <alias>
| Tipo | Referencia | Nota | Desde |
```
Revisión semanal:
```
NOVEDADES DE LA SEMANA
- [Precio ↓] <vendedor/publicación>: $<x> → $<y> (<-n %>). Afecta a <mi ítem>. Historial: ...
- [Sin stock] <publicación rival>: oportunidad para <mi ítem>.
- [Nuevo] <vendedor> publicó <título>.
- [Tendencia] "<búsqueda>" subió en <categoría>.

Acciones sugeridas (máximo 3):
1. ...
```

## Rutina sugerida
- Lunes: `ml_novedades_competencia` + `ml_historial_competencia` de lo que cambió.
- Cada 15 días: revisar la lista, quitar referencias que ya no importan, agregar rivales nuevos detectados con `ml_buscar`.
- Mensual: comparar la posición propia en las búsquedas vigiladas.

## Reglas
- Nunca inventar datos: si no hay novedades, decir "sin cambios registrados" en vez de rellenar.
- La vigilancia es local al MCP; no afirmar que Mercado Libre enviará alertas.
- Agregar o quitar referencias solo con acuerdo del usuario en la conversación.
- Escrituras sobre publicaciones solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Este skill no modifica publicaciones.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo.
