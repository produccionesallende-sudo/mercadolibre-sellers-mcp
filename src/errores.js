// Errores tipados y su traducción a mensajes claros para el usuario.
import { redactar } from './redaccion.js';

export class MeliError extends Error {
  /**
   * @param {number} status Código HTTP (0 = error de red / timeout)
   * @param {string} mensaje
   * @param {{codigo?: string, ruta?: string, reintentarEn?: number}} [extra]
   */
  constructor(status, mensaje, extra = {}) {
    super(redactar(mensaje));
    this.name = 'MeliError';
    this.status = status;
    this.codigo = extra.codigo;
    this.ruta = extra.ruta;
    this.reintentarEn = extra.reintentarEn;
  }
}

/** Error de configuración local (faltan variables, modo solo lectura, etc.). */
export class ConfigError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ConfigError';
  }
}

/** Escritura bloqueada por la política de seguridad. */
export class EscrituraBloqueadaError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'EscrituraBloqueadaError';
  }
}

export function mensajeParaUsuario(e) {
  if (e instanceof MeliError) {
    switch (e.status) {
      case 0:
        return `No se pudo contactar a Mercado Libre (${e.message}). Revisá tu conexión a internet y reintentá.`;
      case 400:
        return `Mercado Libre rechazó el pedido (400): ${e.message}`;
      case 401:
        return 'La sesión de Mercado Libre venció o fue revocada. Volvé a conectar la cuenta con ml_conectar.';
      case 403:
        return `Mercado Libre no permite esta operación para esta cuenta o aplicación (403): ${e.message}. Puede faltar un permiso (scope) en tu aplicación del DevCenter o la función no estar habilitada para tu cuenta/país.`;
      case 404:
        return `No encontrado en Mercado Libre (404): ${e.message}`;
      case 429:
        return `Mercado Libre está limitando la cantidad de consultas (429). Esperá ${e.reintentarEn ? Math.ceil(e.reintentarEn) + ' segundos' : 'un minuto'} y reintentá.`;
      default:
        if (e.status >= 500) return `Mercado Libre tuvo un error interno (${e.status}). Reintentá en unos minutos.`;
        return `Mercado Libre respondió ${e.status}: ${e.message}`;
    }
  }
  if (e instanceof ConfigError || e instanceof EscrituraBloqueadaError) return e.message;
  return `Error: ${redactar(e?.message ?? String(e))}`;
}
