// Product Ads (API vigente 2026: /advertising/{SITE}/advertisers/{adv}/product_ads/...)
// y calculadora de rentabilidad. Solo lectura.
import { z } from 'zod';
import { cuentaParam, itemId, diasParam, clientePara } from '../comunes.js';
import { anunciantePads } from '../../meli/recursos.js';
import { ruta } from '../../meli/transporte.js';
import { dinero, numero, pct, isoDia, tabla } from '../../formato.js';
import { MeliError } from '../../errores.js';

const METRICAS = 'clicks,prints,cost,cpc,acos,roas,units_quantity,total_amount,direct_units_quantity,indirect_units_quantity';
const SIN_ADS = 'La cuenta no tiene Publicidad (Product Ads) habilitada o no tiene campañas visibles por API. Se activa desde el panel de Publicidad de Mercado Libre.';

async function metricasItem(c, sitio, adv, itemIdValor, desde, hasta) {
  const q = { 'filters[item_ids]': itemIdValor, date_from: isoDia(desde), date_to: isoDia(hasta), metrics: METRICAS, limit: 10 };
  try {
    const r = await c._pedir({ metodo: 'GET', ruta: ruta`/advertising/${sitio}/advertisers/${adv}/product_ads/ad_groups/search`, query: q, headers: { 'api-version': '2' } });
    return r?.results || r?.ad_groups || [];
  } catch (e) {
    if (e instanceof MeliError && [400, 403, 404].includes(e.status)) return null;
    throw e;
  }
}

