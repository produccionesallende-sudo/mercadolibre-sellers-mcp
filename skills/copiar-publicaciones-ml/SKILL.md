---
name: copiar-publicaciones-ml
description: Clonar publicaciones propias entre cuentas propias o crear publicaciones nuevas en Mercado Libre. Usar cuando el usuario diga "copiar esta publicación a la otra cuenta", "duplicar mis publicaciones", "pasar el catálogo a la cuenta nueva", "crear una publicación nueva" o "publicar este producto".
---

# Copiar y crear publicaciones

## Objetivo
Replicar publicaciones del propio vendedor entre sus cuentas conectadas sin reescribir todo a mano, o crear publicaciones nuevas con categoría correcta, siempre con confirmación por ítem y escritura habilitada.

## Flujo
### Clonar entre cuentas propias
1. Llamar `ml_cuentas()` y confirmar con el usuario cuál es la cuenta origen y cuál la destino. Ambas deben aparecer conectadas; si falta una, derivar a setup-ml.
2. Listar candidatas en la cuenta origen: `ml_publicaciones(cuenta=<origen>, estado="active", limite=50)`. Dejar que el usuario elija por ID o título.
3. Por cada ítem elegido, llamar `ml_publicacion(cuenta=<origen>, item_id, incluir_descripcion=true)` y mostrar un resumen: título, precio, stock, categoría, condición, tipo, imágenes, atributos. Preguntar qué se cambia en el destino (precio, stock, título). Un título idéntico en dos cuentas propias es válido, pero conviene evitar competir contra sí mismo en la misma búsqueda.
4. Verificar `ml_estado()`. Si la escritura está habilitada, llamar `ml_crear_publicacion(cuenta=<destino>, copiar_de=<item_id origen>, precio?, stock?, titulo?, confirmar=true)`, un ítem por llamada, tras el "sí" explícito de ese ítem. Informar el nuevo `item_id` devuelto.
5. Al terminar, listar los IDs nuevos y sugerir revisar en el destino con `ml_auditar_publicaciones(cuenta=<destino>)`.

### Crear una publicación nueva
6. Reunir los datos con el usuario: título (aplicar reglas de mejorar-publicaciones-ml: Producto + Marca + Modelo + atributo, máximo 60 caracteres, sin "oferta"), precio, stock, condición (nuevo/usado), tipo (clásica/premium), moneda, descripción, URLs de imágenes propias y atributos obligatorios.
7. Llamar `ml_categorias(cuenta?, titulo=<título>)` para predecir la categoría; si devuelve varias, mostrar las opciones y que el usuario elija. Explorar la elegida con `ml_categorias(cuenta?, categoria=<id>)` para ver atributos requeridos.
8. Llamar `ml_comisiones(cuenta?, precio, categoria, tipo_publicacion)` para que el usuario conozca la comisión antes de publicar.
9. Mostrar la ficha completa, obtener el "sí" explícito y llamar `ml_crear_publicacion(cuenta?, titulo, precio, stock, categoria, descripcion, condicion, tipo, moneda, imagenes, atributos, confirmar=true)`.

## Formato de salida
```
Origen: <alias> → Destino: <alias>
| # | Item origen | Título | Precio | Stock | Cambios en destino | Resultado |
| 1 | MLA123 | ... | $<x> | <n> | precio $<y> | creado: MLA999 |
| 2 | MLA456 | ... | $<x> | <n> | — | pendiente de confirmación |
```

## Reglas
- Nunca inventar datos: categoría, atributos y comisiones salen de las herramientas; no completar atributos obligatorios con valores supuestos.
- NUNCA clonar fotos, descripciones ni títulos de publicaciones de terceros: es infracción de propiedad intelectual y Mercado Libre puede suspender la cuenta. `copiar_de` solo se usa con ítems de cuentas del propio usuario conectadas en el MCP. Si el usuario pasa un ID ajeno, explicarlo y ofrecer crear una publicación propia desde cero.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. No crear publicaciones en lote con una sola aprobación.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo; entregar la ficha lista para cargar a mano.
- Una publicación creada genera obligaciones (stock, envíos); advertir que empieza activa salvo que el usuario pida crearla pausada.
- Si la herramienta devuelve un error de atributos faltantes o categoría inválida, mostrar el mensaje textual, corregir con el usuario y volver a pedir confirmación antes de reintentar.
- Después de clonar, no asumir que las imágenes quedaron asociadas: verificar con `ml_publicacion(cuenta=<destino>, item_id=<nuevo>)`.
