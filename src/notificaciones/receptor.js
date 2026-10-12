// Receptor HTTP de notificaciones de Mercado Libre.
//
// Proceso INDEPENDIENTE del servidor MCP por stdio (src/index.js): no lo
// importa ni lo modifica. Pensado para correr en un servicio con URL pública
// HTTPS (Render, Cloud Run, Fly.io…) que termina TLS delante de este proceso.
//
// Contrato de Mercado Libre: envía POST con JSON
//   { "_id", "resource", "user_id", "topic", "application_id", "attempts",
//     "sent", "received" }
// y espera una respuesta 2xx rápida (si no, reintenta). Por eso este receptor
// responde 200 de inmediato y recién después registra/procesa.
//
// Seguridad:
//  - Sin dependencias: node:http.
//  - Cuerpo limitado (64 KB), solo JSON, solo POST en la ruta configurada.
//  - No se registran cuerpos completos ni cabeceras; solo campos conocidos,
//    pasados por la redacción de secretos.
//  - Si ML_CLIENT_ID está definido, las notificaciones con otro
//    application_id se registran como ignoradas (se responde 200 igual para
//    no provocar reintentos, pero no se procesan ni se guardan).
//  - Opcional: NOTIFICACIONES_ARCHIVO guarda cada notificación aceptada en
//    un archivo JSONL local (una línea por notificación, redactada).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../log.js';
import { redactarObjeto } from '../redaccion.js';
import { NOMBRE, VERSION } from '../version.js';

export const LIMITE_CUERPO = 64 * 1024;
export const MAX_RECIENTES = 200;

const TOPICS_CONOCIDOS = new Set([
  'orders_v2', 'orders_feedback', 'shipments', 'fbm_stock_operations', 'items',
  'items_prices', 'price_suggestion', 'questions', 'messages', 'claims',
  'payments', 'invoices', 'catalog_item_competition_status',
  'catalog_suggestions', 'public_offers', 'public_candidates', 'post_purchase',
  'stock-location', 'user-products-families', 'vis_leads', 'flex-handshakes',
]);

/** Lee la configuración del receptor desde variables de entorno. */
export function leerConfigNotificaciones(env = process.env) {
  const puerto = Number(env.PORT || env.NOTIFICACIONES_PUERTO || 3000);
  if (!Number.isInteger(puerto) || puerto < 0 || puerto > 65535) throw new Error(`PORT inválido: ${env.PORT}`);
  let ruta = (env.NOTIFICACIONES_RUTA || '/notifications').trim();
  if (!ruta.startsWith('/')) ruta = '/' + ruta;
  if (!/^\/[A-Za-z0-9_\-/]{1,128}$/.test(ruta)) throw new Error(`NOTIFICACIONES_RUTA inválida: ${ruta}`);
  return Object.freeze({
    puerto,
    host: (env.NOTIFICACIONES_HOST || '0.0.0.0').trim(),
    ruta: ruta.replace(/\/+$/, '') || '/',
    clientId: (env.ML_CLIENT_ID || env.ML_APP_ID || '').trim() || null,
    archivo: (env.NOTIFICACIONES_ARCHIVO || '').trim() || null,
  });
}

/** Valida y normaliza el cuerpo de una notificación. Devuelve {ok, motivo, notificacion}. */
export function interpretarNotificacion(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return { ok: false, motivo: 'el cuerpo no es un objeto JSON' };
  const topic = typeof cuerpo.topic === 'string' ? cuerpo.topic.slice(0, 64) : null;
  const resource = typeof cuerpo.resource === 'string' ? cuerpo.resource.slice(0, 256) : null;
  if (!topic || !resource) return { ok: false, motivo: 'faltan los campos topic y/o resource' };
  if (!resource.startsWith('/')) return { ok: false, motivo: 'resource no es una ruta de la API' };
  return {
    ok: true,
    notificacion: {
      id: typeof cuerpo._id === 'string' ? cuerpo._id.slice(0, 64) : null,
      topic,
      resource,
      user_id: cuerpo.user_id != null ? String(cuerpo.user_id).slice(0, 32) : null,
      application_id: cuerpo.application_id != null ? String(cuerpo.application_id).slice(0, 32) : null,
      attempts: Number.isInteger(cuerpo.attempts) ? cuerpo.attempts : null,
      sent: typeof cuerpo.sent === 'string' ? cuerpo.sent.slice(0, 40) : null,
      received: typeof cuerpo.received === 'string' ? cuerpo.received.slice(0, 40) : null,
      topic_conocido: TOPICS_CONOCIDOS.has(topic),
    },
  };
}

function responderJson(res, status, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(texto);
}

function leerCuerpo(req, limite) {
  return new Promise((resolver, rechazar) => {
    const partes = [];
    let total = 0;
    req.on('data', (d) => {
      total += d.length;
      if (total > limite) { req.pause(); rechazar(Object.assign(new Error('cuerpo demasiado grande'), { status: 413 })); return; }
      partes.push(d);
    });
    req.on('end', () => resolver(Buffer.concat(partes).toString('utf8')));
    req.on('error', rechazar);
  });
}

