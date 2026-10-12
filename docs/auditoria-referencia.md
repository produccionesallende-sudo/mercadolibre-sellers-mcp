# Auditoría del proyecto de referencia

Archivo analizado: `mercadolibre-sellers-mcp-algoritmo-Digital-main.zip`
(SHA-256 `f3282ab033227d8557ddd3a8db2be8d3619cdd9db977f8d361ae5b261ee5d2d9`),
paquete `@algoritmodigital/meli-sellers-mcp` **v1.12.0**, licencia **MIT**
(Copyright 2026 Algoritmo Digital). Se revisó el **código real**, no solo el
README. El ZIP original no fue modificado.

## 1. Herramientas MCP (32 en código; el README dice 29 y el package.json 22)

| # | Herramienta | Tipo | Endpoint(s) de Mercado Libre |
| --- | --- | --- | --- |
| 1 | ml_conectar | lectura* | `/oauth/token`, `/users/me` |
| 2 | ml_cuentas | local | — |
| 3 | ml_desconectar | local (marcada escritura) | — |
| 4 | ml_version | **red a GitHub** | `raw.githubusercontent.com/kokesaurio/...` |
| 5 | ml_ordenes | lectura | `/orders/search` |
| 6 | ml_panel_ventas | lectura | `/orders/search`, `/orders/{id}/shipments` |
| 7 | ml_metricas | lectura | `/orders/search` |
| 8 | ml_envios | lectura | `/orders/{id}/shipments` |
| 9 | ml_publicaciones | lectura | `/users/{id}/items/search`, `/items?ids=` |
| 10 | ml_publicacion | lectura | `/items/{id}` |
| 11 | ml_visitas | lectura | `/items/{id}/visits/time_window` |
| 12 | ml_actualizar_publicacion | **escritura** | `PUT /items/{id}` |
| 13 | ml_crear_publicacion | **escritura** | `POST /items`, `POST /items/{id}/description` |
| 14 | ml_preguntas | lectura | `/questions/search`, `/items/{id}` |
| 15 | ml_responder_pregunta | **escritura** | `POST /answers` |
| 16 | ml_comisiones | lectura | `/sites/{s}/listing_prices` |
| 17 | ml_precio_catalogo | lectura | `/items/{id}/price_to_win?version=v2` |
| 18 | ml_buscar | lectura | `/sites/{s}/search` |
| 19 | ml_reputacion | lectura | `/users/me` |
| 20 | ml_promociones | lectura | `/seller-promotions/users/{id}`, `/seller-promotions/promotions/{id}/items` |
| 21 | ml_aceptar_promocion | **escritura** | `POST /seller-promotions/items/{id}` |
| 22 | ml_auditar_publicaciones | lectura | `/items/{id}`, `/items/{id}/description`, `price_to_win` |
| 23 | ml_publicidad | lectura | `/advertising/product_ads/ads/{id}`, `/advertising/product_ads/items/{id}`, `/advertising/advertisers`, `/advertising/product_ads/campaigns` |
| 24 | ml_rentabilidad | lectura | `listing_prices`, `/advertising/product_ads/...` |
| 25 | ml_clips | lectura | `/marketplace/items/{id}/clips`, `/items/{id}/clips` |
| 26 | ml_subir_clip | **escritura** (lee archivo local arbitrario) | `POST .../clips/upload` (multipart) |
| 27 | ml_borrar_clip | **escritura** | `DELETE .../clips/{uuid}` |
| 28 | ml_vigilar | local + lectura | `/sites/{s}/search`, `/items/{id}`, `/trends/...` |
| 29 | ml_novedades_competencia | local + lectura | ídem |
| 30 | ml_historial_competencia | local | — |
| 31 | ml_descubrir_ganadores | lectura | `/highlights/{s}/category/{c}`, `/items?ids=`, `/trends/...`, `/sites/{s}/search` |
| 32 | ml_tendencias | lectura | `/trends/{s}[/{cat}]` |

\* `ml_conectar` está marcada `readOnly: true` aunque escribe tokens en disco.
7 herramientas marcadas `readOnly: false` (incluye `ml_desconectar`).

## 2. Skills (17 carpetas)

calculadora-ml, clips-ml, competencia-ml, copiar-publicaciones-ml,
descubrir-ganadores-ml, imagenes-ml, mejorar-publicaciones-ml, panel-ventas-ml,
publicidad-ml, reporte-ventas-ml, responder-preguntas-ml,
revisar-publicaciones-aldi, setup-ml, ugc-ml, video-publicaciones-ml,
vigilancia-ml, visualizador-publicaciones-ml.

Hallazgo: **6 skills referencian herramientas que NO existen en este repo**
(`ml_competitividad`, `ml_competidores`, `ml_cambios_precio`, `ml_catalogo`,
`ml_mercado`, `ml_salud_publicaciones`, `ml_rendimiento_publicaciones`,
`ml_embudo`, `ml_simular_precios`, `ml_sincronizar`, `ml_panel`, `ml_alertas`,
`ml_caja`, `ml_facturacion`, `ml_mensajes`, `ml_stock`, `ml_reclamos`).
Pertenecen al "conector premium con CRM" del mismo autor: son material de
venta cruzada, no funcionalidad de este proyecto. `revisar-publicaciones-aldi`
depende de un GPT de ChatGPT del autor. `ugc-ml` y `video-publicaciones-ml`
dependen de herramientas externas (HyperFrames, avatares de IA) no incluidas.

## 3. Endpoints de Mercado Libre usados

Ver tabla del punto 1. Observaciones contra la documentación oficial vigente
(octubre 2026):

