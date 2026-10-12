---
name: mejorar-publicaciones-ml
description: Auditar y mejorar publicaciones de Mercado Libre (título, precio, stock, calidad). Usar cuando el usuario diga "mejorar mis publicaciones", "por qué no vendo", "auditar publicaciones", "optimizar títulos", "qué publicaciones están mal", "esta publicación tiene visitas pero no vende" o "subir/bajar precio" de un ítem.
---

# Mejorar publicaciones

## Objetivo
Detectar qué publicaciones pierden ventas, priorizarlas por impacto y proponer cambios exactos (título, precio, stock, estado). Aplicar solo lo que el usuario confirme ítem por ítem, y solo si el propietario habilitó la escritura.

## Flujo
1. Llamar `ml_auditar_publicaciones(cuenta?, limite=50, estado="active")`. Agrupar por semáforo (rojo, ámbar, verde) y guardar los arreglos concretos que devuelve la herramienta.
2. Para las publicaciones en rojo y ámbar, llamar `ml_visitas(cuenta?, item_id, dias=30)` y cruzar con ventas (`ml_publicacion` devuelve vendidos). Clasificar:
   - Muchas visitas y pocas ventas: problema de conversión (precio, fotos, descripción, reputación, envío).
   - Pocas visitas: problema de alcance (título, categoría, atributos, sin publicidad).
   - Sin stock o pausada: problema operativo.
3. Para cada ítem priorizado, llamar `ml_publicacion(cuenta?, item_id, incluir_descripcion=true)` y, si hay competencia directa, `ml_precio_catalogo(cuenta?, item_id)` para saber si está en catálogo y qué precio gana la buy box.
4. Antes de proponer cambios de precio, llamar `ml_comisiones(cuenta?, precio, categoria?)` con el precio propuesto. Si el usuario compartió costo, usar `ml_rentabilidad(cuenta?, item_id, precio, costo, impuestos_pct?)`. Nunca inventar costo ni impuestos: pedirlos.
5. Presentar la tabla de propuestas (ver formato). Cada fila debe tener el valor actual y el valor propuesto exacto.
6. Si el usuario aprueba una fila, verificar `ml_estado()` y aplicar con `ml_actualizar_publicacion(cuenta?, item_id, precio?, stock?, estado?, variacion_id?, confirmar=true)`, un ítem por llamada, mostrando antes qué se va a cambiar y esperando el "sí" de ese ítem. Los cambios de título no se aplican con esta herramienta: entregarlos al usuario para que los edite en Mercado Libre.
7. Cerrar con una lista de lo aplicado, lo pendiente de edición manual y una fecha sugerida para volver a medir (`ml_visitas` a los 14 días).

## Reglas de títulos para Mercado Libre
- Estructura: Producto + Marca + Modelo + atributo clave (color, medida, capacidad). Ejemplo: "Auriculares Bluetooth Sony WH-CH520 Inalámbricos Negro".
- Máximo 60 caracteres; contar antes de proponer.
- Sin "oferta", "envío gratis", "promoción", "liquidación", "el mejor", ni signos de exclamación: Mercado Libre lo penaliza y lo muestra por su cuenta cuando aplica.
- Sin mayúsculas sostenidas; capitalizar solo la primera letra de cada palabra relevante.
- No repetir palabras ni incluir el nombre de la tienda, códigos internos o datos de contacto.
- El título no debe contradecir la ficha técnica (si dice "Negro", el atributo color debe ser Negro).

## Formato de salida
```
Auditoría: <n> rojas | <n> ámbar | <n> verdes  (cuenta <alias>)

| Prioridad | Item | Título actual | Diagnóstico | Cambio propuesto | Valor actual → nuevo |
| 1 | MLA123 | ... | 820 visitas / 1 venta: conversión | precio | $12.500 → $11.200 (margen est. x %) |
| 2 | MLA456 | ... | 15 visitas en 30 días: alcance | título | "..." → "..." (58 caracteres) |

Indicar qué filas aplicar. Los títulos se editan manualmente en Mercado Libre.
```

## Reglas
- Nunca inventar datos: visitas, ventas, precios y problemas salen de las herramientas; no estimar márgenes sin costo real del usuario.
- No proponer bajar precio por debajo del costo más comisiones; si no se conoce el costo, decirlo.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. No aplicar cambios masivos con una sola confirmación.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo; entregar la tabla para que el usuario aplique los cambios a mano.
- Pausar (`estado="paused"`) solo si el usuario lo pide de forma expresa; nunca como "mejora" automática.
