# Matriz de paridad funcional

**Estados:** ✅ implementada · ⬆️ mejorada · 🔁 sustituida · 🚫 no aplicable · ⏳ pendiente por limitación actual de la API.

## Herramientas MCP

| Función original | Función nueva | Estado | Notas |
| --- | --- | --- | --- |
| ml_conectar | ml_conectar | ⬆️ | PKCE S256 **+ state**, acepta URL completa o código, varias pendientes, 15 min; callback local opcional; sin redirect de terceros |
| ml_cuentas | ml_cuentas | ✅ | + fecha de conexión y marca "requiere reconexión" |
| ml_desconectar | ml_desconectar | ⬆️ | + `revocar_en_mercadolibre` (DELETE /users/{id}/applications/{app}) y `cuenta="todas"` |
| ml_version (chequeo contra GitHub del autor) | ml_estado | 🔁 | Sin red: versión, modo de seguridad, hosts, rutas de archivos. Actualización manual controlada |
| ml_ordenes | ml_ordenes | ⬆️ | paginación, estados validados, comprador |
| — | ml_orden | ⬆️ (nueva) | detalle de orden: ítems, pagos, variaciones |
| ml_panel_ventas | ml_panel_ventas | ⬆️ | ritmo diario, envíos por `GET /shipments/{id}` (formato nuevo) |
| ml_metricas | ml_metricas | ✅ | consolidado "todas" sin parsear texto |
| ml_envios | ml_envio | ⬆️ | flujo vigente (`shipping.id` → `/shipments/{id}` con `x-format-new`) |
| ml_publicaciones | ml_publicaciones | ⬆️ | `/items/bulk`, paginación, salud de la ficha |
| ml_publicacion | ml_publicacion | ⬆️ | + variaciones, atributos, garantía, descripción |
| ml_visitas | ml_visitas | ⬆️ | + serie diaria y total histórico |
| ml_actualizar_publicacion | ml_actualizar_publicacion | ⬆️ | bloqueada por defecto; `confirmar`; variaciones; antes/después; manejo de automatización de precios y 409 |
| ml_crear_publicacion | ml_crear_publicacion | ⬆️ | bloqueada por defecto; `confirmar`; atributos; moneda del sitio; solo URLs HTTPS |
| ml_preguntas | ml_preguntas | ⬆️ | título/precio/stock del ítem en bulk, filtro por ítem |
| ml_responder_pregunta | ml_responder_pregunta | ⬆️ | bloqueada por defecto; `confirmar`; filtro de datos de contacto |
| ml_comisiones | ml_comisiones | ⬆️ | + tipo, logística y peso facturable (doc oficial) |
| ml_precio_catalogo | ml_precio_catalogo | ⬆️ | + ganador actual |
| ml_buscar | ml_buscar | ⬆️ | + por vendedor, categoría y orden |
| ml_reputacion | ml_reputacion | ✅ | |
| ml_promociones | ml_promociones | ✅ | + fechas y aporte de ML |
| ml_aceptar_promocion | ml_aceptar_promocion | ⬆️ | bloqueada por defecto; `confirmar` |
| ml_auditar_publicaciones | ml_auditar_publicaciones | ⬆️ | + salud de ficha; mensaje según modo |
| ml_publicidad (endpoints dados de baja 05/2026) | ml_publicidad | 🔁 | reescrita sobre `/advertising/{SITE}/advertisers/{id}/product_ads/campaigns/search` y `ad_groups/search` (`api-version: 2`), ROAS |
| ml_rentabilidad | ml_rentabilidad | ⬆️ | comisión por tipo real; ads vía API vigente |
| ml_clips | ml_clips | ✅ | aclara cuando la API no está habilitada |
| ml_subir_clip | ml_subir_clip | ⬆️ | bloqueada por defecto; **solo archivos dentro de ML_DIRECTORIO_CLIPS** (cierra la lectura arbitraria de disco) |
| ml_borrar_clip | ml_borrar_clip | ⬆️ | bloqueada por defecto; `confirmar` |
| ml_vigilar | ml_vigilar | ✅ | |
| ml_novedades_competencia | ml_novedades_competencia | ✅ | |
| ml_historial_competencia | ml_historial_competencia | ✅ | 60 puntos |
| ml_descubrir_ganadores | ml_descubrir_ganadores | ✅ | `/items/bulk` |
| ml_tendencias | ml_tendencias | ✅ | hasta 50 |
| — | ml_categorias | ⬆️ (nueva) | predictor de categoría + explorar categoría |
| aviso de actualización en cada respuesta | — | 🚫 | eliminado por diseño (sin red a GitHub) |
| instalador `npx … instalar` | — | 🔁 | README con configuración manual (sin escribir el secreto por nosotros ni ejecutar `main` remoto) |
| comando `actualizar` (borra caché npx) | — | 🚫 | no aplica: instalación local fijada |

