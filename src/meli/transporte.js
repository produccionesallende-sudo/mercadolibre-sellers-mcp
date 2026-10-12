// Transporte HTTP hacia la API de Mercado Libre.
//  - Un único host permitido (api.mercadolibre.com o el simulador local de pruebas).
//  - Rutas construidas con `ruta\`...\`` que codifica cada parámetro: evita
//    inyección de rutas / SSRF aunque un argumento venga manipulado.
//  - Sin seguir redirecciones (el token nunca viaja a otro host).
//  - Timeouts, reintentos con backoff ante 429 y 5xx, y concurrencia limitada.
import { MeliError } from '../errores.js';
import { log } from '../log.js';
import { NOMBRE, VERSION } from '../version.js';

/**
 * Tag de plantilla para rutas: `ruta\`/items/${id}/description\``.
 * Cada valor interpolado se codifica con encodeURIComponent y se rechazan
 * segmentos vacíos o "." / "..".
 */
export function ruta(partes, ...valores) {
  let s = partes[0];
  valores.forEach((v, i) => {
    const t = String(v ?? '');
    if (!t || t === '.' || t === '..') throw new MeliError(400, 'Parámetro de ruta inválido.');
    s += encodeURIComponent(t) + partes[i + 1];
  });
  return s;
}

function validarRuta(r) {
  if (typeof r !== 'string' || !r.startsWith('/') || r.startsWith('//') || /[\\?#]|\/\.\.?(\/|$)|\s/.test(r)) {
    throw new MeliError(400, 'Ruta de API inválida.');
  }
}

const esperarMs = (ms) => new Promise((r) => setTimeout(r, ms));

function segundosRetryAfter(h) {
  if (!h) return null;
  const n = Number(h);
  if (Number.isFinite(n)) return Math.max(0, n);
  const fecha = Date.parse(h);
  return Number.isFinite(fecha) ? Math.max(0, (fecha - Date.now()) / 1000) : null;
}

function mensajeDeCuerpo(j, status, r) {
  if (j && typeof j === 'object') {
    const causa = Array.isArray(j.cause) && j.cause.length ? ` (${j.cause.map((c) => c.message || c.code || c).join('; ')})` : '';
    const base = j.message || j.error_description || j.error;
    if (base) return String(base) + causa;
  }
  return `Mercado Libre respondió ${status} en ${r}`;
}

export function crearTransporte({
  apiBase,
  fetchImpl = globalThis.fetch,
  maxReintentos = 3,
  esperar = esperarMs,
  concurrencia = 4,
  timeoutMs = 30000,
} = {}) {
  const base = new URL(apiBase);
  let activos = 0;
  const cola = [];
  const adquirir = () => new Promise((ok) => {
    if (activos < concurrencia) { activos++; ok(); } else cola.push(ok);
  });
  const liberar = () => {
    const sig = cola.shift();
    if (sig) sig(); else activos--;
  };

  /**
   * @param {object} p
   * @param {'GET'|'POST'|'PUT'|'DELETE'} p.metodo
   * @param {string} p.ruta  Ruta que empieza con "/" (usar el tag `ruta`)
   * @param {Record<string, unknown>} [p.query]
   * @param {unknown} [p.json]        Cuerpo JSON
   * @param {URLSearchParams} [p.form] Cuerpo x-www-form-urlencoded
   * @param {FormData} [p.multipart]   Cuerpo multipart
   * @param {string} [p.token]        Access token (va SOLO en cabecera)
   * @param {Record<string,string>} [p.headers]
   * @param {number} [p.timeoutMs]
   */
  async function solicitar(p) {
    validarRuta(p.ruta);
    const u = new URL(p.ruta, base);
    if (u.origin !== base.origin) throw new MeliError(400, 'Destino no permitido.');
    for (const [k, v] of Object.entries(p.query || {})) {
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    }
    const headers = { Accept: 'application/json', 'User-Agent': `${NOMBRE}/${VERSION}`, ...(p.headers || {}) };
    let body;
    if (p.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(p.json); }
    else if (p.form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = p.form.toString(); }
    else if (p.multipart) body = p.multipart;
    if (p.token) headers.Authorization = `Bearer ${p.token}`;

    const idempotente = p.metodo === 'GET';
    for (let intento = 0; ; intento++) {
      await adquirir();
      let r;
      try {
        r = await fetchImpl(u, {
          method: p.metodo,
          headers,
          body,
          redirect: 'error',
          signal: AbortSignal.timeout(p.timeoutMs ?? timeoutMs),
        });
      } catch (e) {
        liberar();
        const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
        if (idempotente && intento < maxReintentos) {
          await esperar(backoff(intento));
          continue;
        }
        throw new MeliError(0, timeout ? 'tiempo de espera agotado' : 'error de red', { ruta: p.ruta });
      }
      liberar();

      const texto = await r.text();
      let j = null;
      if (texto) { try { j = JSON.parse(texto); } catch { j = null; } }

      if (r.ok) return j ?? {};

      const reintentarEn = segundosRetryAfter(r.headers.get('retry-after'));
      const reintentable = r.status === 429 || (idempotente && [500, 502, 503, 504].includes(r.status));
      if (reintentable && intento < maxReintentos) {
        const ms = reintentarEn != null ? Math.min(reintentarEn, 30) * 1000 : backoff(intento);
        log.warn(`Mercado Libre respondió ${r.status} en ${p.metodo} ${p.ruta}; reintento ${intento + 1}/${maxReintentos} en ${Math.round(ms / 100) / 10}s`);
        await esperar(ms);
        continue;
      }
      throw new MeliError(r.status, mensajeDeCuerpo(j, r.status, p.ruta), {
        ruta: p.ruta,
        codigo: j?.error,
        reintentarEn: reintentarEn ?? undefined,
      });
    }
  }

  return { solicitar, origen: base.origin };
}

function backoff(intento) {
  return Math.min(8000, 1000 * 2 ** intento) + Math.floor(Math.random() * 250);
}
