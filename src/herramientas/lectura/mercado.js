// Preguntas, precios, comisiones, competencia, reputación, promociones,
// tendencias, categorías y descubrimiento de ganadores (solo lectura).
import { z } from 'zod';
import { cuentaParam, itemId, sitioParam, categoriaParam, limiteParam, clientePara } from '../comunes.js';
import { obtenerItems } from '../../meli/recursos.js';
import { ruta } from '../../meli/transporte.js';
import { dinero, numero, pct, fecha, limitarTexto } from '../../formato.js';
import { MeliError } from '../../errores.js';

export const herramientas = [
  {
    name: 'ml_preguntas',
    titulo: 'Preguntas de compradores',
    lectura: true,
    descripcion: 'Preguntas de compradores; por defecto las pendientes de respuesta (UNANSWERED), con el título de la publicación.',
    esquema: { ...cuentaParam, estado: z.enum(['UNANSWERED', 'ANSWERED']).optional(), limite: limiteParam(15, 50), item_id: itemId.optional() },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const r = await c.get('/questions/search', { seller_id: c.userId, item: args.item_id, status: args.estado ?? 'UNANSWERED', limit: args.limite ?? 15, sort_fields: 'date_created', sort_types: 'DESC', api_version: 4 });
      const qs = r.questions || [];
      if (!qs.length) return args.estado === 'ANSWERED' ? 'No hay preguntas respondidas en el rango.' : '🎉 No hay preguntas pendientes.';
      const det = await obtenerItems(c, [...new Set(qs.map((q) => q.item_id))], 'id,title,price,currency_id,available_quantity');
      const filas = qs.map((q) => {
        const it = det[q.item_id];
        return `- **[${q.id}]** ${fecha(q.date_created)} · ${it ? `"${limitarTexto(it.title, 50)}" (${dinero(it.price, it.currency_id)}, stock ${it.available_quantity})` : q.item_id}\n  💬 "${q.text}"${q.answer?.text ? `\n  ↳ ${q.answer.text}` : ''}`;
      });
      return `## Preguntas ${args.estado === 'ANSWERED' ? 'respondidas' : 'pendientes'} (${r.total ?? qs.length})\n` + filas.join('\n') + (args.estado !== 'ANSWERED' ? `\n\n${ctx.config.soloLectura ? '🔒 Solo lectura: las respuestas se publican desde el panel de Mercado Libre.' : 'Para responder: ml_responder_pregunta (confirmar el texto exacto antes).'}` : '');
    },
  },
  {
    name: 'ml_comisiones',
    titulo: 'Comisiones y costos de venta',
    lectura: true,
    descripcion: 'Cuánto cobra Mercado Libre por vender a un precio dado, por tipo de publicación (comisión % + costo fijo). Para el costo fijo exacto conviene pasar categoría, tipo logístico y peso facturable (obligatorio en Argentina según la documentación).',
    esquema: { ...cuentaParam, precio: z.number().positive(), categoria: categoriaParam, sitio: sitioParam, tipo_publicacion: z.enum(['gold_special', 'gold_pro', 'free', 'bronze', 'silver', 'gold', 'gold_premium']).optional(), logistica: z.enum(['fulfillment', 'cross_docking', 'drop_off', 'xd_drop_off', 'self_service', 'not_specified']).optional(), peso_gramos: z.number().int().positive().optional().describe('Peso facturable en gramos (billable_weight)') },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const sitio = args.sitio || (await c.sitio());
      const r = await c.get(ruta`/sites/${sitio}/listing_prices`, { price: args.precio, category_id: args.categoria, listing_type_id: args.tipo_publicacion, logistic_type: args.logistica, billable_weight: args.peso_gramos });
      const lista = Array.isArray(r) ? r : [r];
      const filas = lista.filter(Boolean).map((t) => `- **${t.listing_type_name ?? t.listing_type_id}**: comisión ${dinero(t.sale_fee_amount, t.currency_id)}${t.sale_fee_details ? ` (${pct(t.sale_fee_details.percentage_fee)} + fijo ${dinero(t.sale_fee_details.fixed_fee ?? 0, t.currency_id)})` : ''}${t.listing_fee_amount ? ` · costo de publicar ${dinero(t.listing_fee_amount, t.currency_id)}` : ''}`);
      return `## Costo de vender a ${dinero(args.precio)} en ${sitio}${args.categoria ? ' · ' + args.categoria : ''}\n` + (filas.join('\n') || 'Sin datos para ese precio.') + (args.peso_gramos ? '' : '\n\nℹ️ Sin `peso_gramos` y `logistica` el costo fijo puede diferir del real.');
    },
  },
  {
    name: 'ml_precio_catalogo',
    titulo: 'Precio para ganar el catálogo',
    lectura: true,
    descripcion: 'Para publicaciones de catálogo: si estás ganando la buy box, qué precio necesitás para ganarla y qué factores además del precio influyen.',
    esquema: { ...cuentaParam, item_id: itemId },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const r = await c.get(ruta`/items/${args.item_id}/price_to_win`, { version: 'v2' });
      const estado = r.status === 'winning' ? '🏆 GANANDO el catálogo' : r.status === 'listed' ? '❌ Perdiendo (hay un competidor ganando)' : `ℹ️ ${r.status ?? 'sin datos'}`;
      return [`## ${args.item_id} — catálogo${r.catalog_product_id ? ' (' + r.catalog_product_id + ')' : ''}`, `- ${estado}`,
        `- **Tu precio:** ${dinero(r.current_price, r.currency_id)} · **Precio para ganar:** ${dinero(r.price_to_win, r.currency_id)}`,
        r.winner ? `- **Ganador actual:** ${r.winner.seller_id ?? r.winner.item_id ?? '—'} a ${dinero(r.winner.price, r.currency_id)}` : '',
        r.boosts?.length ? `- **Factores además del precio:** ${r.boosts.map((b) => `${b.id}${b.status ? ' (' + b.status + ')' : ''}`).join(', ')}` : '',
      ].filter(Boolean).join('\n');
    },
  },
  {
    name: 'ml_buscar',
    titulo: 'Buscar en Mercado Libre',
    lectura: true,
    descripcion: 'Busca publicaciones en Mercado Libre por texto, por vendedor (nickname o id) o por categoría, para mirar competencia y precios de mercado. Nota: la búsqueda pública por texto puede estar restringida por Mercado Libre para algunas aplicaciones; en ese caso se informa el error.',
    esquema: { ...cuentaParam, consulta: z.string().min(1).max(200).optional().describe('Texto a buscar, ej. "termo acero 1 litro"'), vendedor: z.string().min(1).max(60).optional().describe('Nickname o id de un vendedor'), categoria: categoriaParam, limite: limiteParam(10, 50), sitio: sitioParam, orden: z.enum(['relevance', 'price_asc', 'price_desc']).optional() },
    async run(args, ctx) {
      if (!args.consulta && !args.vendedor && !args.categoria) return 'Indicá consulta (texto), vendedor o categoria.';
      const c = await clientePara(ctx, args);
      const sitio = args.sitio || (await c.sitio());
      const q = { q: args.consulta, category: args.categoria, limit: args.limite ?? 10, sort: args.orden };
      if (args.vendedor) q[/^\d+$/.test(args.vendedor) ? 'seller_id' : 'nickname'] = args.vendedor;
      const r = await c.get(ruta`/sites/${sitio}/search`, q);
      const filas = (r.results || []).map((x) => `- **${x.id}** · ${limitarTexto(x.title, 60)} · ${dinero(x.price, x.currency_id)} · ${x.seller?.nickname ?? x.seller?.id ?? '—'}${x.shipping?.free_shipping ? ' · envío gratis' : ''}${x.sold_quantity ? ` · ${numero(x.sold_quantity)} vendidos` : ''}${x.catalog_listing ? ' · catálogo' : ''}`);
      return `## Búsqueda en ${sitio}${args.consulta ? ` "${args.consulta}"` : ''}${args.vendedor ? ' · vendedor ' + args.vendedor : ''}${args.categoria ? ' · ' + args.categoria : ''} (${numero(r.paging?.total ?? 0)} resultados)\n` + (filas.join('\n') || 'Sin resultados.');
    },
  },
  {
    name: 'ml_reputacion',
    titulo: 'Reputación del vendedor',
    lectura: true,
    descripcion: 'Color de reputación, nivel MercadoLíder, ventas y tasas de reclamos, demoras y cancelaciones.',
    esquema: { ...cuentaParam },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const me = await c.me();
      const rep = me.seller_reputation || {}, m = rep.metrics || {};
      return [`## Reputación de ${me.nickname}`,
        `- **Nivel:** ${rep.level_id ?? '—'}${rep.power_seller_status ? ` · MercadoLíder: ${rep.power_seller_status}` : ''}`,
        `- **Ventas (período evaluado):** ${numero(rep.transactions?.completed ?? rep.transactions?.total)} completadas · ${numero(rep.transactions?.canceled)} canceladas`,
        `- **Reclamos:** ${pct((m.claims?.rate ?? 0) * 100, 2)} (${m.claims?.value ?? 0}) · **Demoras en despacho:** ${pct((m.delayed_handling_time?.rate ?? 0) * 100, 2)} · **Cancelaciones:** ${pct((m.cancellations?.rate ?? 0) * 100, 2)}`,
        m.sales?.completed != null ? `- **Ventas del período de medición:** ${numero(m.sales.completed)} (${m.sales.period ?? ''})` : '',
      ].filter(Boolean).join('\n');
    },
  },
  {
    name: 'ml_promociones',
    titulo: 'Promociones ofrecidas',
    lectura: true,
    descripcion: 'Campañas y promociones que Mercado Libre ofrece al vendedor; con promocion_id y tipo, lista las publicaciones elegibles con el precio sugerido y cuánto aporta Mercado Libre.',
    esquema: { ...cuentaParam, promocion_id: z.string().min(1).max(80).optional(), tipo: z.string().regex(/^[A-Z_]{2,40}$/).optional().describe('DEAL, DOD, MARKETPLACE_CAMPAIGN, SELLER_CAMPAIGN, PRICE_DISCOUNT… (viene en la lista)'), limite: limiteParam(50, 50) },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      if (!args.promocion_id) {
        const r = await c.get(ruta`/seller-promotions/users/${c.userId}`, { app_version: 'v2' });
        const ps = r.results || [];
        if (!ps.length) return 'Mercado Libre no está ofreciendo promociones ahora.';
        return '## Promociones disponibles\n' + ps.map((p) => `- **${p.id}** · ${p.name ?? p.type} · tipo ${p.type} · ${p.status ?? ''}${p.start_date ? ` · ${fecha(p.start_date)} → ${fecha(p.finish_date)}` : ''}${p.benefits?.meli_percent != null ? ` · pone ML ${p.benefits.meli_percent}%` : ''}`).join('\n') + '\n\nPublicaciones elegibles: ml_promociones promocion_id=… tipo=…';
      }
      if (!args.tipo) return 'Indicá también el `tipo` de la promoción (aparece en la lista).';
      const r = await c.get(ruta`/seller-promotions/promotions/${args.promocion_id}/items`, { promotion_type: args.tipo, app_version: 'v2', limit: args.limite ?? 50 });
      const its = r.results || [];
      if (!its.length) return 'Esa promoción no tiene publicaciones elegibles.';
      const filas = its.map((i) => {
        const final = i.suggested_discounted_price ?? i.min_discounted_price ?? i.price;
        return `- **${i.id ?? i.item_id}** · ${dinero(i.original_price ?? i.price)} → ${dinero(final)}${i.max_discounted_price ? ` (rango ${dinero(i.min_discounted_price)}–${dinero(i.max_discounted_price)})` : ''} · pone ML ${i.meli_percentage ?? 0}% · ${i.status ?? ''}`;
      });
      return `## Publicaciones elegibles (${its.length}${r.paging?.total ? ' de ' + r.paging.total : ''})\n` + filas.join('\n') + (ctx.config.soloLectura ? '\n\n🔒 Solo lectura: para aceptar una promoción usá el panel de Mercado Libre o habilitá escritura.' : '\n\nPara activar: ml_aceptar_promocion (confirmar por ítem).');
    },
  },
  {
    name: 'ml_tendencias',
    titulo: 'Tendencias de búsqueda',
    lectura: true,
    descripcion: 'Las búsquedas más populares del sitio o de una categoría (top 50 oficial de Mercado Libre, se actualiza semanalmente).',
    esquema: { ...cuentaParam, categoria: categoriaParam, sitio: sitioParam, limite: limiteParam(20, 50) },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const sitio = args.sitio || (await c.sitio());
      const r = await c.get(args.categoria ? ruta`/trends/${sitio}/${args.categoria}` : ruta`/trends/${sitio}`);
      const ts = (Array.isArray(r) ? r : []).slice(0, args.limite ?? 20);
      return `## Tendencias en ${sitio}${args.categoria ? ' · ' + args.categoria : ''}\n` + (ts.map((t, i) => `${i + 1}. ${t.keyword}`).join('\n') || 'Sin datos.');
    },
  },
  {
    name: 'ml_categorias',
    titulo: 'Predecir / explorar categorías',
    lectura: true,
    descripcion: 'Dado un título de producto, sugiere la categoría oficial (predictor de dominios); o explora una categoría: nombre, ruta, hijas y configuración (si exige catálogo, tipos de publicación). Útil antes de crear una publicación.',
    esquema: { ...cuentaParam, titulo: z.string().min(3).max(120).optional().describe('Título del producto para predecir categoría'), categoria: categoriaParam, sitio: sitioParam },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const sitio = args.sitio || (await c.sitio());
      if (args.categoria) {
        const cat = await c.get(ruta`/categories/${args.categoria}`);
        return [`## ${cat.name} (${cat.id})`,
          `- **Ruta:** ${(cat.path_from_root || []).map((p) => p.name).join(' › ')}`,
          `- **Publicaciones:** ${numero(cat.total_items_in_this_category)} · **Catálogo obligatorio:** ${cat.settings?.catalog_domain ? 'sí' : 'no'} · **Tipos:** ${(cat.settings?.listing_allowed ? 'permite publicar' : 'no permite publicar directamente')}`,
          cat.children_categories?.length ? `- **Subcategorías:** ${cat.children_categories.slice(0, 20).map((h) => `${h.name} (${h.id})`).join(' · ')}` : '- Sin subcategorías (categoría hoja).',
        ].join('\n');
      }
      if (!args.titulo) return 'Indicá `titulo` para predecir la categoría o `categoria` para explorarla.';
      const r = await c.get(ruta`/sites/${sitio}/domain_discovery/search`, { q: args.titulo, limit: 5 });
      const lista = Array.isArray(r) ? r : [];
      if (!lista.length) return `Sin sugerencias de categoría para "${args.titulo}".`;
      return `## Categorías sugeridas para "${args.titulo}"\n` + lista.map((x, i) => `${i + 1}. **${x.category_name}** (${x.category_id}) · dominio ${x.domain_name ?? x.domain_id}${x.attributes?.length ? ' · ' + x.attributes.map((a) => `${a.name}: ${a.value_name}`).join(', ') : ''}`).join('\n');
    },
  },
  {
    name: 'ml_descubrir_ganadores',
    titulo: 'Descubrir artículos ganadores',
    lectura: true,
    descripcion: 'Por CATEGORÍA: ranking oficial de más vendidos (highlights) + tendencias de esa categoría. Por BÚSQUEDA: análisis de mercado de una keyword (competencia, rango de precios, envío gratis, vendedores que dominan). Datos reales de la API, sin inventar.',
    esquema: { ...cuentaParam, categoria: categoriaParam, busqueda: z.string().min(1).max(200).optional(), sitio: sitioParam },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const sitio = args.sitio || (await c.sitio());
      if (args.categoria) {
        const hl = await c.get(ruta`/highlights/${sitio}/category/${args.categoria}`);
        const entradas = (hl.content || []).slice(0, 20);
        const ids = entradas.filter((x) => x.type === 'ITEM').map((x) => x.id);
        const det = ids.length ? await obtenerItems(c, ids, 'id,title,price,currency_id,sold_quantity,catalog_listing') : {};
        const filas = entradas.map((x) => {
          const b = det[x.id] || {};
          return `${x.position}. **${b.title || x.id}** (${x.type})${b.price ? ' — ' + dinero(b.price, b.currency_id) : ''}${b.sold_quantity ? ` · ${numero(b.sold_quantity)} vendidos` : ''}${b.catalog_listing ? ' · 🏷️ catálogo' : ''}`;
        });
        let trends = [];
        try { const t = await c.get(ruta`/trends/${sitio}/${args.categoria}`); trends = (Array.isArray(t) ? t : []).slice(0, 8).map((x) => x.keyword); } catch (e) { if (!(e instanceof MeliError)) throw e; }
        return `# 🏆 Artículos ganadores — categoría ${args.categoria}\n\n## Ranking oficial de más vendidos\n` + (filas.join('\n') || 'Esta categoría no publica ranking.') +
          (trends.length ? '\n\n## 📈 Qué busca la gente en la categoría\n' + trends.map((k, i) => `${i + 1}. ${k}`).join('\n') : '') +
          '\n\n**Cómo leerlo:** un producto en el ranking que además coincide con una tendencia es demanda validada. Antes de entrar: ml_buscar para medir competencia y ml_comisiones / ml_rentabilidad para validar margen.';
      }
      if (args.busqueda) {
        const r = await c.get(ruta`/sites/${sitio}/search`, { q: args.busqueda, limit: 20 });
        const items = r.results || [];
        if (!items.length) return `Sin resultados para "${args.busqueda}".`;
        const total = r.paging?.total ?? items.length;
        const precios = items.map((x) => x.price).filter((n) => n > 0).sort((a, b) => a - b);
        const mediana = precios[Math.floor(precios.length / 2)];
        const gratis = items.filter((x) => x.shipping?.free_shipping).length;
        const porVendedor = {};
        for (const x of items) { const v = x.seller?.nickname || String(x.seller?.id || '?'); porVendedor[v] = (porVendedor[v] || 0) + 1; }
        const dominan = Object.entries(porVendedor).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
        let enTendencias = false;
        try { const t = await c.get(ruta`/trends/${sitio}`); const b = args.busqueda.toLowerCase(); enTendencias = (Array.isArray(t) ? t : []).some((x) => x.keyword.toLowerCase().includes(b) || b.includes(x.keyword.toLowerCase())); } catch (e) { if (!(e instanceof MeliError)) throw e; }
        const top = items.slice(0, 5).map((x, i) => `${i + 1}. **${limitarTexto(x.title, 60)}** — ${dinero(x.price, x.currency_id)} · ${x.seller?.nickname || '—'}${x.shipping?.free_shipping ? ' · 🚚 gratis' : ''}`);
        const senal = enTendencias && !dominan.length ? '🟢 ALTA — demanda validada y top repartido' : enTendencias ? '🟡 MEDIA — hay demanda pero el top tiene dueños' : '⚪ a validar — no aparece hoy en tendencias del sitio';
        return `# 🔎 Análisis de mercado: "${args.busqueda}" (${sitio})\n\n- **Competencia:** ${numero(total)} publicaciones\n- **Precios (top 20):** ${dinero(precios[0])} a ${dinero(precios[precios.length - 1])} · mediana ${dinero(mediana)}\n- **Envío gratis:** ${gratis}/${items.length} del top${gratis / items.length > 0.6 ? ' (casi obligatorio para competir)' : ''}\n- **En tendencias del sitio:** ${enTendencias ? '✅ sí' : 'no'}\n` +
          (dominan.length ? `- **Vendedores que dominan el top:** ${dominan.map(([v, n]) => `${v} (${n})`).join(', ')}\n` : '- **Top repartido:** ningún vendedor domina\n') +
          '\n## Top 5 del momento\n' + top.join('\n') + `\n\n**Señal de oportunidad:** ${senal}. Validá margen con ml_comisiones y sumá la búsqueda a ml_vigilar para seguir su evolución.`;
      }
      return 'Indicá categoria (ej. MLA1055) para el ranking de más vendidos, o busqueda (keyword) para el análisis de mercado.';
    },
  },
];
