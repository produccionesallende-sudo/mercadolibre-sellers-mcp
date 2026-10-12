// Simulador mínimo de la API de Mercado Libre para pruebas (sin dependencias).
// Escucha SOLO en 127.0.0.1 y registra cada petición para poder inspeccionarla.
import http from 'node:http';

export const TOKEN_OK = 'APP_USR-1111111111111111-101010-abcdefabcdefabcdefabcdefabcdefab-777';
export const TOKEN_2 = 'APP_USR-2222222222222222-101010-abcdefabcdefabcdefabcdefabcdefab-888';
export const REFRESH_1 = 'TG-aaaaaaaaaaaaaaaaaaaaaaaa-777';
export const REFRESH_2 = 'TG-bbbbbbbbbbbbbbbbbbbbbbbb-777';
export const CODE_OK = 'TG-cccccccccccccccccccccccc-777';

export function crearMock() {
  const estado = {
    peticiones: [],
    refrescos: 0,
    refreshValido: REFRESH_1,
    tokenValido: TOKEN_OK,
    fallar429: 0,        // cuántas veces responder 429 antes de OK
    fallar500: 0,
    itemCreado: null,
    itemActualizado: null,
    respuestas: [],
    ultimoCodeVerifier: null,
    ultimoRedirect: null,
    promoAceptada: null,
  };
  const items = {
    MLA111: { id: 'MLA111', title: 'Termo Acero Inoxidable 1 Litro Pico Cebador', price: 42000, currency_id: 'ARS', available_quantity: 10, sold_quantity: 55, status: 'active', condition: 'new', listing_type_id: 'gold_special', category_id: 'MLA1055', catalog_listing: true, permalink: 'https://articulo.mercadolibre.com.ar/MLA111', pictures: [{ secure_url: 'https://http2.mlstatic.com/a.jpg' }, { secure_url: 'https://http2.mlstatic.com/b.jpg' }, { secure_url: 'https://http2.mlstatic.com/c.jpg' }], attributes: [{ id: 'BRAND', name: 'Marca', value_name: 'Genérica' }], shipping: { logistic_type: 'fulfillment', free_shipping: true, mode: 'me2' }, health: 0.9, sale_terms: [{ id: 'WARRANTY_TIME', value_name: '6 meses' }], buying_mode: 'buy_it_now' },
    MLA222: { id: 'MLA222', title: 'Mate', price: 9250, currency_id: 'ARS', available_quantity: 0, sold_quantity: 3, status: 'active', condition: 'new', listing_type_id: 'free', category_id: 'MLA1055', catalog_listing: false, permalink: 'https://articulo.mercadolibre.com.ar/MLA222', pictures: [{ secure_url: 'https://http2.mlstatic.com/d.jpg' }], attributes: [], shipping: { logistic_type: 'self_service', free_shipping: false }, health: 0.4 },
  };
  const ordenes = [
    { id: 101, date_created: new Date().toISOString(), total_amount: 42000, paid_amount: 42000, currency_id: 'ARS', status: 'paid', buyer: { id: 5, nickname: 'COMPRADOR1' }, shipping: { id: 9001 }, order_items: [{ item: { id: 'MLA111', title: 'Termo Acero Inoxidable 1 Litro Pico Cebador' }, quantity: 1, unit_price: 42000 }], payments: [{ payment_type: 'credit_card', transaction_amount: 42000, currency_id: 'ARS', status: 'approved', date_approved: new Date().toISOString() }] },
    { id: 102, date_created: new Date().toISOString(), total_amount: 18500, currency_id: 'ARS', status: 'paid', buyer: { nickname: 'COMPRADOR2' }, shipping: { id: 9002 }, order_items: [{ item: { id: 'MLA222', title: 'Mate' }, quantity: 2, unit_price: 9250 }] },
    { id: 103, date_created: new Date(Date.now() - 86400000).toISOString(), total_amount: 20000, currency_id: 'ARS', status: 'paid', shipping: { id: 9003 }, order_items: [{ item: { id: 'MLA111', title: 'Termo Acero Inoxidable 1 Litro Pico Cebador' }, quantity: 1, unit_price: 20000 }] },
  ];
  const envios = {
    9001: { id: 9001, status: 'shipped', substatus: 'in_transit', tracking_number: 'TRK123', logistic_type: 'fulfillment', receiver_address: { state: { name: 'Buenos Aires' }, city: { name: 'La Plata' } } },
    9002: { id: 9002, status: 'ready_to_ship', logistic_type: 'self_service', receiver_address: { state: { name: 'Capital Federal' } } },
    9003: { id: 9003, status: 'delivered', logistic_type: 'cross_docking', receiver_address: { state: { name: 'Córdoba' } } },
  };

  const json = (res, status, cuerpo, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(cuerpo)); };
  const leerCuerpo = (req) => new Promise((ok) => { let s = ''; req.on('data', (d) => (s += d)); req.on('end', () => ok(s)); });

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const cuerpo = await leerCuerpo(req);
    const reg = { metodo: req.method, ruta: u.pathname, query: Object.fromEntries(u.searchParams), headers: req.headers, cuerpo };
    estado.peticiones.push(reg);

    if (estado.fallar429 > 0) { estado.fallar429--; return json(res, 429, { message: 'local_rate_limited' }, { 'Retry-After': '0' }); }
    if (estado.fallar500 > 0) { estado.fallar500--; return json(res, 500, { message: 'internal' }); }

    if (u.pathname === '/oauth/token' && req.method === 'POST') {
      const b = Object.fromEntries(new URLSearchParams(cuerpo));
      if (b.grant_type === 'authorization_code') {
        estado.ultimoCodeVerifier = b.code_verifier; estado.ultimoRedirect = b.redirect_uri;
        if (!b.code_verifier) return json(res, 400, { error: 'invalid_request', error_description: 'falta code_verifier' });
        if (b.code === CODE_OK) return json(res, 200, { access_token: TOKEN_OK, token_type: 'bearer', expires_in: 21600, scope: 'offline_access read write', user_id: 777, refresh_token: REFRESH_1 });
        if (b.code === 'TG-dddddddddddddddddddddddd-888') return json(res, 200, { access_token: TOKEN_2, token_type: 'bearer', expires_in: 21600, user_id: 888, refresh_token: 'TG-eeeeeeeeeeeeeeeeeeeeeeee-888' });
        return json(res, 400, { error: 'invalid_grant', error_description: 'code inválido' });
      }
      if (b.grant_type === 'refresh_token') {
        estado.refrescos++;
        if (b.refresh_token !== estado.refreshValido) return json(res, 400, { error: 'invalid_grant', error_description: 'refresh inválido' });
        estado.refreshValido = REFRESH_2; estado.tokenValido = TOKEN_OK;
        return json(res, 200, { access_token: TOKEN_OK, token_type: 'bearer', expires_in: 21600, user_id: 777, refresh_token: REFRESH_2 });
      }
      return json(res, 400, { error: 'unsupported_grant_type' });
    }

    // Todo lo demás requiere Bearer en cabecera (nunca en query)
    if (u.searchParams.has('access_token')) return json(res, 400, { message: 'token en query no permitido' });
    const tk = (req.headers.authorization || '').replace('Bearer ', '');
    if (tk !== estado.tokenValido && tk !== TOKEN_2) return json(res, 401, { message: 'invalid_token' });
    const uid = tk === TOKEN_2 ? 888 : 777;

    const p = u.pathname, m = req.method;
    if (p === '/users/me') return json(res, 200, { id: uid, nickname: uid === 888 ? 'TIENDA_DOS' : 'TIENDA_DEMO', site_id: 'MLA', seller_reputation: { level_id: '5_green', power_seller_status: 'platinum', transactions: { completed: 1543, canceled: 2 }, metrics: { claims: { rate: 0.001, value: 2 }, delayed_handling_time: { rate: 0.02 }, cancellations: { rate: 0 }, sales: { completed: 300, period: '60 days' } } } });
    if (p === '/sites/MLA') return json(res, 200, { id: 'MLA', default_currency_id: 'ARS' });
    if (p === '/orders/search') {
      const desde = String(u.searchParams.get('order.date_created.from') || '');
      const hasta = u.searchParams.get('order.date_created.to');
      let lista = ordenes.filter((o) => o.date_created >= desde && (!hasta || o.date_created <= hasta));
      if (desde && desde < new Date(Date.now() - 8 * 86400000).toISOString() && hasta && hasta < new Date(Date.now() - 2 * 86400000).toISOString()) lista = [{ id: 100, date_created: new Date(Date.now() - 10 * 86400000).toISOString(), total_amount: 20000, currency_id: 'ARS', status: 'paid', order_items: [{ item: { title: 'Termo viejo' }, quantity: 1, unit_price: 20000 }] }];
      return json(res, 200, { paging: { total: lista.length, limit: 50 }, results: lista });
    }
    let mm;
    if ((mm = p.match(/^\/orders\/(\d+)$/))) { const o = ordenes.find((x) => String(x.id) === mm[1]); return o ? json(res, 200, o) : json(res, 404, { message: 'order not found' }); }
    if ((mm = p.match(/^\/shipments\/(\d+)$/))) { if (req.headers['x-format-new'] !== 'true') return json(res, 400, { message: 'x-format-new requerido' }); const s = envios[mm[1]]; return s ? json(res, 200, s) : json(res, 404, { message: 'not found' }); }
    if ((mm = p.match(/^\/users\/(\d+)\/items\/search$/))) return json(res, 200, { paging: { total: 2 }, results: ['MLA111', 'MLA222'] });
    if ((p === '/items/bulk' || p === '/items') && m === 'GET') return json(res, 200, String(u.searchParams.get('ids')).split(',').map((id) => items[id] ? { status_code: 200, code: 200, body: items[id] } : { status_code: 404, code: 404, body: null }));
    if ((mm = p.match(/^\/items\/([A-Z]{3}\d+)$/))) {
      const it = items[mm[1]];
      if (!it) return json(res, 404, { message: 'Item not found' });
      if (m === 'PUT') { const b = JSON.parse(cuerpo); estado.itemActualizado = b; Object.assign(it, b.price != null ? { price: b.price } : {}, b.available_quantity != null ? { available_quantity: b.available_quantity } : {}, b.status ? { status: b.status } : {}); return json(res, 200, { ...it, warnings: [] }); }
      return json(res, 200, it);
    }
    if (p === '/items' && m === 'POST') { const b = JSON.parse(cuerpo); estado.itemCreado = b; if (!b.title || !b.category_id) return json(res, 400, { message: 'faltan campos' }); return json(res, 201, { id: 'MLA999', title: b.title, price: b.price, permalink: 'https://articulo.mercadolibre.com.ar/MLA999', status: 'active' }); }
    if ((mm = p.match(/^\/items\/([A-Z]{3}\d+)\/description$/))) { if (m === 'POST') return json(res, 201, {}); return mm[1] === 'MLA222' ? json(res, 404, { message: 'no description' }) : json(res, 200, { plain_text: 'Descripción original del producto. '.repeat(10) }); }
    if ((mm = p.match(/^\/items\/([A-Z]{3}\d+)\/visits\/time_window$/))) return json(res, 200, { total_visits: 1234, results: [{ date: '2026-10-10', total: 100 }, { date: '2026-10-11', total: 120 }] });
    if (p === '/visits/items') return json(res, 200, { [u.searchParams.get('ids')]: 55555 });
    if ((mm = p.match(/^\/items\/([A-Z]{3}\d+)\/price_to_win$/))) return json(res, 200, { status: 'listed', current_price: 42000, price_to_win: 39990, currency_id: 'ARS', boosts: [{ id: 'free_shipping', status: 'opportunity' }] });
    if ((mm = p.match(/^\/items\/([A-Z]{3}\d+)\/clips$/)) || (mm = p.match(/^\/marketplace\/items\/([A-Z]{3}\d+)\/clips$/))) {
      if (mm[1] === 'MLA111') return json(res, 200, { clips: [{ clip_uuid: 'abc12345-xxxx', metadata: [{ site_id: 'MLA', moderation_status: 'REJECTED', moderation_reasons: { DUPLICATED_VIDEO: 'dup' } }] }] });
      return json(res, 404, { message: 'No clips found' });
    }
    if (/\/clips\/upload$/.test(p) && m === 'POST') return json(res, 201, { clip_uuid: 'nuevo-clip-uuid' });
    if (/\/clips\/[A-Za-z0-9-]+$/.test(p) && m === 'DELETE') return json(res, 200, [{ site_id: 'MLA', status: 'DELETED' }]);
    if (p === '/questions/search') return json(res, 200, { total: 1, questions: [{ id: 555, item_id: 'MLA111', text: '¿Tienen stock?', date_created: new Date().toISOString(), status: 'UNANSWERED' }] });
    if (p === '/answers' && m === 'POST') { estado.respuestas.push(JSON.parse(cuerpo)); return json(res, 200, { id: 555, status: 'ANSWERED' }); }
    if (p === '/sites/MLA/listing_prices') return json(res, 200, [{ listing_type_id: 'gold_special', listing_type_name: 'Clásica', sale_fee_amount: 5880, currency_id: 'ARS', sale_fee_details: { percentage_fee: 14, fixed_fee: 0 } }, { listing_type_id: 'gold_pro', listing_type_name: 'Premium', sale_fee_amount: 7560, currency_id: 'ARS', sale_fee_details: { percentage_fee: 18, fixed_fee: 0 } }]);
    if (p === '/sites/MLA/search') {
      if (u.searchParams.get('nickname') === 'RIVAL') return json(res, 200, { paging: { total: 1 }, results: [{ id: 'R1', title: 'Termo rival 1L', price: 39999, seller: { nickname: 'RIVAL' } }] });
      return json(res, 200, { paging: { total: 2 }, results: [{ id: 'B1', title: 'Termo lider', price: 35000, currency_id: 'ARS', seller: { nickname: 'LIDER' }, shipping: { free_shipping: true } }, { id: 'B2', title: 'Termo 2', price: 37000, currency_id: 'ARS', seller: { nickname: 'OTRO' } }] });
    }
    if (p === '/sites/MLA/domain_discovery/search') return json(res, 200, [{ category_id: 'MLA1055', category_name: 'Termos', domain_id: 'MLA-THERMOSES', domain_name: 'Termos' }]);
    if ((mm = p.match(/^\/categories\/([A-Z]{3}\d+)$/))) return json(res, 200, { id: mm[1], name: 'Termos', path_from_root: [{ name: 'Hogar' }, { name: 'Termos' }], total_items_in_this_category: 1200, settings: { catalog_domain: 'x', listing_allowed: true }, children_categories: [] });
    if (/^\/trends\/MLA/.test(p)) return json(res, 200, [{ keyword: 'termo stanley' }, { keyword: 'mate imperial' }]);
    if (/^\/highlights\/MLA\/category\//.test(p)) return json(res, 200, { content: [{ id: 'MLA111', type: 'ITEM', position: 1 }, { id: 'MLA222', type: 'ITEM', position: 2 }] });
    if ((mm = p.match(/^\/seller-promotions\/users\/(\d+)$/))) return json(res, 200, { results: [{ id: 'P1', name: 'Hot Sale', type: 'DEAL', status: 'started' }] });
    if (/^\/seller-promotions\/promotions\/P1\/items$/.test(p)) return json(res, 200, { results: [{ id: 'MLA111', original_price: 42000, suggested_discounted_price: 37800, meli_percentage: 5, status: 'candidate' }] });
    if ((mm = p.match(/^\/seller-promotions\/items\/([A-Z]{3}\d+)$/)) && m === 'POST') { estado.promoAceptada = { item: mm[1], ...JSON.parse(cuerpo) }; return json(res, 200, { status: 'started' }); }
    if (p === '/advertising/advertisers') return json(res, 200, { advertisers: [{ advertiser_id: 4242, site_id: 'MLA' }] });
    if (/^\/advertising\/MLA\/advertisers\/4242\/product_ads\/campaigns\/search$/.test(p)) { if (req.headers['api-version'] !== '2') return json(res, 400, { message: 'api-version' }); return json(res, 200, { results: [{ id: 1, name: 'Campaña A', status: 'active', budget: 5000, metrics: { cost: 12000, clicks: 300, prints: 10000, acos: 12.5, units_quantity: 8 } }] }); }
    if (/^\/advertising\/MLA\/advertisers\/4242\/product_ads\/ad_groups\/search$/.test(p)) return json(res, 200, { results: [{ id: 77, name: 'Grupo termo', campaign_id: 1, status: 'active', metrics: { cost: 6000, clicks: 100, prints: 4000, acos: 10, units_quantity: 4, total_amount: 60000 } }] });
    if ((mm = p.match(/^\/users\/(\d+)\/applications\/(\d+)$/)) && m === 'DELETE') return json(res, 200, { msg: 'Autorización eliminada' });
    if (p === '/redirigir') { res.writeHead(302, { Location: 'http://127.0.0.1:1/otro' }); return res.end(); }
    return json(res, 404, { message: `sin ruta en el simulador: ${m} ${p}` });
  });

  return {
    estado, items, server,
    iniciar: () => new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${server.address().port}`))),
    detener: () => new Promise((ok) => server.close(() => ok())),
  };
}
