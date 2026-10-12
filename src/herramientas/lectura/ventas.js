// Ventas, métricas, panel y envíos (solo lectura).
import { z } from 'zod';
import { cuentaParam, diasParam, limiteParam, clientePara } from '../comunes.js';
import { ordenes, envioDeOrden } from '../../meli/recursos.js';
import { ruta } from '../../meli/transporte.js';
import { dinero, fecha, numero, variacion, limitarTexto } from '../../formato.js';
import { MeliError } from '../../errores.js';

const NOMBRE_ENVIO = { fulfillment: 'FULL', self_service: 'Flex', cross_docking: 'Colecta', drop_off: 'Punto de despacho', xd_drop_off: 'Colecta', custom: 'A convenir', not_specified: 'Sin dato' };

function resumen(lista) {
  let total = 0, unidades = 0;
  for (const o of lista) { total += Number(o.total_amount) || 0; for (const it of o.order_items || []) unidades += Number(it.quantity) || 0; }
  return { total, unidades, cant: lista.length };
}

export const herramientas = [
  {
    name: 'ml_ordenes',
    titulo: 'Órdenes de venta',
    lectura: true,
    descripcion: 'Lista las ventas (órdenes) del vendedor, de la más reciente a la más antigua, filtrables por días y estado (paid, cancelled, confirmed…). Mercado Libre conserva solo los últimos 12 meses.',
    esquema: { ...cuentaParam, dias: diasParam(7), estado: z.enum(['paid', 'confirmed', 'payment_required', 'payment_in_process', 'partially_paid', 'cancelled', 'invalid']).optional(), limite: limiteParam(20, 200) },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const dias = args.dias ?? 7;
      const { ordenes: os, total } = await ordenes(c, { desde: Date.now() - dias * 86400000, estado: args.estado, maximo: args.limite ?? 20 });
      if (!os.length) return `Sin órdenes en los últimos ${dias} días${args.estado ? ` con estado ${args.estado}` : ''}.`;
      const filas = os.map((o) => {
        const it = o.order_items?.[0] || {};
        const extra = (o.order_items?.length ?? 0) > 1 ? ` (+${o.order_items.length - 1} ítem/s)` : '';
        return `- **${o.id}** · ${fecha(o.date_created)} · ${limitarTexto(it.item?.title ?? '', 50)} x${it.quantity ?? 1}${extra} · ${dinero(o.total_amount, o.currency_id)} · ${o.status}${o.buyer?.nickname ? ' · comprador ' + o.buyer.nickname : ''}`;
      });
      return `## Órdenes (${numero(total)} en total, mostrando ${os.length})\n` + filas.join('\n') + '\n\nDetalle de una orden: ml_orden. Envío: ml_envio.';
    },
  },
  {
    name: 'ml_orden',
    titulo: 'Detalle de una orden',
    lectura: true,
    descripcion: 'Detalle de una orden: ítems, montos, pagos, comprador (datos que expone la API) y estado del envío.',
    esquema: { ...cuentaParam, orden_id: z.string().regex(/^\d{1,20}$/) },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const o = await c.get(ruta`/orders/${args.orden_id}`);
      const items = (o.order_items || []).map((it) => `- ${it.item?.title ?? it.item?.id} (${it.item?.id}) x${it.quantity} · ${dinero(it.unit_price, o.currency_id)} c/u${it.item?.variation_attributes?.length ? ' · ' + it.item.variation_attributes.map((v) => `${v.name}: ${v.value_name}`).join(', ') : ''}`);
      const pagos = (o.payments || []).map((p) => `- ${p.payment_type ?? p.payment_method_id ?? 'pago'} · ${dinero(p.transaction_amount, p.currency_id)} · ${p.status}${p.date_approved ? ' · aprobado ' + fecha(p.date_approved) : ''}`);
      return [
        `## Orden ${o.id} — ${o.status}${o.status_detail ? ' (' + o.status_detail + ')' : ''}`,
        `- **Fecha:** ${fecha(o.date_created)} · **Total:** ${dinero(o.total_amount, o.currency_id)} · **Pagado:** ${dinero(o.paid_amount, o.currency_id)}`,
        `- **Comprador:** ${o.buyer?.nickname ?? '—'} (id ${o.buyer?.id ?? '—'})`,
        `- **Envío:** ${o.shipping?.id ? 'id ' + o.shipping.id + ' (ver ml_envio)' : 'sin envío por Mercado Envíos'}`,
        o.tags?.length ? `- **Etiquetas:** ${o.tags.join(', ')}` : '',
        '', '### Ítems', ...items,
        pagos.length ? '\n### Pagos\n' + pagos.join('\n') : '',
      ].filter((l) => l !== '').join('\n');
    },
  },
  {
    name: 'ml_panel_ventas',
    titulo: 'Panel de ventas',
    lectura: true,
    descripcion: 'El tablero del vendedor en una llamada: facturación de HOY y del MES (órdenes pagas), productos más vendidos del mes, reparto por método de envío (FULL/Flex/Colecta) y provincias donde se concentran las ventas. Ideal para "¿cómo venimos hoy?".',
    esquema: { ...cuentaParam, muestra_envios: z.number().int().min(0).max(50).optional().describe('Cuántas órdenes del mes consultar para envíos y provincias (default 20; 0 desactiva)') },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
      const mes0 = new Date(hoy0.getFullYear(), hoy0.getMonth(), 1);
      const { ordenes: delMes, total } = await ordenes(c, { desde: mes0, estado: 'paid', maximo: 400 });
      const deHoy = delMes.filter((o) => new Date(o.date_created) >= hoy0);
      const h = resumen(deHoy), m = resumen(delMes);
      const porProducto = {};
      for (const o of delMes) for (const it of o.order_items || []) {
        const k = it.item?.title ?? it.item?.id ?? '¿?';
        porProducto[k] ||= { u: 0, plata: 0 };
        porProducto[k].u += Number(it.quantity) || 0;
        porProducto[k].plata += (Number(it.unit_price) || 0) * (Number(it.quantity) || 0);
      }
      const top = Object.entries(porProducto).sort((a, b) => b[1].u - a[1].u).slice(0, 5);
      const envios = {}, provincias = {};
      const muestra = delMes.slice(0, args.muestra_envios ?? 20);
      for (const o of muestra) {
        try {
          const s = await envioDeOrden(c, o.id);
          const tipo = NOMBRE_ENVIO[s.logistic_type] ?? s.logistic_type ?? 'Sin dato';
          envios[tipo] = (envios[tipo] ?? 0) + 1;
          const prov = s.receiver_address?.state?.name ?? s.destination?.shipping_address?.state?.name;
          if (prov) provincias[prov] = (provincias[prov] ?? 0) + 1;
        } catch { /* orden sin envío o sin permiso: se omite */ }
      }
      const linea = (obj, n) => {
        const tot = Object.values(obj).reduce((a, b) => a + b, 0) || 1;
        return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${Math.round((v / tot) * 100)}% (${v})`).join(' · ');
      };
      const nombreMes = mes0.toLocaleDateString('es', { month: 'long', year: 'numeric' });
      const diasTranscurridos = Math.max(1, hoy0.getDate());
      return [
        `# Panel de ventas — ${nombreMes}`,
        `📅 **Hoy:** ${dinero(h.total)} · ${h.cant} venta(s) · ${h.unidades} unidad(es)`,
        `🗓️ **Mes:** ${dinero(m.total)} · ${m.cant} venta(s) · ${m.unidades} unidad(es) · ticket promedio ${dinero(m.cant ? m.total / m.cant : 0)} · ritmo diario ${dinero(m.total / diasTranscurridos)}${total > delMes.length ? ` (analizadas ${delMes.length} de ${total} órdenes)` : ''}`,
        top.length ? '\n🏆 **Más vendidos del mes**\n' + top.map(([t, v], i) => `${i + 1}. ${t} — ${v.u} u.${v.plata ? ` (${dinero(v.plata)})` : ''}`).join('\n') : '',
        Object.keys(envios).length ? `\n🚚 **Métodos de envío** (muestra de ${muestra.length}): ${linea(envios, 5)}` : '',
        Object.keys(provincias).length ? `📍 **Dónde se concentran las ventas:** ${linea(provincias, 5)}` : '',
      ].filter(Boolean).join('\n');
    },
  },
  {
    name: 'ml_metricas',
    titulo: 'Métricas de ventas',
    lectura: true,
    descripcion: 'Facturación, unidades y ticket promedio de un período (órdenes pagas), comparado con el período anterior. Con cuenta="todas" consolida todas las tiendas conectadas.',
    esquema: { cuenta: z.union([z.literal('todas'), z.string().regex(/^\d{1,20}$/)]).optional(), dias: diasParam(7, 180) },
    async run(args, ctx) {
      const dias = args.dias ?? 7;
      if (args.cuenta === 'todas') {
        const cs = ctx.sesiones.listar();
        if (cs.length < 2) return 'Hay una sola cuenta conectada: pedí las métricas sin cuenta="todas".';
        const partes = [];
        let total = 0;
        for (const cta of cs) {
          const r = await calcular(ctx, { cuenta: cta.user_id, dias });
          total += r.actual.total;
          partes.push(`### ${cta.nickname}\n${r.texto}`);
        }
        return `# Consolidado de ${cs.length} tiendas — últimos ${dias} días\n**Facturación total: ${dinero(total)}**\n\n` + partes.join('\n\n');
      }
      return (await calcular(ctx, { cuenta: args.cuenta, dias })).texto;
    },
  },
  {
    name: 'ml_envio',
    titulo: 'Envío de una orden',
    lectura: true,
    descripcion: 'Estado del envío de una orden: estado, subestado, tracking, tipo logístico y fechas estimadas.',
    esquema: { ...cuentaParam, orden_id: z.string().regex(/^\d{1,20}$/).describe('ID de la orden') },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      let s;
      try { s = await envioDeOrden(c, args.orden_id); } catch (e) {
        if (e instanceof MeliError && e.status === 404) return `La orden ${args.orden_id} no tiene un envío de Mercado Envíos asociado (o no existe).`;
        throw e;
      }
      const est = s.lead_time?.estimated_delivery_time?.date ?? s.shipping_option?.estimated_delivery_time?.date;
      return [
        `## Envío ${s.id ?? ''} de la orden ${args.orden_id}`,
        `- **Estado:** ${s.status ?? '—'}${s.substatus ? ` (${s.substatus})` : ''}`,
        `- **Tracking:** ${s.tracking_number ?? '—'}${s.tracking_method ? ` (${s.tracking_method})` : ''}`,
        `- **Logística:** ${NOMBRE_ENVIO[s.logistic_type] ?? s.logistic_type ?? s.logistic?.type ?? '—'}${s.shipping_mode ? ' · ' + s.shipping_mode : ''}`,
        `- **Destino:** ${s.receiver_address?.city?.name ?? s.destination?.shipping_address?.city?.name ?? '—'}, ${s.receiver_address?.state?.name ?? s.destination?.shipping_address?.state?.name ?? '—'}`,
        est ? `- **Entrega estimada:** ${fecha(est)}` : '',
        s.date_created ? `- **Creado:** ${fecha(s.date_created)}${s.last_updated ? ' · actualizado ' + fecha(s.last_updated) : ''}` : '',
      ].filter(Boolean).join('\n');
    },
  },
];

async function calcular(ctx, { cuenta, dias }) {
  const c = await clientePara(ctx, { cuenta });
  const ahora = Date.now();
  const traer = async (desde, hasta) => resumen((await ordenes(c, { desde, hasta, estado: 'paid', maximo: 1000 })).ordenes);
  const actual = await traer(ahora - dias * 86400000, ahora);
  const previo = await traer(ahora - 2 * dias * 86400000, ahora - dias * 86400000);
  const texto = [
    `## Últimos ${dias} días`,
    `- **Facturación:** ${dinero(actual.total)}${variacion(actual.total, previo.total)}`,
    `- **Ventas:** ${actual.cant} órdenes · ${actual.unidades} unidades${variacion(actual.cant, previo.cant)}`,
    `- **Ticket promedio:** ${dinero(actual.cant ? actual.total / actual.cant : 0)}`,
    `- Período anterior: ${dinero(previo.total)} en ${previo.cant} órdenes`,
  ].join('\n');
  return { actual, previo, texto };
}