export const herramientas = [
  {
    name: 'ml_publicidad',
    titulo: 'Métricas de Product Ads',
    lectura: true,
    descripcion: 'Métricas de Product Ads del período: sin item_id, las campañas del anunciante (estado, presupuesto, inversión, clics, ACOS/ROAS, unidades); con item_id, el grupo de anuncios de esa publicación. Máximo 90 días hacia atrás (límite de la API); los datos se actualizan una vez por día.',
    esquema: { ...cuentaParam, item_id: itemId.optional(), dias: diasParam(30, 90) },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const sitio = await c.sitio();
      const dias = args.dias ?? 30;
      const hasta = Date.now(), desde = hasta - (dias - 1) * 86400000;
      const adv = await anunciantePads(c);
      if (!adv) return SIN_ADS;
      const advId = adv.advertiser_id ?? adv.id;
      if (args.item_id) {
        const grupos = await metricasItem(c, sitio, advId, args.item_id, desde, hasta);
        if (!grupos?.length) return `**${args.item_id}** no está en ninguna campaña de Product Ads (o la API no devolvió métricas).`;
        const g = grupos[0];
        const m = g.metrics || g.metrics_summary || g;
        const ctr = m.prints ? (m.clicks / m.prints) * 100 : 0;
        return [`# 📣 Product Ads de ${args.item_id} — últimos ${dias} día(s)`,
          `- **Campaña:** ${g.campaign_name ?? g.campaign_id ?? '—'} · **Grupo:** ${g.name ?? g.id ?? '—'} · **Estado:** ${g.status ?? '—'}`,
          `- **Inversión:** ${dinero(m.cost, '$', 0)} · **Impresiones:** ${numero(m.prints)} · **Clics:** ${numero(m.clicks)} (CTR ${pct(ctr, 2)})`,
          `- **CPC:** ${dinero(m.cpc ?? (m.clicks ? m.cost / m.clicks : 0), '$', 0)} · **Ventas por ads:** ${numero(m.units_quantity)} unidad(es) · ${dinero(m.total_amount, '$', 0)}`,
          `- **ACOS:** ${m.acos != null ? pct(m.acos) : 's/d'} · **ROAS:** ${m.roas != null ? numero(m.roas, 2) : 's/d'}`,
          '', '¿El ACOS aguanta? Validalo contra el margen real con ml_rentabilidad.'].join('\n');
      }
      let r;
      try {
        r = await c._pedir({ metodo: 'GET', ruta: ruta`/advertising/${sitio}/advertisers/${advId}/product_ads/campaigns/search`, query: { date_from: isoDia(desde), date_to: isoDia(hasta), metrics: METRICAS, limit: 50 }, headers: { 'api-version': '2' } });
      } catch (e) { if (e instanceof MeliError && [400, 403, 404].includes(e.status)) return SIN_ADS; throw e; }
      const lista = r?.results || r?.campaigns || [];
      if (!lista.length) return SIN_ADS;
      const filas = lista.map((k) => { const m = k.metrics || {}; return [k.name || k.id, k.status || '—', dinero(k.budget, '$', 0), dinero(m.cost, '$', 0), numero(m.clicks), m.acos != null ? pct(m.acos) : (m.roas != null ? 'ROAS ' + numero(m.roas, 2) : '—'), numero(m.units_quantity)]; });
      const total = lista.reduce((s, k) => s + (Number(k.metrics?.cost) || 0), 0);
      return `# 📣 Campañas de Product Ads — últimos ${dias} día(s)\n\n` + tabla(['Campaña', 'Estado', 'Presupuesto/día', 'Invertido', 'Clics', 'ACOS', 'Unidades'], filas) +
        `\n\n**Inversión total del período:** ${dinero(total, '$', 0)}. Publicación puntual: ml_publicidad item_id=… · ¿Cierra el ACOS?: ml_rentabilidad.`;
    },
  },
  {
    name: 'ml_rentabilidad',
    titulo: 'Calculadora de rentabilidad real',
    lectura: true,
    descripcion: 'Desglose peso por peso de un producto: precio − comisión real de Mercado Libre − publicidad por unidad (Product Ads del período) − impuestos − costo de envío − costo del producto = ganancia neta, margen y ACOS máximo que aguanta. Costo e impuestos los pone el usuario (nunca se inventan).',
    esquema: { ...cuentaParam,
      item_id: itemId.optional().describe('Si se indica, trae precio, tipo de publicación y gasto de ads reales'),
      precio: z.number().positive().optional().describe('Precio de venta; con item_id se toma el de la publicación'),
      costo: z.number().min(0).optional().describe('Costo del producto para el vendedor — SIEMPRE preguntarlo'),
      impuestos_pct: z.number().min(0).max(60).optional().describe('% de impuestos sobre el precio — SIEMPRE preguntarlo'),
      costo_envio: z.number().min(0).optional().describe('Lo que paga el vendedor de envío por unidad (default 0)'),
      dias_ads: diasParam(30, 90) },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const d0 = (n) => dinero(n, '$', 0);
      let precio = args.precio, tipo = 'gold_special', titulo = null, categoria = null, moneda = '$';
      if (args.item_id) {
        const b = await c.get(ruta`/items/${args.item_id}`, { attributes: 'id,title,price,listing_type_id,category_id,currency_id' });
        precio = precio ?? b.price; tipo = b.listing_type_id || tipo; titulo = b.title; categoria = b.category_id; moneda = b.currency_id || moneda;
      }
      const faltan = [];
      if (!precio) faltan.push('el **precio de venta** (o pasame el item_id y lo traigo)');
      if (args.costo == null) faltan.push('el **costo del producto** (lo que te sale a vos)');
      if (args.impuestos_pct == null) faltan.push('el **% de impuestos** sobre la venta (según tu situación fiscal)');
      if (faltan.length) return 'Para calcular la rentabilidad real me falta:\n- ' + faltan.join('\n- ');
      const sitio = await c.sitio();
      let pctCom = null, fijo = 0, comision = null;
      try {
        const lp = await c.get(ruta`/sites/${sitio}/listing_prices`, { price: precio, category_id: categoria, listing_type_id: tipo });
        const fila = (Array.isArray(lp) ? lp : [lp]).find((x) => x?.listing_type_id === tipo) || (Array.isArray(lp) ? lp[0] : lp);
        if (fila?.sale_fee_details) { pctCom = fila.sale_fee_details.percentage_fee ?? null; fijo = fila.sale_fee_details.fixed_fee ?? 0; }
        if (fila?.sale_fee_amount != null) comision = fila.sale_fee_amount;
      } catch (e) { if (!(e instanceof MeliError)) throw e; }
      if (comision == null) { if (pctCom == null) pctCom = 14; comision = (precio * pctCom) / 100 + fijo; }
      let adsPorUnidad = 0, notaAds = 'sin item_id o sin campañas: $ 0';
      if (args.item_id) {
        const adv = await anunciantePads(c);
        if (adv) {
          const dias = args.dias_ads ?? 30;
          const grupos = await metricasItem(c, sitio, adv.advertiser_id ?? adv.id, args.item_id, Date.now() - (dias - 1) * 86400000, Date.now());
          const m = grupos?.[0]?.metrics || grupos?.[0]?.metrics_summary;
          if (m) {
            if (m.units_quantity > 0) { adsPorUnidad = m.cost / m.units_quantity; notaAds = `${d0(m.cost)} en ${dias} días / ${m.units_quantity} ventas por ads`; }
            else if (m.cost > 0) { adsPorUnidad = m.cost; notaAds = `⚠️ ${d0(m.cost)} gastados SIN ventas por ads en ${dias} días`; }
          }
        }
      }
      const envio = args.costo_envio ?? 0;
      const impuestos = (precio * args.impuestos_pct) / 100;
      const ganancia = precio - comision - adsPorUnidad - envio - impuestos - args.costo;
      const margen = (ganancia / precio) * 100;
      const semaforo = ganancia <= 0 ? '🔴 PÉRDIDA' : margen < 10 ? '🟡 margen fino' : '🟢 margen sano';
      const acosMax = ((ganancia + adsPorUnidad) / precio) * 100;
      const pctEfectivo = (comision / precio) * 100;
      const equilibrio = (args.costo + envio + adsPorUnidad + (pctCom != null ? fijo : comision)) / (1 - ((pctCom ?? pctEfectivo) + args.impuestos_pct) / 100);
      return `# 💰 Rentabilidad real${titulo ? ': ' + titulo : ''}${args.item_id ? ' (' + args.item_id + ')' : ''}\n\n` +
        tabla(['Concepto', 'Monto'], [
          ['Precio de venta', dinero(precio, moneda, 0)],
          [`− Comisión Mercado Libre (${pctCom != null ? pct(pctCom) + (fijo ? ' + ' + d0(fijo) : '') : pct(pctEfectivo) + ' efectivo'}, ${tipo})`, '−' + d0(comision)],
          [`− Publicidad por unidad (${notaAds})`, '−' + d0(adsPorUnidad)],
          ['− Envío a cargo del vendedor', '−' + d0(envio)],
          [`− Impuestos (${pct(args.impuestos_pct)} del precio)`, '−' + d0(impuestos)],
          ['− Costo del producto', '−' + d0(args.costo)],
          ['**= Ganancia neta por unidad**', `**${d0(ganancia)}**`],
        ]) +
        `\n\n**Margen: ${pct(margen)}** ${semaforo}\n**ACOS máximo que aguanta: ${pct(Math.max(0, acosMax))}** — por encima, la publicidad se come toda la ganancia.` +
        (ganancia <= 0 ? `\n\n⚠️ Así como está se pierde plata en cada venta. Precio de equilibrio (ganancia 0): ${d0(equilibrio)} — validalo contra ml_precio_catalogo antes de subirlo.` : '');
    },
  },
];