- `/items?ids=` → se desactiva el 25/10/2026 (reemplazo `/items/bulk`).
- `/advertising/product_ads/ads/{id}`, `/advertising/product_ads/items/{id}`,
  `/advertising/product_ads/campaigns` → **dados de baja el 27/05/2026**
  (devuelven 404). `ml_publicidad` y la parte de ads de `ml_rentabilidad`
  ya no funcionan.
- `/orders/{id}/shipments` sin `X-New-Domain` → vista deprecada desde fines de
  septiembre de 2026.
- `/sites/{s}/listing_prices` sin `billable_weight`/`logistic_type` → costo
  fijo impreciso.

## 4. URLs / hosts externos (en código, no solo docs)

| Host | Dónde | Para qué |
| --- | --- | --- |
| `api.mercadolibre.com` | `src/meli.js` | API (necesario) |
| `auth.mercadolibre.*` (18 países) | `src/meli.js` | enlace de autorización (necesario) |
| **`raw.githubusercontent.com/kokesaurio/...`** | `src/version.js` | chequeo de actualizaciones en **cada arranque** del servidor (cacheado 24 h), con `cb=<timestamp>` |
| **`kokesaurio.github.io/.../conectar.html`** | `src/herramientas.js`, `src/instalar.js` | **redirect URI OAuth por defecto**: el `code` de autorización pasa por una página del autor |
| `github.com/kokesaurio/...` | `instalar.js`, `herramientas.js`, `version.js` | pedidos de "estrella", abre el navegador con `exec()` |
| `algoritmodigital.com.ar`, `wa.me/5491177166060` | README, SECURITY, FUNDING | marketing / contacto |
| `chatgpt.com/g/...` | skill aldi | GPT del autor |
| `fonts.googleapis.com` | `panel/visualizador.html` | tipografía externa |

## 5. Dependencias npm

`@modelcontextprotocol/sdk ^1.22.0` (flotante), `zod ^3.24.0` (flotante),
dev: `express ^4.21.0`. 126 paquetes resueltos en el lockfile. Sin
`hasInstallScript`. Sin `.npmrc` (los scripts post-install de dependencias se
ejecutarían).

## 6. Scripts de instalación / ejecución por npx

- Instalación recomendada: `npx -y github:kokesaurio/mercadolibre-sellers-mcp-algoritmo-Digital`
  en la configuración de Claude Desktop → **cada arranque de Claude ejecuta
  el código que esté en la rama `main` del autor en ese momento** (supply
  chain: sin versión fijada, sin lockfile efectivo, sin verificación).
- `src/instalar.js`: reescribe `claude_desktop_config.json` (con backup) y
  guarda `ML_APP_SECRET` **en texto plano** en ese archivo; usa
  `child_process.exec` para abrir GitHub.
- Comando `actualizar`: borra la caché de npx (`~/.npm/_npx`) con
  `rmSync(..., {recursive, force})`.

## 7–10. OAuth y tokens

- OAuth Authorization Code + PKCE S256 ✅, **sin `state`** (anti-CSRF).
- Redirect URI por defecto: página estática del autor (GitHub Pages). La
  página no envía nada por JS (verificado), pero el `code` llega a un dominio
  controlado por un tercero y depende de que esa página siga existiendo.
- Tokens en `~/.meli-sellers-mcp/cuentas.json` **en texto plano** (JSON),
  permisos 0600 en Unix (sin efecto en Windows), escritura atómica ✅.
- Refresh single-flight **dentro del proceso** (Map); sin bloqueo entre
  procesos (Claude Desktop + Claude Code simultáneos pueden invalidar la sesión,
  porque el refresh token de ML es de un solo uso).
- Reintento único ante 401 ✅. Sin manejo de 429/5xx ni backoff.
- Pendiente OAuth: una sola, vence a 30 min.

## 11–12. Lectura vs escritura

Distinción por `readOnly`; `ML_SOLO_LECTURA=1` **no es el default**
(por defecto arranca con lectura y escritura). Las escrituras no exigen un
parámetro de confirmación: dependen solo del prompt del modelo.

## 13–14. Actualizaciones automáticas y npx

Sí: aviso de nueva versión inyectado en la **primera respuesta de cualquier
herramienta** (texto de marketing), y ejecución desde `github:…/main` por npx
(ver punto 6).

## 15. Comunicación con servidores distintos de Mercado Libre

`raw.githubusercontent.com` (cada arranque) y `kokesaurio.github.io` (en cada
autorización). No se detectó envío de tokens ni de datos de la cuenta a
terceros.

## 16. Riesgos de seguridad identificados

1. **Supply chain**: ejecución de `main` remoto por npx en cada arranque;
   versiones flotantes; sin `ignore-scripts`.
2. **Dependencia de infraestructura del autor** para OAuth (redirect) y
   actualizaciones.
3. **Tokens en texto plano** en disco.
4. **Escritura habilitada por defecto**, sin confirmación estructural.
5. **Sin `state`** en OAuth.
6. **`ml_subir_clip` lee cualquier ruta del disco** que el modelo pase
   (`fs.readFileSync(args.archivo)`) y la sube a Mercado Libre: vector de
   exfiltración si el prompt es manipulado (p. ej. por una pregunta de un
   comprador).
7. `child_process.exec` con URL interpolada en el instalador (URL fija, riesgo
   bajo pero innecesario).
8. Client Secret escrito en texto plano por el instalador en
   `claude_desktop_config.json` (inevitable en Claude Desktop, pero el
   instalador no lo advierte).
9. Endpoints deprecados/dados de baja (publicidad) → funcionalidad rota.
10. Skills que prometen herramientas inexistentes → el modelo puede
    "alucinar" llamadas.
