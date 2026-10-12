# Historial de cambios

## 1.0.0 — 2026-10-12

Primera versión, escrita desde cero.

- Servidor MCP por stdio con 34 herramientas (28 de lectura, 6 de escritura).
- Solo lectura por defecto (`SOLO_LECTURA=true`), escrituras habilitables por
  lista (`ESCRITURAS_PERMITIDAS`) y con `confirmar=true` obligatorio.
- OAuth 2.0 directo contra Mercado Libre: PKCE S256 + `state`, canje y refresh
  con bloqueo entre procesos; redirect URI bajo control del propietario
  (página estática propia o cualquier URL HTTPS propia; soporte experimental
  de callback local).
- Almacén de tokens cifrado (AES-256-GCM / scrypt), permisos restrictivos,
  escritura atómica.
- Adaptado a la API vigente: `/items/bulk`, `GET /shipments/{id}` con
  `x-format-new`, Product Ads `/advertising/{SITE}/advertisers/{id}/…` con
  `api-version: 2`, revocación `DELETE /users/{id}/applications/{app}`.
- Vigilancia de competencia local con historial; calculadora de rentabilidad;
  panel de ventas; auditoría de publicaciones; clips.
- 14 skills propias, panel visualizador y plantillas SVG con generador en Node.
- Suite de 50 pruebas con simulador local de la API (sin cuenta real).
- Escáner de secretos y CI en GitHub Actions.
