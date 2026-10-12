---
name: responder-preguntas-ml
description: Redactar y publicar respuestas a preguntas de compradores en Mercado Libre. Usar cuando el usuario diga "responder preguntas", "qué preguntas tengo", "contestá las preguntas pendientes", "ayudame a responder esto" o cuando otro skill detecte preguntas sin responder.
---

# Responder preguntas de compradores

## Objetivo
Redactar todas las respuestas pendientes de una vez, que el usuario las apruebe o corrija, y publicarlas una por una con confirmación, solo si el propietario habilitó la escritura.

## Flujo
1. Llamar `ml_preguntas(cuenta?, estado="UNANSWERED", limite=30)`. Si hay más de 30, procesar por tandas. Si no hay pendientes, decirlo y ofrecer revisar las respondidas (`estado="ANSWERED"`) para detectar dudas repetidas.
2. Para cada pregunta, llamar `ml_publicacion(cuenta?, item_id, incluir_descripcion=true)` del ítem correspondiente para responder con datos reales: precio, stock, variantes, medidas, garantía, lo que diga la descripción.
3. Redactar un borrador por pregunta siguiendo el estilo: saludo corto, respuesta directa en la primera línea, dato de respaldo, cierre que invite a comprar. Máximo 3 o 4 líneas. Si la pregunta pide algo que no está en la publicación (por ejemplo, compatibilidad), preguntar al usuario en lugar de suponer.
4. Mostrar la tabla de borradores completa (ver formato) y pedir que el usuario apruebe, edite o descarte cada uno. No publicar nada en este paso.
5. Con las respuestas aprobadas, verificar `ml_estado()` para saber si `ml_responder_pregunta` está entre las escrituras permitidas.
6. Publicar una por una: `ml_responder_pregunta(cuenta?, pregunta_id, texto, confirmar=true)`. Antes de cada llamada, mostrar el texto final y esperar un "sí" explícito para esa pregunta. Informar el resultado de cada envío.
7. Si la respuesta de la herramienta indica solo lectura, detenerse, explicar y entregar los borradores para que el usuario los pegue manualmente en Mercado Libre.

## Formato de salida
```
Preguntas pendientes: <n>  (cuenta <alias>)

| # | ID pregunta | Publicación | Pregunta (resumen) | Borrador de respuesta |
| 1 | <id> | <título corto> | "¿Tiene stock en talle M?" | Hola, sí, tenemos talle M disponible... |

Indicar por número: aprobar / editar / descartar.
```
Tras publicar:
```
Pregunta <id>: publicada correctamente.
Pregunta <id>: no publicada (motivo textual de la herramienta).
```

## Reglas de redacción
- Nunca incluir teléfono, correo, redes sociales, enlaces externos ni invitar a contactar fuera de Mercado Libre: la plataforma penaliza y puede suspender la cuenta.
- No prometer precios, plazos ni stock que no figuren en la publicación o que el usuario no haya confirmado.
- Tono cordial y neutro; sin mayúsculas sostenidas ni signos repetidos.
- Si la pregunta es ofensiva o spam, proponer una respuesta mínima y educada o sugerir no responder.

## Reglas
- Nunca inventar datos: cada afirmación en una respuesta debe salir de `ml_publicacion` o de lo que el usuario indicó en la conversación.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Un "publicá todas" vale como confirmación solo si antes se mostró el texto final de cada una y el usuario las revisó; aun así, enviar una por una e informar cada resultado.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo ni buscar otra vía de publicación.
- No reenviar una respuesta que ya fue publicada; si hay duda, volver a consultar `ml_preguntas`.