**Totales:** 32 originales → 34 nuevas (33 con equivalente + 2 nuevas; 2 originales sustituidas/eliminadas por diseño).

## Skills

| Skill original | Skill nueva | Estado | Notas |
| --- | --- | --- | --- |
| setup-ml | setup-ml | ✅ | |
| panel-ventas-ml | panel-ventas-ml | ✅ | |
| reporte-ventas-ml | reporte-ventas-ml | ⬆️ | la original llamaba a `ml_panel`, `ml_alertas`, `ml_caja`, `ml_facturacion` (inexistentes) |
| responder-preguntas-ml | responder-preguntas-ml | ⬆️ | la original llamaba a `ml_mensajes`, `ml_stock`, `ml_reclamos` (inexistentes) |
| mejorar-publicaciones-ml | mejorar-publicaciones-ml | ⬆️ | la original llamaba a 5 herramientas inexistentes |
| competencia-ml | competencia-ml | ⬆️ | la original llamaba a 5 herramientas inexistentes (CRM) |
| vigilancia-ml | vigilancia-ml | ✅ | |
| publicidad-ml | publicidad-ml | ✅ | |
| calculadora-ml | calculadora-ml | ✅ | |
| descubrir-ganadores-ml | descubrir-ganadores-ml | ✅ | |
| clips-ml | clips-ml | ✅ | con carpeta de clips |
| copiar-publicaciones-ml | copiar-publicaciones-ml | ✅ | |
| imagenes-ml | imagenes-ml | 🔁 | generador en Node (sin Python/cairosvg), salida SVG |
| visualizador-publicaciones-ml | visualizador-publicaciones-ml | 🔁 | panel propio sin fuentes externas |
| video-publicaciones-ml | — | 🚫 | dependía de HyperFrames (externo); el guion/storyboard se cubre en clips-ml |
| ugc-ml | — | 🚫 | dependía de avatares de IA externos |
| revisar-publicaciones-aldi | — | 🚫 | dependía de un GPT de ChatGPT del autor |

**Totales:** 17 originales → 14 nuevas (14 equivalentes, 3 no aplicables por depender de servicios de terceros).

## Pendientes por limitación de la API (⏳)

- **Búsqueda pública por texto** (`/sites/{s}/search?q=`): la documentación
  oficial ya no la lista para aplicaciones; puede devolver 403 según la app.
  `ml_buscar`, `ml_descubrir_ganadores busqueda=` y la vigilancia de tipo
  `busqueda` dependen de que siga disponible para tu aplicación.
- **Clips**: sin documentación pública estable; se intentan dos rutas y se
  informa si la cuenta no la tiene habilitada.
- **Product Ads por ítem**: la API vigente agrupa por *ad group*; se devuelve
  el grupo que contiene la publicación.
- **Precios por canal** (`/items/{id}/prices`): la escritura aún no está
  disponible en la API; se sigue usando `PUT /items/{id}`.
- **Callback local HTTP**: Mercado Libre exige redirect URI HTTPS al crear la
  app; el receptor local queda como opción experimental.
