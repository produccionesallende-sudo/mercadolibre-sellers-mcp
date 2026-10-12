// Accesos de alto nivel a recursos de la API que se usan desde varias
// herramientas, adaptados a la documentación oficial vigente (2026).
import { ruta } from './transporte.js';
import { MeliError } from '../errores.js';

/**
 * Detalle de varios ítems. Usa /items/bulk (reemplazo oficial de /items?ids=,
 * que se desactiva el 25/10/2026) y cae a /items?ids= si el bulk no existe
 * todavía para el sitio. Devuelve un mapa id -> body (solo los encontrados).
 */
export async function obtenerItems(c, ids, attributes) {
  const resultado = {};
  for (let i = 0; i < ids.length; i += 20) {
    const lote = ids.slice(i, i + 20);
    let r;
    try {
      r = await c.get('/items/bulk', { ids: lote.join(','), attributes: attributes ? attributes.split(',').map((a) => `body.${a.trim()}`).join(',') : undefined });
    } catch (e) {
      if (!(e instanceof MeliError) || e.status !== 404) throw e;
      r = await c.get('/items', { ids: lote.join(','), attributes });
    }
    for (const x of Array.isArray(r) ? r : (r.results || [])) {
      const codigo = x.status_code ?? x.code;
      if (codigo === 200 && x.body?.id) resultado[x.body.id] = x.body;
    }
  }
  return resultado;
}

/** IDs de publicaciones del vendedor (con paginación por offset, tope configurable). */
export async function idsPublicaciones(c, { status, limite = 50 } = {}) {
  const ids = [];
  let offset = 0, total = null;
  while (ids.length < limite) {
    const r = await c.get(c.rutaUsuario('/items/search'), { status, limit: Math.min(50, limite - ids.length), offset });
    const lote = r.results || [];
    ids.push(...lote);
    total = r.paging?.total ?? ids.length;
    offset += lote.length;
    if (!lote.length || offset >= total) break;
  }
  return { ids, total: total ?? ids.length };
}

/** Órdenes del vendedor dentro de un rango, paginando hasta `maximo`. */
export async function ordenes(c, { desde, hasta, estado, maximo = 500, sort = 'date_desc' } = {}) {
  const lista = [];
  let offset = 0, total = 0;
  while (lista.length < maximo) {
    const r = await c.get('/orders/search', {
      seller: c.userId,
      'order.status': estado,
      'order.date_created.from': desde ? new Date(desde).toISOString() : undefined,
      'order.date_created.to': hasta ? new Date(hasta).toISOString() : undefined,
      sort,
      limit: Math.min(50, maximo - lista.length),
      offset,
    });
    const lote = r.results || [];
    lista.push(...lote);
    total = r.paging?.total ?? lista.length;
    offset += lote.length;
    if (!lote.length || offset >= total) break;
  }
  return { ordenes: lista, total };
}

/**
 * Envío de una orden. Flujo vigente: la orden trae shipping.id y el detalle
 * sale de GET /shipments/{id} con x-format-new: true. Si no hay shipping.id
 * se intenta la vista "hosted" de /orders/{id}/shipments (array de {id,type}).
 */
export async function envioDeOrden(c, ordenId) {
  let shipmentId = null;
  try {
    const o = await c.get(ruta`/orders/${ordenId}`);
    shipmentId = o?.shipping?.id ?? null;
  } catch (e) { if (!(e instanceof MeliError) || ![403, 404].includes(e.status)) throw e; }
  if (!shipmentId) {
    const r = await c._pedir({ metodo: 'GET', ruta: ruta`/orders/${ordenId}/shipments`, headers: { 'X-New-Domain': 'true' } });
    if (Array.isArray(r)) shipmentId = (r.find((x) => x.type === 'forward') || r[0])?.id ?? null;
    else if (r?.id) return r; // vista antigua: ya es el envío
  }
  if (!shipmentId) throw new MeliError(404, `La orden ${ordenId} no tiene envío asociado.`);
  return c._pedir({ metodo: 'GET', ruta: ruta`/shipments/${shipmentId}`, headers: { 'x-format-new': 'true' } });
}

/** Anunciante de Product Ads de la cuenta (null si no tiene Publicidad habilitada). */
export async function anunciantePads(c) {
  try {
    const r = await c._pedir({ metodo: 'GET', ruta: '/advertising/advertisers', query: { product_id: 'PADS' }, headers: { 'Api-Version': '1' } });
    return r?.advertisers?.[0] ?? null;
  } catch (e) {
    if (e instanceof MeliError && [400, 403, 404].includes(e.status)) return null;
    throw e;
  }
}
