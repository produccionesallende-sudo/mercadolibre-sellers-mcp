// OAuth 2.0 (Authorization Code + PKCE S256 + state) directo contra la
// infraestructura oficial de Mercado Libre. Sin páginas, servidores ni
// intermediarios de terceros.
import crypto from 'node:crypto';
import { MeliError } from '../errores.js';
import { registrarSecreto } from '../redaccion.js';

/** Dominio de autorización por sitio (país). */
export const AUTH_POR_SITIO = Object.freeze({
  MLA: 'https://auth.mercadolibre.com.ar',
  MLB: 'https://auth.mercadolivre.com.br',
  MLM: 'https://auth.mercadolibre.com.mx',
  MLC: 'https://auth.mercadolibre.cl',
  MCO: 'https://auth.mercadolibre.com.co',
  MLU: 'https://auth.mercadolibre.com.uy',
  MPE: 'https://auth.mercadolibre.com.pe',
  MLV: 'https://auth.mercadolibre.com.ve',
  MEC: 'https://auth.mercadolibre.com.ec',
  MBO: 'https://auth.mercadolibre.com.bo',
  MPY: 'https://auth.mercadolibre.com.py',
  MCR: 'https://auth.mercadolibre.co.cr',
  MPA: 'https://auth.mercadolibre.com.pa',
  MRD: 'https://auth.mercadolibre.com.do',
  MGT: 'https://auth.mercadolibre.com.gt',
  MHN: 'https://auth.mercadolibre.com.hn',
  MSV: 'https://auth.mercadolibre.com.sv',
  MNI: 'https://auth.mercadolibre.com.ni',
});

export const SITIOS = Object.freeze(Object.keys(AUTH_POR_SITIO));

/** Vida máxima de una autorización iniciada y no completada. */
export const VIDA_PENDIENTE_MS = 15 * 60 * 1000;

const b64url = (buf) => buf.toString('base64url');

export function generarPkce() {
  const verifier = b64url(crypto.randomBytes(48)); // 64 caracteres, dentro de 43..128 (RFC 7636)
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge, metodo: 'S256' };
}

export function generarState() {
  return b64url(crypto.randomBytes(24));
}

/** Valida la redirect URI: HTTPS, o loopback HTTP (127.0.0.1/localhost) para callback local. */
export function validarRedirectUri(uri) {
  let u;
  try { u = new URL(uri); } catch { throw new MeliError(400, `ML_REDIRECT_URI inválida: ${uri}`); }
  if (u.hash) throw new MeliError(400, 'ML_REDIRECT_URI no puede tener fragmento (#).');
  const loopback = ['127.0.0.1', 'localhost'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && loopback)) {
    throw new MeliError(400, 'ML_REDIRECT_URI debe ser HTTPS (o http://127.0.0.1:PUERTO/... para callback local).');
  }
  return { url: u, loopback };
}

export function urlDeAutorizacion({ clientId, redirectUri, sitio, state, challenge }) {
  const base = AUTH_POR_SITIO[sitio];
  if (!base) throw new MeliError(400, `Sitio desconocido: ${sitio}. Opciones: ${SITIOS.join(', ')}`);
  const u = new URL('/authorization', base);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  return u.toString();
}

/**
 * Acepta el código "pelado" o la URL completa a la que redirigió Mercado Libre
 * (p. ej. https://.../callback?code=TG-...&state=...).
 * @returns {{code: string, state: string|null}}
 */
export function extraerCodigo(entrada) {
  const t = String(entrada ?? '').trim();
  let code = t, state = null;
  if (/^https?:\/\//i.test(t)) {
    let u;
    try { u = new URL(t); } catch { throw new MeliError(400, 'La URL pegada no es válida.'); }
    const err = u.searchParams.get('error');
    if (err) throw new MeliError(400, `Mercado Libre devolvió un error en la autorización: ${err}${u.searchParams.get('error_description') ? ' — ' + u.searchParams.get('error_description') : ''}`);
    code = u.searchParams.get('code') || '';
    state = u.searchParams.get('state');
  }
  if (!/^[A-Za-z0-9._~-]{10,512}$/.test(code)) {
    throw new MeliError(400, 'Código de autorización con formato inválido. Pegá el código que empieza con "TG-" o la URL completa de la barra del navegador.');
  }
  return { code, state };
}

async function pedirToken(transporte, form) {
  const t = await transporte.solicitar({ metodo: 'POST', ruta: '/oauth/token', form: new URLSearchParams(form) });
  if (!t?.access_token) throw new MeliError(502, 'Mercado Libre no devolvió un access_token.');
  registrarSecreto(t.access_token);
  registrarSecreto(t.refresh_token);
  return t;
}

export function canjearCodigo({ transporte, clientId, clientSecret, code, redirectUri, verifier }) {
  return pedirToken(transporte, {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
}

export function refrescarToken({ transporte, clientId, clientSecret, refreshToken }) {
  return pedirToken(transporte, {
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
}