/**
 * Crea el servidor HTTP (sin escuchar todavía).
 * @param {ReturnType<typeof leerConfigNotificaciones>} config
 * @param {{alRecibir?: (n: object) => void}} [opciones]  hook para pruebas / integraciones
 */
export function crearReceptor(config, { alRecibir } = {}) {
  const recientes = [];
  const contadores = { recibidas: 0, aceptadas: 0, ignoradas: 0, rechazadas: 0, iniciado: new Date().toISOString() };

  function guardar(n) {
    recientes.push(n);
    if (recientes.length > MAX_RECIENTES) recientes.shift();
    if (config.archivo) {
      try {
        fs.mkdirSync(path.dirname(config.archivo), { recursive: true });
        fs.appendFileSync(config.archivo, JSON.stringify(redactarObjeto(n)) + '\n', { mode: 0o600 });
      } catch (e) { log.warn('No se pudo guardar la notificación en archivo:', e); }
    }
  }

  const server = http.createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { responderJson(res, 400, { error: 'url inválida' }); return; }
    const ruta = url.pathname.replace(/\/+$/, '') || '/';

    if (ruta === '/health' || ruta === '/') {
      if (req.method !== 'GET' && req.method !== 'HEAD') { responderJson(res, 405, { error: 'método no permitido' }); return; }
      // Sin datos de cuentas ni de notificaciones: solo señal de vida.
      responderJson(res, 200, { ok: true, servicio: `${NOMBRE}-notificaciones`, version: VERSION });
      return;
    }

    if (ruta !== config.ruta) { responderJson(res, 404, { error: 'no encontrado' }); return; }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); responderJson(res, 405, { error: 'solo POST' }); return; }

    contadores.recibidas++;
    const tipo = String(req.headers['content-type'] || '');
    if (tipo && !/^application\/json\b/i.test(tipo)) { contadores.rechazadas++; log.warn(`Notificación rechazada: Content-Type no es JSON (${tipo.slice(0, 40)})`); responderJson(res, 415, { error: 'se espera application/json' }); return; }

    let texto;
    try { texto = await leerCuerpo(req, LIMITE_CUERPO); }
    catch (e) { contadores.rechazadas++; log.warn(`Notificación rechazada: ${e.message}`); if (!res.headersSent) { res.setHeader('Connection', 'close'); responderJson(res, e.status || 400, { error: e.message }); } req.resume(); return; }

    let cuerpo;
    try { cuerpo = JSON.parse(texto); } catch { contadores.rechazadas++; log.warn('Notificación rechazada: JSON inválido'); responderJson(res, 400, { error: 'JSON inválido' }); return; }

    const r = interpretarNotificacion(cuerpo);
    if (!r.ok) { contadores.rechazadas++; log.warn(`Notificación rechazada: ${r.motivo}`); responderJson(res, 400, { error: r.motivo }); return; }
    const n = { ...r.notificacion, recibida_en: new Date().toISOString(), ip: req.socket.remoteAddress ?? null };

    // Responder YA (Mercado Libre reintenta si no recibe 2xx rápido); el
    // registro y el procesamiento ocurren después de cerrar la respuesta.
    responderJson(res, 200, { ok: true });

    if (config.clientId && n.application_id && n.application_id !== config.clientId) {
      contadores.ignoradas++;
      log.warn(`Notificación ignorada: application_id ${n.application_id} no coincide con ML_CLIENT_ID (topic ${n.topic})`);
      return;
    }
    contadores.aceptadas++;
    log.info(`Notificación recibida · topic=${n.topic}${n.topic_conocido ? '' : ' (desconocido)'} · resource=${n.resource} · user_id=${n.user_id ?? '—'} · intento=${n.attempts ?? '—'} · enviada=${n.sent ?? '—'}`);
    guardar(n);
    try { alRecibir?.(n); } catch (e) { log.error('Error en el procesamiento de la notificación:', e); }
  });

  server.on('clientError', (err, socket) => {
    if (err.code === 'ECONNRESET' || !socket.writable) return;
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 70000;
  server.requestTimeout = 15000;

  return {
    server,
    contadores,
    recientes,
    iniciar: () => new Promise((ok, falla) => {
      server.once('error', falla);
      server.listen(config.puerto, config.host, () => {
        server.off('error', falla);
        const a = server.address();
        log.info(`Receptor de notificaciones v${VERSION} escuchando en ${config.host}:${a.port} · ruta ${config.ruta} · ${config.clientId ? 'filtra por ML_CLIENT_ID' : 'sin filtro de application_id (definí ML_CLIENT_ID)'}${config.archivo ? ' · guarda en ' + config.archivo : ''}`);
        ok(a.port);
      });
    }),
    detener: () => new Promise((ok) => server.close(() => ok())),
  };
}
