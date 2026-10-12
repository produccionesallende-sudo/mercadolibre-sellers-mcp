# Plantillas de imágenes para publicaciones

Plantillas SVG de 1200 × 1200 px para armar las fotos secundarias de una publicación
(beneficio, características, medidas y qué incluye). Se completan con un JSON de datos
usando el script `generar.js`, sin instalar dependencias.

## Uso rápido

```bash
node plantillas/generar.js --plantilla beneficio --datos datos.json --salida foto-2.svg --foto producto.png
```

Opciones:

| Opción        | Obligatoria | Descripción                                                                 |
|---------------|-------------|-----------------------------------------------------------------------------|
| `--plantilla` | sí          | Una de: `beneficio`, `caracteristicas`, `medidas`, `incluye`.               |
| `--datos`     | sí          | Archivo JSON con los campos a reemplazar.                                   |
| `--salida`    | sí          | Ruta del SVG a generar.                                                     |
| `--foto`      | no          | Imagen `png`, `jpg`, `jpeg` o `webp` que se incrusta dentro del SVG.        |
| `--forzar`    | no          | Permite sobreescribir el archivo de salida si ya existe.                    |

Comportamiento:

- Cada marcador `{{CAMPO}}` de la plantilla se reemplaza por el valor del JSON.
  Los caracteres especiales (`&`, `<`, `>`, comillas) se escapan automáticamente.
- Si falta un campo, el script avisa por stderr y lo deja vacío.
- Con `--foto`, la imagen se incrusta como `data:` URI en el elemento `<image id="foto">`,
  así el SVG resultante es autocontenido.
- Nunca sobreescribe un archivo existente salvo que pases `--forzar`.
- Solo acepta nombres de plantilla de la lista permitida.

Los textos en SVG **no hacen salto de línea automático**: mantené cada campo corto
(ver los largos sugeridos en cada plantilla) o el texto se saldrá del cuadro.

## Plantillas y campos

### `beneficio` — un beneficio principal, foto a la derecha

| Campo          | Qué es                                | Largo sugerido  |
|----------------|---------------------------------------|-----------------|
| `TITULO`       | Nombre corto del producto (en gris)   | hasta 24 letras |
| `BENEFICIO`    | Frase principal, grande               | hasta 14 letras |
| `DETALLE`      | Aclaración o segundo argumento        | hasta 26 letras |

### `caracteristicas` — cuatro puntos numerados, foto a la izquierda

| Campo                  | Qué es                 | Largo sugerido  |
|------------------------|------------------------|-----------------|
| `TITULO`               | Título de la lámina    | hasta 18 letras |
| `CAR1` … `CAR4`        | Una característica cada uno | hasta 22 letras |

### `medidas` — foto al centro con flechas de cota

| Campo          | Qué es                                | Largo sugerido  |
|----------------|---------------------------------------|-----------------|
| `TITULO`       | Nombre del producto                   | hasta 30 letras |
| `ALTO`         | Por ejemplo `45 cm`                   | hasta 10 letras |
| `ANCHO`        | Por ejemplo `30 cm`                   | hasta 12 letras |
| `PROFUNDIDAD`  | Por ejemplo `18 cm`                   | hasta 10 letras |
| `PESO`         | Por ejemplo `1,2 kg`                  | hasta 10 letras |

### `incluye` — seis ítems con tilde en grilla de 2 × 3, sin foto

| Campo              | Qué es                       | Largo sugerido  |
|--------------------|------------------------------|-----------------|
| `TITULO`           | Nombre del producto          | hasta 30 letras |
| `INC1` … `INC6`    | Un elemento incluido cada uno | hasta 18 letras |

Si tenés menos de seis ítems, dejá los restantes como cadena vacía (`""`): quedará el
recuadro con la tilde pero sin texto. Si preferís, borrá ese recuadro del SVG resultante.

## Ejemplo de `datos.json`

Podés poner todos los campos de todas las plantillas en un mismo archivo; cada plantilla
usa solo los que necesita.

```json
{
  "TITULO": "Mochila urbana 25 L",
  "BENEFICIO": "Impermeable",
  "DETALLE": "Protege tu notebook bajo la lluvia",
  "CAR1": "Puerto USB externo",
  "CAR2": "Bolsillo antirrobo",
  "CAR3": "Tela resistente",
  "CAR4": "Espalda acolchada",
  "ALTO": "45 cm",
  "ANCHO": "30 cm",
  "PROFUNDIDAD": "18 cm",
  "PESO": "0,9 kg",
  "INC1": "Mochila",
  "INC2": "Cable USB",
  "INC3": "Funda de lluvia",
  "INC4": "Llavero",
  "INC5": "Manual",
  "INC6": "Garantía escrita"
}
```

Y luego:

```bash
node plantillas/generar.js --plantilla beneficio       --datos datos.json --salida foto-2.svg --foto producto.png
node plantillas/generar.js --plantilla caracteristicas --datos datos.json --salida foto-3.svg --foto producto.png
node plantillas/generar.js --plantilla medidas         --datos datos.json --salida foto-4.svg --foto producto.png
node plantillas/generar.js --plantilla incluye         --datos datos.json --salida foto-5.svg
```

## Convertir el SVG a PNG o JPG

Mercado Libre acepta JPG, PNG, GIF y WEBP, no SVG. Alguna de estas opciones:

**Inkscape (línea de comandos)**

```bash
inkscape foto-2.svg --export-type=png --export-width=1200 --export-height=1200 --export-filename=foto-2.png
```

**ImageMagick**

```bash
magick -density 150 -background white foto-2.svg -resize 1200x1200 foto-2.png
```

(En versiones viejas el comando es `convert` en lugar de `magick`.)

**Sin instalar nada**

1. Abrí el SVG en Chrome, Edge o Firefox (doble clic sobre el archivo).
2. Hacé clic derecho sobre la imagen y elegí "Guardar imagen como…", o tomá una captura
   a pantalla completa y recortala a 1200 × 1200.
3. También podés abrirlo en Figma, Canva, Photopea o Illustrator y exportar como PNG.

Verificá que la imagen final quede en 1200 × 1200 px y pese menos de 10 MB.

## Reglas de Mercado Libre para las fotos

Resumen de lo que suele rechazarse o penalizarse. Revisá siempre las políticas vigentes
en el Centro de vendedores, porque cambian.

- **La primera foto** debe ser una foto real del producto, tomada por vos, sobre
  **fondo blanco puro**, sin texto, logos, marcas de agua, bordes ni marcos.
  Estas plantillas son para las fotos **secundarias** (segunda en adelante).
- **Sin datos de contacto**: nada de teléfonos, WhatsApp, correos, direcciones, redes
  sociales ni sitios web, en ninguna foto.
- **Sin precios ni promociones**: no incluyas "oferta", "descuento", "envío gratis",
  "cuotas", "liquidación", porcentajes ni importes. Esa información la gestiona la
  propia publicación.
- **Sin referencias a otras plataformas** ni a venta fuera de Mercado Libre.
- Usá solo fotos y textos propios o con permiso de uso; no copies imágenes de otras
  publicaciones ni de catálogos de terceros.
- Mostrá el producto tal cual es: no agregues accesorios que no se incluyen.
- Tamaño recomendado: cuadrada, mínimo 1200 × 1200 px, buena iluminación y nitidez.
- El producto debe ocupar la mayor parte del encuadre, legible desde el celular.

Si una foto incumple estas reglas la publicación puede quedar con menor exposición,
pausada o moderada.
