---
name: imagenes-ml
description: Armar el set de imágenes de venta de una publicación de Mercado Libre (de la foto 2 en adelante) con las plantillas del proyecto. Usar cuando el usuario diga "armar las imágenes de la publicación", "fotos con beneficios", "infografía del producto", "imagen de medidas", "qué incluye la caja", "mejorar las fotos" o pida material gráfico para un ítem.
---

# Imágenes de venta para publicaciones

## Objetivo
Producir un set fijo de 4 imágenes informativas (beneficio, características, medidas, incluye) a partir de datos reales de la publicación, usando las plantillas SVG del proyecto, y entregarlas listas para convertir a PNG y subir desde la foto 2 en adelante.

## División del trabajo
- Foto 1 (portada): la hace el vendedor. Producto sobre fondo blanco puro, sin texto, sin marcas de agua, ocupando la mayor parte del cuadro. Este skill no la genera.
- Fotos 2 a 5: las genera este skill con las plantillas. Luego pueden ir fotos de uso real, detalles y packaging.

## Flujo
1. Obtener los datos del producto: si está publicado, llamar `ml_publicacion(cuenta?, item_id, incluir_descripcion=true)` y extraer título, atributos (marca, modelo, medidas, peso, material, capacidad), descripción y la URL de la foto principal. Si es un producto nuevo, pedir los datos al usuario.
2. Completar lo que falte preguntando al usuario, nunca inventar: beneficio principal (una frase), 3 a 5 características, medidas exactas con unidad, lista de lo que incluye la caja.
3. Redactar los textos cortos para cada imagen y validarlos con el usuario antes de generar (los textos deben leerse en pantalla de celular: pocas palabras, tipografía grande).
4. Escribir un archivo `datos.json` por imagen con los campos de la plantilla (por ejemplo `titulo`, `subtitulo`, `items`, `medidas`, `imagen` con la URL o ruta de la foto del producto). Mostrar el JSON al usuario.
5. Generar cada SVG con el script del proyecto:
   `node plantillas/generar.js --plantilla <nombre> --datos datos.json --salida foto.svg`
   Nombres de plantilla del set fijo: `beneficio`, `caracteristicas`, `medidas`, `incluye`. El resultado es un SVG de 1200x1200.
6. Indicar cómo convertir a PNG con cualquier herramienta (navegador, Inkscape, ImageMagick, un conversor en línea): 1200x1200 píxeles, formato PNG o JPG, menos de 10 MB. El MCP no sube imágenes; el usuario las carga en la publicación desde Mercado Libre.
7. Sugerir el orden final de la galería y, si el ítem ya existe, recordar correr `ml_auditar_publicaciones` después de subirlas para verificar que la calidad mejoró.

## Set fijo de 4 imágenes
| Nº | Plantilla | Contenido |
| 2 | beneficio | Foto del producto + una frase de beneficio principal (qué problema resuelve) |
| 3 | caracteristicas | 3 a 5 características con ícono o viñeta, texto corto |
| 4 | medidas | Silueta o foto con cotas: alto, ancho, profundidad, peso, con unidades |
| 5 | incluye | Lista de lo que viene en la caja, cantidades exactas |

## Reglas de imágenes de Mercado Libre
- Sin datos de contacto: ni teléfono, ni correo, ni redes, ni sitio web, ni código QR.
- Sin "oferta", "envío gratis", "descuento", "promoción" ni precios: la plataforma los muestra por su cuenta y penaliza el texto en imágenes.
- Sin logos de otras marcas o sellos que no correspondan al producto; sin marcas de agua.
- Textos legibles en celular: tamaño grande, alto contraste, máximo 6 u 8 palabras por línea.
- La portada (foto 1) debe ser fondo blanco; las demás pueden tener fondo de color o contexto.
- Fotos y textos propios o con licencia; no reutilizar imágenes de competidores o fabricantes sin autorización.

## Formato de salida
```
Set de imágenes para <item_id> — <título>
- foto2-beneficio.svg  → "<frase>"
- foto3-caracteristicas.svg → <lista>
- foto4-medidas.svg → <medidas>
- foto5-incluye.svg → <lista>
Comandos ejecutados: ...
Siguiente paso: convertir a PNG 1200x1200 y subir en ese orden desde Mercado Libre.
```

## Reglas
- Nunca inventar datos: medidas, materiales, contenido de la caja y beneficios salen de `ml_publicacion` o del usuario. Si un dato no existe, dejar el campo vacío y avisar; no estimar.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Este skill no escribe en Mercado Libre; solo genera archivos locales.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo.
- No ejecutar el script sobre archivos que el usuario no haya revisado; mostrar el JSON antes de generar.
