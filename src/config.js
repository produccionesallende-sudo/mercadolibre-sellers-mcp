// Lectura y validación de la configuración (variables de entorno).
// Principio: ante cualquier duda, el modo más seguro. SOLO_LECTURA solo se
// desactiva con un "false" explícito; cualquier otro valor deja solo lectura.
import os from 'node:os';
import path from 'node:path';
import { registrarSecreto } from './redaccion.js';
import { log } from './log.js';

export const API_OFICIAL = 'https://api.mercadolibre.com';

/** Herramientas que modifican Mercado Libre (deshabilitadas por defecto). */
export const HERRAMIENTAS_ESCRITURA = Object.freeze([
  'ml_actualizar_publicacion',
  'ml_crear_publicacion',
  'ml_responder_pregunta',
  'ml_aceptar_promocion',
  'ml_subir_clip',
  'ml_borrar_clip',
]);

const FALSOS = new Set(['false', '0', 'no', 'off']);
const VERDADEROS = new Set(['true', '1', 'si', 'sí', 'yes', 'on']);

function leerSoloLectura(valor) {
  if (valor == null || String(valor).trim() === '') return true;
  const v = String(valor).trim().toLowerCase();
  if (FALSOS.has(v)) return false;
  if (!VERDADEROS.has(v)) log.warn(`SOLO_LECTURA tiene un valor no reconocido ("${valor}"): se mantiene SOLO LECTURA.`);
  return true;
}

/**
 * Solo se acepta la API oficial por HTTPS. Para pruebas automatizadas se
 * permite un servidor simulado en loopback (127.0.0.1 / localhost / ::1),
 * nunca otro host: así un error de configuración no puede mandar tokens a
 * un tercero.
 */
export function validarApiBase(valor) {
  if (!valor) return API_OFICIAL;
  let u;
  try { u = new URL(valor); } catch { throw new Error(`ML_API_BASE inválida: ${valor}`); }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
  if (u.protocol === 'https:' && u.hostname === 'api.mercadolibre.com') return API_OFICIAL;
  if (u.protocol === 'http:' && loopback) return u.origin;
  throw new Error(`ML_API_BASE solo puede ser ${API_OFICIAL} (o un simulador local en 127.0.0.1 para pruebas). Valor rechazado: ${u.origin}`);
}

function leerLista(valor) {
  return String(valor || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * @param {NodeJS.ProcessEnv} env
 */
export function leerConfig(env = process.env) {
  const clientId = (env.ML_CLIENT_ID || env.ML_APP_ID || '').trim() || null;
  const clientSecret = (env.ML_CLIENT_SECRET || env.ML_APP_SECRET || '').trim() || null;
  const claveAlmacen = (env.ML_CLAVE_ALMACEN || '').trim() || null;
  registrarSecreto(clientSecret);
  registrarSecreto(claveAlmacen);

  const soloLectura = leerSoloLectura(env.SOLO_LECTURA ?? env.ML_SOLO_LECTURA);

  const pedidas = leerLista(env.ESCRITURAS_PERMITIDAS);
  const desconocidas = pedidas.filter((n) => !HERRAMIENTAS_ESCRITURA.includes(n));
  if (desconocidas.length) log.warn(`ESCRITURAS_PERMITIDAS contiene nombres desconocidos (ignorados): ${desconocidas.join(', ')}`);
  const validas = pedidas.filter((n) => HERRAMIENTAS_ESCRITURA.includes(n));
  const escriturasPermitidas = soloLectura ? [] : (validas.length ? validas : [...HERRAMIENTAS_ESCRITURA]);

  const dirConfig = path.resolve(env.ML_CONFIG_DIR?.trim() || path.join(os.homedir(), '.mercadolibre-sellers-mcp'));
  const dirClips = path.resolve(env.ML_DIRECTORIO_CLIPS?.trim() || path.join(dirConfig, 'clips'));

  return Object.freeze({
    clientId,
    clientSecret,
    claveAlmacen,
    redirectUri: (env.ML_REDIRECT_URI || '').trim() || null,
    sitio: (env.ML_SITE || 'MLA').trim().toUpperCase(),
    soloLectura,
    escriturasPermitidas: Object.freeze(escriturasPermitidas),
    dirConfig,
    dirClips,
    apiBase: validarApiBase(env.ML_API_BASE?.trim()),
  });
}

export function escrituraPermitida(config, herramienta) {
  return !config.soloLectura && config.escriturasPermitidas.includes(herramienta);
}
