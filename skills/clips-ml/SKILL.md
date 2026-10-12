---
name: clips-ml
description: Gestionar clips (videos cortos) de publicaciones en Mercado Libre. Usar cuando el usuario diga "subir un video a la publicación", "qué clips tengo", "me rechazaron el clip", "requisitos del video", "borrar el clip", "qué publicaciones no tienen video" o "estado de moderación de clips".
---

# Clips de publicaciones

## Objetivo
Mostrar qué publicaciones tienen clip y en qué estado está, verificar que un video cumple los requisitos antes de subirlo, subirlo con confirmación y limpiar los rechazados.

## Flujo
1. Mapa general: llamar `ml_clips(cuenta?, limite=50)`. Devuelve qué publicaciones tienen clip, cuáles no y el estado de moderación de cada uno (pendiente, aprobado, rechazado). Para un ítem puntual: `ml_clips(cuenta?, item_id)`.
2. Priorizar: cruzar con `ml_panel_ventas(cuenta?)` o `ml_publicaciones(cuenta?, estado="active")` para sugerir primero los productos que más venden o más visitas tienen y aún no tienen clip.
3. Antes de subir, pedir al usuario el nombre del archivo y confirmar los requisitos técnicos (ver lista). Si no cumple alguno, indicar qué corregir (por ejemplo, recortar a 60 segundos o rotar a vertical) antes de intentar.
4. Verificar con `ml_publicacion(cuenta?, item_id)` que la publicación está activa; Mercado Libre no acepta clips en publicaciones pausadas o cerradas.
5. Recordar que el archivo debe estar copiado dentro de la carpeta de clips configurada en el MCP (`ML_DIRECTORIO_CLIPS`); `ml_estado()` muestra la ruta. La herramienta recibe solo el nombre del archivo, no una ruta completa.
6. Verificar `ml_estado()` para saber si la escritura está habilitada y llamar `ml_subir_clip(cuenta?, item_id, archivo=<nombre>, confirmar=true)`, un clip por llamada, tras el "sí" explícito del usuario para ese ítem.
7. Informar que la moderación tarda entre 24 y 48 horas. Programar con el usuario una nueva consulta a `ml_clips` para verificar el resultado.
8. Si un clip fue rechazado, mostrar el motivo que devuelve la herramienta, proponer el ajuste y, si el usuario lo pide, eliminarlo con `ml_borrar_clip(cuenta?, item_id, clip_uuid, confirmar=true)` antes de subir la versión corregida.

## Requisitos técnicos de Mercado Libre
- Formato MP4 o MOV.
- Orientación vertical 9:16; resolución mínima 360x640 (recomendado 1080x1920).
- Duración entre 10 y 61 segundos.
- Tamaño máximo 280 MB.
- La publicación debe estar activa.
- Contenido: el producto real, sin datos de contacto, sin precios ni "oferta/envío gratis", sin música con derechos de terceros, sin texto que tape el producto.
- Moderación: 24 a 48 horas; el clip no se ve hasta que se aprueba.

## Formato de salida
```
CLIPS — cuenta <alias>
| Item | Título | Clip | Estado | Motivo (si rechazado) |
| MLA123 | ... | sí | aprobado | — |
| MLA456 | ... | no | — | — |  ← prioridad: <n> ventas/mes

Sin clip y con más ventas: MLA456, MLA789
Rechazados a corregir: MLA321 (motivo: ...)
```
Tras subir: `Clip enviado para MLA456 (archivo <nombre>). Moderación estimada: 24-48 h.`

## Reglas
- Nunca inventar datos: estados y motivos de rechazo salen de `ml_clips`; no asegurar que un clip "va a ser aprobado".
- No intentar subir archivos que el usuario no haya confirmado que están en la carpeta de clips; no mover ni copiar archivos sin que lo pida.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Subir y borrar son escrituras distintas: cada una se confirma por separado.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo; el usuario puede subir el clip desde la app de Mercado Libre.
- Borrar un clip es irreversible: repetir el `clip_uuid` y el ítem antes de pedir la confirmación.
