# Receptor de notificaciones de Mercado Libre — despliegue

Mercado Libre exige, al crear/configurar la aplicación, una **"Notificaciones
callbacks URL"** pública con HTTPS a la que envía un `POST` JSON cada vez que
ocurre algo en tu cuenta (órdenes, preguntas, envíos, etc.). Este repositorio
incluye un receptor **separado del servidor MCP**:

| | Servidor MCP (`src/index.js`) | Receptor de notificaciones (`src/notificaciones.js`) |
| --- | --- | --- |
| Dónde corre | en tu computadora, dentro de Claude (stdio) | en un servicio con URL pública HTTPS |
| Credenciales | Client ID + Client Secret + tokens | **solo** `ML_CLIENT_ID` (para filtrar); sin secret ni tokens |
| Qué hace | herramientas para Claude | recibe `POST`, responde 200 al instante, registra la notificación |

El receptor **no necesita el Client Secret ni los tokens**: nunca los subas al
servicio de despliegue.

## Qué hace el endpoint

- `POST /notifications` (ruta configurable con `NOTIFICACIONES_RUTA`):
  valida que sea JSON con `topic` y `resource`, responde `200 {"ok":true}`
  **antes** de procesar (Mercado Libre reintenta si no recibe 2xx rápido),
  escribe una línea de log por notificación (sin el cuerpo crudo) y, si
  `ML_CLIENT_ID` está definido, ignora las que traigan otro `application_id`.
- `GET /health` → `200 {"ok":true,...}` para el chequeo de vida del hosting.
- Todo lo demás → 404/405. Cuerpos > 64 KB → 413. JSON inválido → 400.
- Opcional `NOTIFICACIONES_ARCHIVO=/ruta/notificaciones.jsonl`: guarda cada
  notificación aceptada (una por línea). En hostings sin disco persistente se
  pierde al reiniciar; los logs del panel son la fuente principal.

Ejemplo de log (nivel `info`):

```
[mercadolibre-sellers-mcp] INFO Notificación recibida · topic=orders_v2 · resource=/orders/2195160686 · user_id=123456 · intento=1 · enviada=2026-10-12T10:00:00.000Z
```

## Variables de entorno del receptor

| Variable | Default | Para qué |
| --- | --- | --- |
| `PORT` | `3000` | puerto (Render/Cloud Run lo inyectan solos) |
| `NOTIFICACIONES_RUTA` | `/notifications` | ruta del endpoint |
| `ML_CLIENT_ID` | — | si se define, ignora notificaciones de otras aplicaciones |
| `NOTIFICACIONES_ARCHIVO` | — | archivo JSONL opcional |
| `ML_LOG_NIVEL` | `info` | `debug` para más detalle |
| `NOTIFICACIONES_HOST` | `0.0.0.0` | interfaz (dejar el default en hosting) |

## Probar en tu computadora

```bash
PORT=3000 node src/notificaciones.js
```

En otra terminal:

```bash
curl -s -X POST http://127.0.0.1:3000/notifications -H "Content-Type: application/json" -d "{\"resource\":\"/orders/1\",\"user_id\":1,\"topic\":\"orders_v2\",\"application_id\":1,\"attempts\":1,\"sent\":\"2026-10-12T10:00:00Z\"}"
```

Debe responder `{"ok":true}` y el log mostrar `Notificación recibida`.
Las pruebas automáticas están en `test/notificaciones.test.js` (`npm test`).

## Despliegue recomendado: Render (Web Service)

Por qué Render: URL HTTPS permanente con certificado automático, despliegue
directo desde GitHub con auto-deploy en cada push a `main`, plan gratuito sin
tarjeta, variables de entorno cifradas y soporte nativo de Node (no hay que
adaptar el código a serverless). Limitación del plan gratuito: el servicio se
duerme tras ~15 minutos sin tráfico y la siguiente petición tarda ~30 s;
Mercado Libre reintenta las notificaciones que no obtienen 2xx, así que no se
pierden, pero para producción conviene el plan Starter (siempre activo).

### Pasos

1. Entrá a https://render.com y creá una cuenta (podés usar "Sign in with
   GitHub" con `produccionesallende-sudo`).
2. **New → Blueprint** → conectá el repositorio
   `produccionesallende-sudo/mercadolibre-sellers-mcp`. Render lee
   `render.yaml` y propone el servicio `mercadolibre-notificaciones`.
   (Alternativa manual: **New → Web Service**, runtime Node, build
   `npm ci --omit=dev --ignore-scripts`, start `node src/notificaciones.js`,
   health check `/health`.)
3. En **Environment** cargá `ML_CLIENT_ID` con el Client ID de tu aplicación
   de Mercado Libre (es público, no es el secret). No cargues nada más.
4. **Apply / Create Web Service**. En 1-2 minutos el log muestra
   `Receptor de notificaciones v1.x escuchando en 0.0.0.0:10000 · ruta /notifications`.
5. Render asigna la URL pública: `https://mercadolibre-notificaciones.onrender.com`
   (si el nombre está tomado, Render agrega un sufijo, p. ej.
   `mercadolibre-notificaciones-abc1.onrender.com`; la URL exacta aparece
   arriba a la izquierda en el panel del servicio).
6. Verificá: abrí `https://<tu-servicio>.onrender.com/health` en el navegador;
   debe mostrar `{"ok":true,...}`.

### URL de callback para Mercado Libre

```
https://<tu-servicio>.onrender.com/notifications
```

Con el nombre por defecto del blueprint:
`https://mercadolibre-notificaciones.onrender.com/notifications`.

Esa es la cadena exacta a pegar en el campo **"Notificaciones callbacks URL"**
de tu aplicación en el DevCenter, junto con los tópicos que quieras recibir
(`orders_v2`, `questions`, `shipments`, `items`, …). Mercado Libre valida la
URL enviando una notificación de prueba: en los logs de Render verás
`Notificación recibida`.

## Alternativas

- **Google Cloud Run** (escala a cero, requiere tarjeta): `gcloud run deploy
  mercadolibre-notificaciones --source . --region us-central1 --allow-unauthenticated
  --set-env-vars ML_CLIENT_ID=...` usa el `Dockerfile`. URL:
  `https://mercadolibre-notificaciones-<hash>-uc.a.run.app/notifications`.
- **Fly.io** (requiere tarjeta): `fly launch` con el `Dockerfile`; URL
  `https://<app>.fly.dev/notifications`.
- Cualquier VPS con Node y un proxy HTTPS (Caddy/nginx) delante de
  `node src/notificaciones.js`.

## Seguridad

- El receptor no tiene acceso a tokens ni al Client Secret: aunque alguien
  llegue a él, no puede operar tu cuenta.
- Responde 200 a cualquier JSON bien formado con `topic`/`resource` (así lo
  exige Mercado Libre), pero solo **procesa** las que coinciden con tu
  `ML_CLIENT_ID`. Mercado Libre no firma las notificaciones: tratá su
  contenido como un aviso de "algo cambió en este recurso", no como dato
  confiable; el dato real se consulta después con la API autenticada.
- Sin dependencias nuevas; el contenedor corre como usuario `node`.
