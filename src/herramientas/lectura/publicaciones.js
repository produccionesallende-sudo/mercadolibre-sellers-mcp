// Publicaciones: listado, detalle, visitas, auditoría de calidad (solo lectura).
import { z } from 'zod';
import { cuentaParam, itemId, limiteParam, diasParam, clientePara } from '../comunes.js';
import { obtenerItems, idsPublicaciones } from '../../meli/recursos.js';
import { ruta } from '../../meli/transporte.js';
import { dinero, numero, limitarTexto } from '../../formato.js';
import { MeliError } from '../../errores.js';

const ATRIBUTOS_LISTA = 'id,title,price,currency_id,available_quantity,sold_quantity,status,permalink,catalog_listing,listing_type_id,health';

export const herramientas = [
  {
    name: 'ml_publicaciones',
    titulo: 'Mis publicaciones',
    lectura: true,
    descripcion: 'Lista las publicaciones del vendedor con precio, stock, vendidos, estado y tipo. Filtrable por estado (active, paused, closed).',
    esquema: { ...cuentaParam, estado: z.enum(['active', 'paused', 'closed', 'under_review', 'inactive']).optional(), limite: limiteParam(20, 100) },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const { ids, total } = await idsPublicaciones(c, { status: args.estado, limite: args.limite ?? 20 });
      if (!ids.length) return 'No hay publicaciones con ese filtro.';
      const det = await obtenerItems(c, ids, ATRIBUTOS_LISTA);
      const filas = ids.map((id) => det[id]).filter(Boolean).map((b) =>
        `- **${b.id}** · ${limitarTexto(b.title, 60)} · ${dinero(b.price, b.currency_id)} · stock ${numero(b.available_quantity)} · vendidos ${numero(b.sold_quantity)} · ${b.status} · ${b.listing_type_id ?? ''}${b.catalog_listing ? ' · catálogo' : ''}${b.health != null ? ` · salud ${Math.round(b.health * 100)}%` : ''}`);
      return `## Publicaciones (${numero(total)} en total, mostrando ${filas.length})\n` + filas.join('\n');
    },
  },
  {
    name: 'ml_publicacion',
    titulo: 'Detalle de una publicación',
    lectura: true,
    descripcion: 'Detalle completo de una publicación: precio, stock, ventas, tipo, categoría, condición, envío, variaciones, fotos (URLs), video, atributos principales, garantía y descripción.',
    esquema: { ...cuentaParam, item_id: itemId, incluir_descripcion: z.boolean().optional().describe('Incluir el texto de la descripción (default true)') },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const b = await c.get(ruta`/items/${args.item_id}`);
      let desc = null;
      if (args.incluir_descripcion !== false) {
        try { desc = (await c.get(ruta`/items/${args.item_id}/description`)).plain_text; } catch { /* sin descripción */ }
      }
      const attrs = (b.attributes || []).filter((a) => a.value_name).slice(0, 12).map((a) => `${a.name}: ${a.value_name}`).join(' · ');
      const vars = (b.variations || []).slice(0, 10).map((v) => `  - ${v.id}: ${(v.attribute_combinations || []).map((x) => `${x.name} ${x.value_name}`).join(' / ')} · ${dinero(v.price, b.currency_id)} · stock ${numero(v.available_quantity)}`);
      const garantia = (b.sale_terms || []).filter((t) => /WARRANTY/.test(t.id)).map((t) => t.value_name).join(' · ');
      return [
        `## ${b.title}`,
        `- **ID:** ${b.id} · **Categoría:** ${b.category_id} · **Condición:** ${b.condition ?? '—'} · **Tipo:** ${b.listing_type_id}${b.catalog_listing ? ' · catálogo' : ''}${b.catalog_product_id ? ' (' + b.catalog_product_id + ')' : ''}`,
        `- **Precio:** ${dinero(b.price, b.currency_id)}${b.original_price ? ` (antes ${dinero(b.original_price, b.currency_id)})` : ''} · **Stock:** ${numero(b.available_quantity)} · **Vendidos:** ${numero(b.sold_quantity)}`,
        `- **Estado:** ${b.status}${b.sub_status?.length ? ' (' + b.sub_status.join(', ') + ')' : ''}${b.health != null ? ` · salud ${Math.round(b.health * 100)}%` : ''}`,
        `- **Envío:** ${b.shipping?.logistic_type ?? b.shipping?.mode ?? '—'}${b.shipping?.free_shipping ? ' · envío gratis' : ''}${b.shipping?.local_pick_up ? ' · retiro en persona' : ''}`,
        `- **Video:** ${b.video_id ? '✅ tiene' : '❌ sin video clásico'} · **Fotos:** ${(b.pictures || []).length}${b.pictures?.length ? '\n  ' + b.pictures.slice(0, 6).map((p) => p.secure_url || p.url).join('\n  ') : ''}`,
        garantia ? `- **Garantía:** ${garantia}` : '',
        attrs ? `- **Atributos:** ${attrs}` : '',
        vars.length ? `- **Variaciones (${b.variations.length}):**\n${vars.join('\n')}` : '',
        `- **Link:** ${b.permalink}`,
        desc ? `\n### Descripción\n${limitarTexto(desc, 1500)}` : '',
      ].filter(Boolean).join('\n');
    },
  },
  {
    name: 'ml_visitas',
    titulo: 'Visitas de una publicación',
    lectura: true,
    descripcion: 'Visitas de una publicación en una ventana de días (y total histórico), para medir tráfico y conversión.',
    esquema: { ...cuentaParam, item_id: itemId, dias: diasParam(30, 150) },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const dias = args.dias ?? 30;
      const r = await c.get(ruta`/items/${args.item_id}/visits/time_window`, { last: dias, unit: 'day' });
      let total = null;
      try { total = (await c.get('/visits/items', { ids: args.item_id }))?.[args.item_id] ?? null; } catch { /* opcional */ }
      const serie = (r.results || []).slice(-7).map((p) => `${String(p.date).slice(5, 10)}: ${p.total}`).join(' · ');
      return `**${args.item_id}**: ${numero(r.total_visits ?? 0)} visitas en los últimos ${dias} días${total != null ? ` · ${numero(total)} históricas (2 años)` : ''}.${serie ? `\nÚltimos 7 días → ${serie}` : ''}`;
    },
  },
  {
    name: 'ml_auditar_publicaciones',
    titulo: 'Auditar mis publicaciones',
    lectura: true,
    descripcion: 'Semáforo de calidad por publicación con acciones concretas: título corto o con relleno, pocas fotos, descripción pobre, sin envío gratis, stock crítico, tipo de publicación de baja exposición, sin video, catálogo perdido, salud baja. Devuelve las peores primero. Solo lee: los cambios se proponen, no se aplican.',
    esquema: { ...cuentaParam, limite: limiteParam(10, 30), estado: z.enum(['active', 'paused']).optional().describe('default active') },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const { ids } = await idsPublicaciones(c, { status: args.estado ?? 'active', limite: args.limite ?? 10 });
      if (!ids.length) return 'No hay publicaciones para auditar con ese filtro.';
      const auditorias = [];
      for (const id of ids) {
        const b = await c.get(ruta`/items/${id}`);
        let desc = null;
        try { desc = (await c.get(ruta`/items/${id}/description`)).plain_text; } catch { /* sin descripción */ }
        const problemas = [];
        const titulo = b.title || '';
        if (titulo.length < 40) problemas.push(`título corto (${titulo.length}/60): sumale marca, modelo y atributo clave`);
        if (/env[ií]o gratis|oferta|promo|!!|aprovech|el mejor/i.test(titulo)) problemas.push('título con relleno (oferta/envío gratis/promo): Mercado Libre lo penaliza — dejá producto + marca + modelo + atributos');
        if ((b.pictures?.length ?? 0) < 3) problemas.push(`solo ${b.pictures?.length ?? 0} foto(s): subí a 6+ (fondo blanco la primera)`);
        if (!desc || desc.trim().length < 200) problemas.push('descripción vacía o muy corta: agregá qué incluye, medidas, compatibilidades y preguntas frecuentes');
        if (!b.shipping?.free_shipping) problemas.push('sin envío gratis: posiciona y convierte menos (evaluá absorberlo en el precio)');
        if ((b.available_quantity ?? 0) === 0) problemas.push('SIN STOCK: reponé o pausá — sin stock pierde posicionamiento');
        else if ((b.available_quantity ?? 0) < 3) problemas.push(`stock crítico (${b.available_quantity})`);
        if (b.status !== 'active') problemas.push(`está ${b.status}: no vende hasta reactivarla`);
        if (['free', 'bronze'].includes(b.listing_type_id)) problemas.push(`tipo ${b.listing_type_id}: casi sin exposición — pasala a Clásica o Premium`);
        if (!b.video_id) problemas.push('sin video clásico: las publicaciones con video convierten más (ver ml_clips)');
        if (b.health != null && b.health < 0.7) problemas.push(`salud ${Math.round(b.health * 100)}%: completá la ficha técnica (atributos faltantes)`);
        if (b.catalog_listing) {
          try {
            const ptw = await c.get(ruta`/items/${id}/price_to_win`, { version: 'v2' });
            if (ptw.status && ptw.status !== 'winning') problemas.push(`perdiendo el catálogo: ganás con ${ptw.price_to_win != null ? dinero(ptw.price_to_win, b.currency_id) : 'mejor precio/envío'} (validar margen antes)`);
          } catch (e) { if (!(e instanceof MeliError)) throw e; }
        }
        auditorias.push({ id, titulo, semaforo: problemas.length === 0 ? '🟢' : problemas.length <= 2 ? '🟡' : '🔴', problemas });
      }
      auditorias.sort((a, b) => b.problemas.length - a.problemas.length);
      const rojas = auditorias.filter((a) => a.semaforo === '🔴').length, amarillas = auditorias.filter((a) => a.semaforo === '🟡').length;
      const filas = auditorias.map((a) => `### ${a.semaforo} ${a.id} — ${a.titulo}\n` + (a.problemas.length ? a.problemas.map((p) => '- ' + p).join('\n') : '- Sin problemas detectados en el checklist básico'));
      return `# Auditoría de publicaciones (${auditorias.length})\n**${rojas} 🔴 urgentes · ${amarillas} 🟡 mejorables · ${auditorias.length - rojas - amarillas} 🟢 OK**\n\n` + filas.join('\n\n') +
        `\n\n${ctx.config.soloLectura ? '🔒 El MCP está en solo lectura: los cambios se aplican desde el panel de Mercado Libre, o habilitando escritura (ver README).' : 'Para aplicar precio/stock/estado: ml_actualizar_publicacion, siempre con confirmación explícita por ítem.'}`;
    },
  },
];
