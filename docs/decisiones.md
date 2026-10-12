# Decisiones técnicas

1. **Implementación desde cero, licencia MIT propia.** El proyecto de
   referencia es MIT, pero se reescribió todo para no heredar dependencias
   del autor ni deuda (endpoints dados de baja, skills que llaman a
   herramientas inexistentes). Ver `NOTICE.md`.
2. **Solo lectura por defecto.** `SOLO_LECTURA` ausente, vacío o con un valor
   no reconocido = solo lectura. La verificación está centralizada en
   `src/servidor.js` → `PoliticaEscritura`, no en cada herramienta, y además
   cada escritura exige `confirmar=true`.
3. **Sin instalador ni auto-actualización.** Escribir el Client Secret en
   `claude_desktop_config.json` lo hace el propietario, sabiendo que ese
   archivo lo contiene. Actualizar es `git pull` + `npm ci` + `npm test`.
4. **Redirect URI bajo control del propietario.** Mercado Libre exige HTTPS.
   Opciones documentadas: (a) página estática `docs/conectar.html` publicada
   en GitHub Pages del propio repositorio; (b) cualquier URL HTTPS propia
   (aunque no exista: el código viaja en la barra de direcciones y se pega la
   URL completa); (c) callback `http://127.0.0.1` experimental.
5. **Tokens cifrados (AES-256-GCM, scrypt).** La clave deriva del Client
   Secret: una copia del archivo sin la configuración de Claude no sirve.
   `ML_CLAVE_ALMACEN` permite sumar un segundo secreto.
6. **Bloqueo entre procesos para el refresh.** El refresh token de ML es de
   un solo uso; Claude Desktop y Claude Code abiertos a la vez no deben
   pisarse.
7. **Un solo host permitido** y validado (`ML_API_BASE` solo acepta la API
   oficial o loopback para pruebas). Sin redirecciones. Token solo en header.
8. **API vigente (octubre 2026)**: `/items/bulk`, `GET /shipments/{id}` con
   `x-format-new`, Product Ads v2 por sitio/anunciante, `listing_prices` con
   peso/logística, revocación oficial. Fuente: documentación de
   developers.mercadolibre.com.ar (ver fechas en `docs/paridad.md`).
9. **Versiones fijadas** (`save-exact`), `ignore-scripts=true`, lockfile
   commiteado, CI con `npm ci --ignore-scripts`, `npm audit` y escáner de
   secretos.
10. **Pruebas sin cuenta real**: simulador HTTP local (sin dependencias) que
    reproduce el contrato de la API, incluyendo cabeceras nuevas, 401/429/500 y
    rotación de refresh tokens. Ninguna prueba toca Mercado Libre.
11. **Nombre del repositorio**: `mercadolibre-sellers-mcp` (no existía en
    `produccionesallende-sudo`; se verificó por API antes de crearlo).
12. **Dependencias**: solo `@modelcontextprotocol/sdk` y `zod`. Las
    transitivas del SDK (express/hono/jose) no se usan (solo stdio) pero se
    auditan.
