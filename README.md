# mercadolibre-sellers-mcp

Conectá **Claude** (Claude Desktop o Claude Code) con tu cuenta de **vendedor
de Mercado Libre**, de forma privada y bajo tu control.

- 🔒 **Solo lectura por defecto**: Claude puede *consultar* ventas,
  publicaciones, preguntas, precios, publicidad y competencia, pero **no puede
  modificar nada** hasta que vos lo habilites explícitamente.
- 🏠 **Tus tokens se quedan en tu computadora**, cifrados. No pasan por
  ningún servidor nuestro ni de terceros.
- 🌐 **Un solo destino de red**: la API oficial de Mercado Libre.
- 🧰 **34 herramientas** (28 de lectura, 6 de escritura) y **14 skills** en
  español.
- 🧪 **50 pruebas automáticas** con un simulador local (sin tocar cuentas reales).

> Este proyecto es independiente: no depende del repositorio, páginas ni
> servidores de ningún otro autor. Ver `NOTICE.md`.

---

## Índice

1. [Qué hace](#1-qué-hace)
2. [Requisitos](#2-requisitos)
3. [Instalación](#3-instalación)
4. [Crear tu aplicación en Mercado Libre](#4-crear-tu-aplicación-en-mercado-libre)
5. [Conectarlo a Claude Desktop o Claude Code](#5-conectarlo-a-claude-desktop-o-claude-code)
6. [Autorizar tu cuenta de vendedor](#6-autorizar-tu-cuenta-de-vendedor)
7. [Modo solo lectura (por defecto)](#7-modo-solo-lectura-por-defecto)
8. [Habilitar escritura](#8-habilitar-escritura)
9. [Desconectar una cuenta](#9-desconectar-una-cuenta)
10. [Revocar el acceso desde Mercado Libre](#10-revocar-el-acceso-desde-mercado-libre)
11. [Dónde se guardan los tokens](#11-dónde-se-guardan-los-tokens)
12. [Qué información NO sale de tu computadora](#12-qué-información-no-sale-de-tu-computadora)
13. [Solución de problemas](#13-solución-de-problemas)
14. [Actualizar de manera controlada](#14-actualizar-de-manera-controlada)
15. [Herramientas y skills](#15-herramientas-y-skills)
16. [Para desarrolladores](#16-para-desarrolladores)

---

## 1. Qué hace

Es un servidor **MCP** (Model Context Protocol): un programa pequeño que corre
en tu computadora y le da a Claude "herramientas" para hablar con la API
oficial de Mercado Libre usando **tu** cuenta de vendedor.

Con él podés pedirle a Claude cosas como:

- "¿Cómo venimos hoy?" → panel de ventas del día y del mes.
- "¿Qué preguntas tengo sin responder?"
- "Auditá mis publicaciones y decime cuáles mejorar."
- "¿Cuánto gano de verdad con este producto?" (comisiones, publicidad, impuestos).
- "¿Estoy ganando el catálogo?" / "¿Qué cambió en la competencia esta semana?"
- "¿Cuánto gasté en Product Ads y cuál es el ACOS?"

Y, **solo si habilitás la escritura**, también: cambiar precio/stock, pausar o
activar, responder preguntas, aceptar promociones, subir/borrar clips.

## 2. Requisitos

- Una cuenta de **vendedor** de Mercado Libre.
- **Node.js 20.11 o superior** (gratis: https://nodejs.org — versión LTS).
- **Claude Desktop** (https://claude.ai/download) o **Claude Code**.
- 10 minutos para crear una "aplicación" gratuita en Mercado Libre (paso 4).

## 3. Instalación

Descargá o cloná este repositorio en una carpeta fija de tu computadora
(ejemplo: `C:\mercadolibre-sellers-mcp` o `~/mercadolibre-sellers-mcp`) y, en
una terminal dentro de esa carpeta, ejecutá:

```bash
npm ci --ignore-scripts
```

Comprobá que funciona:

```bash
node src/index.js --version
```

Debe mostrar `mercadolibre-sellers-mcp 1.0.0`. Opcional, pero recomendado:

```bash
npm test
```

> No hay instalador automático ni `npx` desde internet, a propósito: lo que
> corre en tu computadora es exactamente lo que descargaste y revisaste.

## 4. Crear tu aplicación en Mercado Libre

Mercado Libre exige que cada integración tenga una "aplicación" con sus
credenciales. Es gratis y es tuya.

1. Entrá con tu cuenta de vendedor a **https://developers.mercadolibre.com.ar**
   (o el sitio de tu país: `.com.mx`, `.com.br`, `.cl`, `.com.co`, etc.).
2. **Mis aplicaciones → Crear nueva aplicación.**
3. Completá:
   - **Nombre**: el que quieras (ej. "Mi asistente Claude").
   - **URI de redirect**: una dirección **HTTPS** que vos controles (ver
     cuadro de abajo). Copiala exacta, sin barra final de más.
   - **Permisos (scopes)**: marcá `read`, `write` y **`offline_access`**
     (sin este último la sesión se corta cada 6 horas).
   - **PKCE**: si aparece la opción "Usar PKCE", **activala** (este MCP siempre
     lo usa).
   - Tópicos de notificaciones: no hacen falta.
4. Guardá. Mercado Libre te muestra el **App ID / Client ID** y el
   **Client Secret**. ⚠️ El Client Secret es como una contraseña: no lo
   compartas ni lo pegues en chats.

### Redirect URI: ¿qué pongo?

El redirect es la página a la que Mercado Libre te manda después de que
autorizás. Este MCP **no necesita que esa página haga nada**: vos copiás la URL
completa de la barra de direcciones (que contiene el código) y se la pegás a
Claude. Opciones, de más a menos recomendada:

| Opción | Qué poner | Comentario |
| --- | --- | --- |
| **A. Página propia en GitHub Pages** | `https://TU_USUARIO.github.io/mercadolibre-sellers-mcp/conectar.html` | Activá GitHub Pages en tu repositorio (Settings → Pages → rama `main`, carpeta `/docs`). La página `docs/conectar.html` es estática, sin scripts externos, y solo muestra la URL/código para copiar. |
| **B. Cualquier URL HTTPS tuya** | `https://tu-dominio.com/ml-callback` | Aunque la página no exista (dé 404), el código viaja en la URL. Copiá la URL completa de la barra del navegador. |
| C. Callback local (experimental) | `http://127.0.0.1:8765/callback` | Mercado Libre documenta que exige HTTPS; puede no aceptarla. Si la acepta, `ml_conectar esperar_callback_local=true` completa la conexión solo. |

Nunca uses una página de redirect de un tercero: el código de autorización
pasaría por un sitio que no controlás.

## 5. Conectarlo a Claude Desktop o Claude Code

### Claude Desktop

Abrí el archivo de configuración:

- **Windows**: `Win + R` → pegá `%APPDATA%\Claude\claude_desktop_config.json` → Enter.
- **Mac**: Claude Desktop → Settings → Developer → **Edit Config**.

Agregá el bloque `"mercadolibre"` (si el archivo ya tiene otros conectores,
sumá solo esa parte dentro de `mcpServers`). Reemplazá la ruta y tus datos:

```json
{
  "mcpServers": {
    "mercadolibre": {
      "command": "node",
      "args": ["C:\\mercadolibre-sellers-mcp\\src\\index.js"],
      "env": {
        "ML_CLIENT_ID": "TU_CLIENT_ID",
        "ML_CLIENT_SECRET": "TU_CLIENT_SECRET",
        "ML_REDIRECT_URI": "https://TU_USUARIO.github.io/mercadolibre-sellers-mcp/conectar.html",
        "ML_SITE": "MLA",
        "SOLO_LECTURA": "true"
      }
    }
  }
}
```

En Mac/Linux la ruta es del estilo `"/Users/tu-usuario/mercadolibre-sellers-mcp/src/index.js"`.
Guardá y **reiniciá Claude Desktop** (cerralo del todo; en Windows también
desde la bandeja junto al reloj).

> Ese archivo contiene tu Client Secret: no lo compartas ni lo subas a ningún
> lado.

### Claude Code

```bash
claude mcp add mercadolibre -e ML_CLIENT_ID=TU_CLIENT_ID -e ML_CLIENT_SECRET=TU_CLIENT_SECRET -e ML_REDIRECT_URI=https://TU_USUARIO.github.io/mercadolibre-sellers-mcp/conectar.html -e ML_SITE=MLA -e SOLO_LECTURA=true -- node /ruta/a/mercadolibre-sellers-mcp/src/index.js
```

Variables disponibles (todas se documentan en `.env.example`):

| Variable | Obligatoria | Para qué |
| --- | --- | --- |
| `ML_CLIENT_ID` / `ML_CLIENT_SECRET` | sí | credenciales de tu app (también se aceptan `ML_APP_ID` / `ML_APP_SECRET`) |
| `ML_REDIRECT_URI` | sí | la redirect URI exacta de tu app |
| `ML_SITE` | no | país por defecto del enlace de autorización (`MLA`, `MLM`, `MLB`, …) |
| `SOLO_LECTURA` | no | `true` por defecto; solo `false` habilita escrituras |
| `ESCRITURAS_PERMITIDAS` | no | lista de herramientas de escritura habilitadas (si está vacía y `SOLO_LECTURA=false`, todas) |
| `ML_CONFIG_DIR` | no | carpeta de tokens/vigilancia (default `~/.mercadolibre-sellers-mcp`) |
| `ML_DIRECTORIO_CLIPS` | no | única carpeta desde la que se pueden subir videos |
| `ML_CLAVE_ALMACEN` | no | secreto extra para cifrar los tokens |
| `ML_LOG_NIVEL` | no | `error`, `warn`, `info` (default), `debug` |

## 6. Autorizar tu cuenta de vendedor

En un chat nuevo decile a Claude: **"conectá mi cuenta de Mercado Libre"**
(o usá la skill `setup-ml`). Claude llamará a `ml_conectar` y te dará un
enlace.

1. Abrí el enlace, iniciá sesión con **tu cuenta de vendedor** y tocá
   **Autorizar**.
2. El navegador te lleva a tu redirect URI. **Copiá la URL completa** de la
   barra de direcciones (contiene `code=TG-...` y `state=...`). Si usás la
   página `conectar.html`, tiene un botón para copiarla.
3. Pegásela a Claude. Claude llama a `ml_conectar codigo="<la URL>"` y listo:
   verás "✅ Cuenta conectada: TU_NICKNAME".

La sesión se renueva sola (refresh token) mientras la app tenga
`offline_access`. ¿Más de una tienda? Repetí el paso con cada cuenta; con
`ml_cuentas` elegís la predeterminada.

El enlace vence a los **15 minutos** y es de **un solo uso**. Si falla, pedí
otro.

## 7. Modo solo lectura (por defecto)

Al arrancar, el MCP está en **solo lectura**. Las 6 herramientas que pueden
modificar tu cuenta aparecen en Claude marcadas como **🔒 BLOQUEADA** y, si
Claude intenta usarlas, reciben un mensaje de bloqueo **antes de tocar
internet**. No hay forma de "convencer" a Claude de saltarlo: el bloqueo está
en el programa, no en el prompt.

Herramientas de escritura: `ml_actualizar_publicacion`, `ml_crear_publicacion`,
`ml_responder_pregunta`, `ml_aceptar_promocion`, `ml_subir_clip`,
`ml_borrar_clip`.

Podés verificar el modo en cualquier momento con **`ml_estado`**.

## 8. Habilitar escritura

Solo el propietario de la computadora puede hacerlo, editando la configuración:

1. En el bloque `env` poné `"SOLO_LECTURA": "false"`.
2. Opcional (recomendado): limitá qué se habilita, por ejemplo
   `"ESCRITURAS_PERMITIDAS": "ml_responder_pregunta,ml_actualizar_publicacion"`.
3. Reiniciá Claude.

Incluso habilitadas, cada escritura exige que Claude pase `confirmar=true`, y
las skills le indican mostrar el cambio exacto y pedirte confirmación por
ítem. Cada escritura ejecutada queda registrada (sin tokens) en
`~/.mercadolibre-sellers-mcp/auditoria-escrituras.log`.

Para volver a solo lectura: `"SOLO_LECTURA": "true"` (o borrá la línea) y
reiniciá Claude.

## 9. Desconectar una cuenta

- Decile a Claude "desconectá la cuenta X" → `ml_desconectar cuenta=<user_id>`
  borra los tokens de esa cuenta de tu computadora.
- `ml_desconectar cuenta=<user_id> revocar_en_mercadolibre=true` además revoca
  la autorización en Mercado Libre (invalida cualquier token emitido).
- `ml_desconectar cuenta="todas"` borra el archivo de tokens completo.

## 10. Revocar el acceso desde Mercado Libre

Independientemente de esta computadora, podés cortar el acceso desde tu cuenta:

- Ingresá a Mercado Libre → **Mi perfil → Seguridad → Aplicaciones
  conectadas** (el nombre exacto del menú puede variar por país) y quitá tu
  aplicación.
- O, en el DevCenter (developers.mercadolibre.com.ar → Mis aplicaciones),
  **renová el Client Secret**: eso invalida todos los tokens de la app.
  Después actualizá `ML_CLIENT_SECRET` en la configuración y volvé a conectar.

## 11. Dónde se guardan los tokens

En la carpeta `~/.mercadolibre-sellers-mcp/` (Windows:
`C:\Users\TU_USUARIO\.mercadolibre-sellers-mcp\`), salvo que definas
`ML_CONFIG_DIR`:

| Archivo | Contenido |
| --- | --- |
| `cuentas.json` | tokens de acceso/refresh de cada cuenta, **cifrados con AES-256-GCM**. La clave se deriva de tu Client Secret (y de `ML_CLAVE_ALMACEN` si la definís): el archivo solo no sirve. |
| `vigilancia.json` | tu lista de competidores vigilados e historial (datos públicos). |
| `auditoria-escrituras.log` | registro local de cada escritura ejecutada (sin tokens). |
| `clips/` | carpeta desde la que se pueden subir videos. |

Permisos: carpeta 0700 y archivos 0600 en Mac/Linux; en Windows, la carpeta
de tu perfil ya es privada de tu usuario.

## 12. Qué información NO sale de tu computadora

- Tu **Client Secret**, los **access tokens**, los **refresh tokens** y los
  **códigos de autorización**: solo viajan a `api.mercadolibre.com` cuando la
  API lo requiere (canje, refresh, cabecera `Authorization`).
- Tu lista de vigilancia, el registro de auditoría y la configuración.
- Nada se envía a los autores de este proyecto ni a terceros: **no hay
  telemetría, ni chequeo de versiones, ni analítica**.

Hosts a los que se conecta el programa: `api.mercadolibre.com` (API) y el
enlace a `auth.mercadolibre.<país>` que **vos** abrís en tu navegador. El
código rechaza cualquier otro destino (`src/meli/transporte.js`).

## 13. Solución de problemas

| Síntoma | Causa probable y solución |
| --- | --- |
| El conector no aparece en Claude | Claude no se reinició del todo, o el JSON tiene un error (una coma de más). Validá el archivo en un verificador de JSON. Probá `node src/index.js --version` en la terminal. |
| "Faltan ML_CLIENT_ID y/o ML_CLIENT_SECRET" | Quedaron `TU_CLIENT_ID` / `TU_CLIENT_SECRET` sin reemplazar. |
| "Falta ML_REDIRECT_URI" | Agregá la variable con la misma URI que cargaste en tu app. |
| Mercado Libre dice `invalid redirect_uri` o `invalid_grant` | La URI en tu app no es idéntica a `ML_REDIRECT_URI` (mayúsculas, barra final, http/https). |
| "El state no coincide" | Pegaste una URL de un intento anterior. Pedí un enlace nuevo con `ml_conectar`. |
| "No hay una autorización iniciada (o venció)" | Pasaron más de 15 minutos. Pedí un enlace nuevo. |
| "La sesión venció o fue revocada" | Faltó `offline_access`, cambiaste la contraseña de Mercado Libre, renovaste el Client Secret o revocaste la app. Volvé a conectar con `ml_conectar`. |
| "No se pudieron descifrar los tokens" | Cambió `ML_CLIENT_SECRET` o `ML_CLAVE_ALMACEN`. `ml_desconectar cuenta="todas"` y reconectá. |
| 403 en alguna herramienta | Tu app no tiene ese permiso, o la función no está habilitada para tu cuenta/país (p. ej. Publicidad, Clips, búsqueda pública). |
| 429 "limitando la cantidad de consultas" | Esperá un minuto. El MCP ya reintenta con espera progresiva. |
| Una herramienta de escritura dice "BLOQUEADA" | Es el modo solo lectura por defecto. Ver sección 8. |
| Dos Claudes abiertos a la vez | Está contemplado: el refresh de tokens usa un bloqueo entre procesos. |

Para ver más detalle, poné `"ML_LOG_NIVEL": "debug"` y mirá los logs del
servidor MCP en Claude Desktop (Settings → Developer → Logs). Los logs nunca
incluyen tokens.

## 14. Actualizar de manera controlada

El MCP **no se actualiza solo**. Cuando quieras actualizar:

```bash
git pull
```

```bash
npm ci --ignore-scripts
```

```bash
npm test
```

```bash
npm run auditoria
```

Si las pruebas pasan y la auditoría no reporta nada, reiniciá Claude. Leé
`CHANGELOG.md` para saber qué cambió. Si algo no te convence, `git checkout
v1.0.0` (o la versión anterior) vuelve atrás.

## 15. Herramientas y skills

### Herramientas de lectura (28)

| Herramienta | Qué hace |
| --- | --- |
| ml_conectar, ml_cuentas, ml_desconectar, ml_estado | conexión, cuentas, estado y modo de seguridad |
| ml_ordenes, ml_orden, ml_envio | ventas, detalle de una orden, envío |
| ml_panel_ventas, ml_metricas | panel hoy/mes y comparación de períodos |
| ml_publicaciones, ml_publicacion, ml_visitas, ml_auditar_publicaciones | catálogo propio, detalle, tráfico, semáforo de calidad |
| ml_preguntas | preguntas pendientes/respondidas |
| ml_comisiones, ml_precio_catalogo, ml_rentabilidad | costos de venta, buy box, ganancia real |
| ml_buscar, ml_tendencias, ml_categorias, ml_descubrir_ganadores | mercado, tendencias, categorías, qué vender |
| ml_reputacion, ml_promociones, ml_publicidad, ml_clips | reputación, promociones, Product Ads, clips |
| ml_vigilar, ml_novedades_competencia, ml_historial_competencia | vigilancia de competencia (local) |

### Herramientas de escritura (6, bloqueadas por defecto)

`ml_actualizar_publicacion` · `ml_crear_publicacion` · `ml_responder_pregunta`
· `ml_aceptar_promocion` · `ml_subir_clip` · `ml_borrar_clip`

### Skills (14)

En la carpeta `skills/` (guía en `skills/README.md`): setup-ml,
panel-ventas-ml, reporte-ventas-ml, responder-preguntas-ml,
mejorar-publicaciones-ml, competencia-ml, vigilancia-ml, publicidad-ml,
calculadora-ml, descubrir-ganadores-ml, clips-ml, copiar-publicaciones-ml,
imagenes-ml, visualizador-publicaciones-ml. Se cargan en Claude Desktop desde
**Configuración → Capacidades → Skills → Cargar skill**, o copiando la carpeta
a `.claude/skills/` en Claude Code.

También incluye `panel/visualizador.html` (tablero interactivo de
publicaciones) y `plantillas/` (4 plantillas SVG de imágenes de venta con
generador `node plantillas/generar.js`).

## 16. Para desarrolladores

```
src/
  index.js              punto de entrada (stdio)
  servidor.js           McpServer, política de escritura, auditoría
  config.js             variables de entorno, SOLO_LECTURA, allowlist de hosts
  almacen.js            tokens cifrados + bloqueo entre procesos
  politica.js           bloqueo de escrituras y registro de auditoría
  redaccion.js / log.js secretos fuera de logs
  meli/transporte.js    HTTP: un solo host, rutas seguras, reintentos 429/5xx
  meli/oauth.js         PKCE + state, canje y refresh
  meli/sesiones.js      cuentas, tokens, cliente autenticado
  meli/recursos.js      /items/bulk, órdenes, envíos (formato nuevo), anunciante
  herramientas/lectura/ · herramientas/escritura/ · herramientas/local/
test/                   50 pruebas con simulador local (test/ayuda/mock-meli.js)
scripts/buscar-secretos.js
docs/                   auditoría de referencia, paridad, decisiones, conectar.html
```

Comandos: `npm test` · `npm run auditoria` (audit + secretos) ·
`node src/index.js --listar-herramientas`.

Documentos: `docs/auditoria-referencia.md` (inventario y riesgos del proyecto
de referencia), `docs/paridad.md` (matriz FUNCIÓN ORIGINAL → NUEVA → ESTADO),
`docs/decisiones.md`, `SECURITY.md`, `NOTICE.md`, `CHANGELOG.md`.

Licencia: MIT.
