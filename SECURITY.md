# Política de seguridad

## Modelo de seguridad (resumen)

- **Solo lectura por defecto.** El servidor arranca con `SOLO_LECTURA=true`.
  Las 6 herramientas capaces de modificar Mercado Libre quedan bloqueadas en
  `src/servidor.js` → `PoliticaEscritura.verificar()` antes de tocar la red.
  Solo `SOLO_LECTURA=false` (literal) las habilita; `ESCRITURAS_PERMITIDAS`
  permite habilitar un subconjunto. Cada escritura exige `confirmar=true`.
- **Tokens solo en tu computadora.** `~/.mercadolibre-sellers-mcp/cuentas.json`
  cifrado con AES-256-GCM (clave derivada por scrypt del Client Secret de tu
  app + `ML_CLAVE_ALMACEN` opcional), permisos 0600/0700, escritura atómica y
  bloqueo entre procesos. Nunca se envían a servidores propios ni de terceros.
- **Un solo destino de red:** `https://api.mercadolibre.com` (más el enlace a
  `auth.mercadolibre.*` que vos abrís en el navegador). El transporte rechaza
  cualquier otro host, no sigue redirecciones y manda el token solo en la
  cabecera `Authorization`.
- **Sin secretos en logs ni respuestas:** todo pasa por `src/redaccion.js`.
- **Sin auto-actualización, telemetría, instalador ni scripts post-install**
  (`.npmrc` → `ignore-scripts=true`).
- **Validación estricta de parámetros** (zod) y de rutas (`ruta\`…\``
  codifica cada segmento) para evitar inyección de rutas y SSRF.
- **Archivos locales:** `ml_subir_clip` solo lee dentro de `ML_DIRECTORIO_CLIPS`.

## Qué información NO sale de tu computadora

Client Secret, access tokens, refresh tokens, códigos de autorización, la lista
de vigilancia, el registro de auditoría y la configuración. Lo único que viaja
es lo que la API de Mercado Libre necesita para responder cada pedido.

## Reportar una vulnerabilidad

Abrí un *security advisory* privado en GitHub (pestaña **Security → Report a
vulnerability**) en el repositorio del proyecto. No publiques detalles en issues
públicos hasta que haya corrección.

## Buenas prácticas para el propietario

1. Revocá el acceso de la app en Mercado Libre si perdés la computadora:
   `ml_desconectar cuenta=… revocar_en_mercadolibre=true`, o desde tu cuenta de
   Mercado Libre (Seguridad → Aplicaciones conectadas), o renovando el Client
   Secret en el DevCenter (invalida todos los tokens).
2. No compartas `claude_desktop_config.json`: contiene tu Client Secret.
3. Mantené `SOLO_LECTURA=true` salvo cuando necesites escribir; revisá el
   registro `auditoria-escrituras.log` después.
4. Actualizá de forma controlada (ver README → "Actualizar") y corré
   `npm test` y `npm run auditoria` antes de usar una versión nueva.
