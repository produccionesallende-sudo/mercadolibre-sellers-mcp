---
name: visualizador-publicaciones-ml
description: Generar un tablero visual interactivo (HTML local) con todas las publicaciones de Mercado Libre, su semáforo de calidad y problemas, para que el usuario elija qué arreglar. Usar cuando el usuario diga "mostrame mis publicaciones en un tablero", "quiero ver todo de un vistazo", "armar el visualizador", "panel visual de publicaciones" o "elegir qué publicaciones mejorar".
---

# Visualizador de publicaciones

## Objetivo
Construir un archivo HTML local a partir de `panel/visualizador.html` con una tarjeta por publicación (foto, título, precio, stock, vendidos, semáforo y problemas). El usuario marca en el tablero las publicaciones que quiere trabajar, copia el pedido que genera la página y lo pega en la conversación para continuar con mejorar-publicaciones-ml.

## Flujo
1. Llamar `ml_auditar_publicaciones(cuenta?, limite=100, estado?)`. De cada resultado tomar `item_id`, semáforo (rojo, ámbar, verde) y la lista de problemas con su arreglo sugerido.
2. Llamar `ml_publicaciones(cuenta?, estado?, limite=100)` para completar título, precio, stock y vendidos. Si la lista no trae la URL de la foto, llamar `ml_publicacion(cuenta?, item_id)` por cada ítem que la necesite (priorizar rojos y ámbar si son muchos).
3. Construir un objeto por publicación con esta forma exacta:
   ```
   { id: "MLA123", titulo: "...", precio: 12500, stock: 8, vendidos: 42,
     semaforo: "rojo" | "ambar" | "verde",
     problemas: ["Título sin marca", "Menos de 3 fotos"],
     foto: "https://..." }
   ```
   `semaforo` siempre en minúsculas y sin tilde; `problemas` es un arreglo de textos cortos; `foto` es una URL absoluta o cadena vacía si no hay.
4. Leer `panel/visualizador.html`, ubicar los marcadores `/*DATOS*/` y `/*FIN*/` y reemplazar únicamente lo que hay entre ellos por el arreglo JSON de objetos. No tocar el resto del HTML ni los marcadores.
5. Guardar el resultado como un archivo nuevo, por ejemplo `visualizador-<alias>-<fecha>.html`, en la carpeta que el usuario indique (o en la carpeta de trabajo). No sobrescribir la plantilla original.
6. Explicar cómo usarlo: abrir el archivo en el navegador, filtrar por semáforo, marcar las publicaciones a trabajar y copiar el texto que la página genera. Ese texto, pegado en la conversación, es el pedido para el siguiente paso.
7. Cuando el usuario pegue el pedido, continuar con mejorar-publicaciones-ml para esos `item_id` (auditoría detallada, propuestas y, con confirmación y escritura habilitada, `ml_actualizar_publicacion`).

## Formato de salida
```
Visualizador generado: <ruta completa del archivo .html>
Publicaciones incluidas: <n> (rojas <n> | ámbar <n> | verdes <n>)
Sin foto disponible: <n>

Cómo usarlo:
1. Abrir el archivo en el navegador (doble clic).
2. Marcar las publicaciones a trabajar.
3. Copiar el pedido generado y pegarlo aquí.
```

## Reglas
- Nunca inventar datos: cada tarjeta refleja exactamente lo que devolvieron `ml_auditar_publicaciones` y `ml_publicaciones`; si falta un campo, dejarlo vacío o en 0 y mencionarlo en el resumen.
- No agregar publicaciones de terceros ni datos de otras cuentas al mismo tablero sin indicarlo.
- El archivo es local y no se publica en ningún lado; no afirmar que se subió o compartió.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. El visualizador no modifica nada; los cambios se aplican después, uno por uno, en mejorar-publicaciones-ml.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo.
- Validar que el JSON insertado sea sintácticamente correcto antes de entregar el archivo; un error entre los marcadores deja el tablero en blanco.
