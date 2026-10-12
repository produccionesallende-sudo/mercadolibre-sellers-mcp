// Gestión de cuentas conectadas y cliente autenticado de la API.
import { ConfigError, MeliError } from '../errores.js';
import { log } from '../log.js';
import {
  canjearCodigo, extraerCodigo, generarPkce, generarState, refrescarToken,
  urlDeAutorizacion, validarRedirectUri, VIDA_PENDIENTE_MS, AUTH_POR_SITIO,
} from './oauth.js';
import { ruta } from './transporte.js';

/** Se refresca el access token si le quedan menos de 5 minutos. */
const MARGEN_REFRESH_MS = 5 * 60 * 1000;
const VIDA_DEFAULT_S = 6 * 3600;

export class Sesiones {
  /**
   * @param {{config: any, almacen: import('../almacen.js').AlmacenCuentas, transporte: any, ahora?: () => number}} p
   */
  constructor({ config, almacen, transporte, ahora = Date.now }) {
    this.config = config;
    this.almacen = almacen;
    this.transporte = transporte;
    this.ahora = ahora;
    this._refrescos = new Map(); // single-flight dentro del proceso
  }

  _credenciales() {
    const { clientId, clientSecret } = this.config;
    if (!clientId || !clientSecret) {
      throw new ConfigError('Faltan ML_CLIENT_ID y/o ML_CLIENT_SECRET en la configuración del MCP. Creá tu aplicación en el DevCenter de Mercado Libre y cargá esos dos valores (ver README, paso 1 y 3).');
    }
    return { clientId, clientSecret };
  }

  // ───────────────────────── cuentas ─────────────────────────
  listar() {
    if (!this.almacen.existe()) return [];
    const d = this.almacen.leer();
    return Object.values(d.cuentas).map((c) => ({
      user_id: String(c.user_id),
      nickname: c.nickname,
      sitio: c.sitio,
      predeterminada: String(c.user_id) === d.predeterminada,
      conectada_el: c.conectada_el,
      requiere_reconexion: !!c.requiere_reconexion,
    }));
  }

  async fijarPredeterminada(userId) {
    return this.almacen.modificar((d) => {
      const c = d.cuentas[String(userId)];
      if (!c) throw new ConfigError(`La cuenta ${userId} no está conectada.`);
      d.predeterminada = String(userId);
      return c.nickname;
    });
  }

  async desconectar(userId) {
    if (userId === 'todas') return { borradas: this.almacen.borrarTodo() ? 'todas' : 0 };
    return this.almacen.modificar((d) => {
      const id = String(userId);
      const c = d.cuentas[id];
      if (!c) return { borradas: 0 };
      delete d.cuentas[id];
      if (d.predeterminada === id) delete d.predeterminada;
      return { borradas: 1, nickname: c.nickname };
    });
  }

  // ───────────────────────── OAuth ─────────────────────────
  redirectUri() {
    if (!this.config.redirectUri) {
      throw new ConfigError('Falta ML_REDIRECT_URI: tiene que ser EXACTAMENTE la misma "URI de redirect" que configuraste en tu aplicación del DevCenter de Mercado Libre (ver README, "Redirect URI").');
    }
    return validarRedirectUri(this.config.redirectUri);
  }

  async iniciarConexion({ sitio } = {}) {
    const { clientId } = this._credenciales();
    const { url: redirect, loopback } = this.redirectUri();
    const s = (sitio || this.config.sitio || 'MLA').toUpperCase();
    if (!AUTH_POR_SITIO[s]) throw new ConfigError(`Sitio desconocido: ${s}.`);
    const pkce = generarPkce();
    const state = generarState();
    await this.almacen.modificar((d) => {
      const ahora = this.ahora();
      for (const [k, p] of Object.entries(d.pendientes)) if (ahora - p.creado > VIDA_PENDIENTE_MS) delete d.pendientes[k];
      d.pendientes[state] = { verifier: pkce.verifier, redirectUri: redirect.toString(), sitio: s, creado: ahora };
    });
    return {
      url: urlDeAutorizacion({ clientId, redirectUri: redirect.toString(), sitio: s, state, challenge: pkce.challenge }),
      state,
      redirectUri: redirect.toString(),
      loopback,
      venceEnMin: VIDA_PENDIENTE_MS / 60000,
    };
  }

  /**
   * Completa la conexión con el código (o la URL completa de redirección).
   * Si viene `state`, debe coincidir con una autorización pendiente (anti-CSRF).
   * Si no viene, solo se acepta cuando hay UNA única autorización pendiente.
   * Además, PKCE garantiza que un código ajeno no se pueda canjear.
   */
  async completarConexion({ entrada, state: stateExplicito }) {
    const { clientId, clientSecret } = this._credenciales();
    const { code, state: stateUrl } = extraerCodigo(entrada);
    const state = stateExplicito || stateUrl;

    const pendiente = await this.almacen.modificar((d) => {
      const ahora = this.ahora();
      for (const [k, p] of Object.entries(d.pendientes)) if (ahora - p.creado > VIDA_PENDIENTE_MS) delete d.pendientes[k];
      let clave = state;
      if (state) {
        if (!d.pendientes[state]) throw new MeliError(400, 'El "state" no coincide con ninguna autorización iniciada desde esta computadora (o venció). Por seguridad no se completa la conexión: iniciá de nuevo con ml_conectar.');
      } else {
        const claves = Object.keys(d.pendientes);
        if (claves.length === 0) throw new MeliError(400, 'No hay una autorización iniciada (o venció a los 15 minutos). Usá ml_conectar sin código para obtener un enlace nuevo.');
        if (claves.length > 1) throw new MeliError(400, 'Hay varias autorizaciones iniciadas: pegá la URL COMPLETA de la barra del navegador (incluye el "state") para saber cuál completar.');
        clave = claves[0];
      }
      const p = d.pendientes[clave];
      delete d.pendientes[clave]; // un solo uso, aunque el canje falle
      return p;
    });

    const t = await canjearCodigo({
      transporte: this.transporte, clientId, clientSecret, code,
      redirectUri: pendiente.redirectUri, verifier: pendiente.verifier,
    });
    const me = await this.transporte.solicitar({ metodo: 'GET', ruta: '/users/me', token: t.access_token });
    const userId = String(t.user_id ?? me.id);
    if (me.id != null && String(me.id) !== userId) throw new MeliError(502, 'La identidad devuelta por Mercado Libre no coincide con el token.');
    if (!t.refresh_token) log.warn('Mercado Libre no devolvió refresh_token: activá el permiso offline_access en tu aplicación para que la sesión se renueve sola.');

    await this.almacen.modificar((d) => {
      d.cuentas[userId] = {
        user_id: userId,
        nickname: me.nickname || userId,
        sitio: me.site_id || pendiente.sitio,
        access_token: t.access_token,
        refresh_token: t.refresh_token || null,
        scope: t.scope || null,
        vence: this.ahora() + (Number(t.expires_in) || VIDA_DEFAULT_S) * 1000,
        conectada_el: new Date(this.ahora()).toISOString(),
      };
      if (!d.predeterminada || !d.cuentas[d.predeterminada]) d.predeterminada = userId;
    });
    return { user_id: userId, nickname: me.nickname || userId, sitio: me.site_id || pendiente.sitio, offline: !!t.refresh_token };
  }

  // ───────────────────────── tokens ─────────────────────────
  resolverCuenta(cuenta) {
    if (!this.almacen.existe()) throw new MeliError(401, 'Ninguna cuenta conectada.');
    const d = this.almacen.leer();
    const ids = Object.keys(d.cuentas);
    if (!ids.length) throw new MeliError(401, 'Ninguna cuenta conectada.');
    if (cuenta) {
      if (!d.cuentas[String(cuenta)]) throw new ConfigError(`La cuenta ${cuenta} no está conectada. Cuentas: ${ids.join(', ')} (ver ml_cuentas).`);
      return String(cuenta);
    }
    if (d.predeterminada && d.cuentas[d.predeterminada]) return d.predeterminada;
    if (ids.length === 1) return ids[0];
    throw new ConfigError(`Hay ${ids.length} cuentas conectadas: indicá cuál con el parámetro "cuenta" o fijá una predeterminada con ml_cuentas. Cuentas: ${ids.join(', ')}.`);
  }

  datosCuenta(userId) {
    const c = this.almacen.leer().cuentas[userId];
    if (!c) throw new MeliError(401, 'La cuenta ya no está conectada.');
    return { user_id: c.user_id, nickname: c.nickname, sitio: c.sitio };
  }

  async token(userId, { forzar = false } = {}) {
    const c = this.almacen.leer().cuentas[userId];
    if (!c) throw new MeliError(401, 'La cuenta ya no está conectada.');
    if (!forzar && this.ahora() < c.vence - MARGEN_REFRESH_MS) return c.access_token;
    if (!this._refrescos.has(userId)) {
      const p = this._refrescar(userId, c.access_token, forzar).finally(() => this._refrescos.delete(userId));
      this._refrescos.set(userId, p);
    }
    return this._refrescos.get(userId);
  }

  async _refrescar(userId, tokenViejo, forzar) {
    const { clientId, clientSecret } = this._credenciales();
    return this.almacen.conBloqueo(async () => {
      const d = this.almacen.leer();
      const c = d.cuentas[userId];
      if (!c) throw new MeliError(401, 'La cuenta ya no está conectada.');
      // ¿Otro proceso ya lo renovó mientras esperábamos el bloqueo?
      if (c.access_token !== tokenViejo && this.ahora() < c.vence - MARGEN_REFRESH_MS) return c.access_token;
      if (!forzar && this.ahora() < c.vence - MARGEN_REFRESH_MS) return c.access_token;
      if (!c.refresh_token) {
        throw new MeliError(401, 'La sesión venció y no hay refresh token (falta el permiso offline_access en la aplicación).');
      }
      let t;
      try {
        t = await refrescarToken({ transporte: this.transporte, clientId, clientSecret, refreshToken: c.refresh_token });
      } catch (e) {
        if (e instanceof MeliError && [400, 401, 403].includes(e.status)) {
          c.requiere_reconexion = true;
          this.almacen.guardar(d);
          throw new MeliError(401, 'Mercado Libre rechazó la renovación de la sesión (refresh token vencido, revocado o ya usado).');
        }
        throw e;
      }
      Object.assign(c, {
        access_token: t.access_token,
        refresh_token: t.refresh_token || c.refresh_token,
        vence: this.ahora() + (Number(t.expires_in) || VIDA_DEFAULT_S) * 1000,
        requiere_reconexion: false,
      });
      this.almacen.guardar(d);
      log.info(`Sesión renovada para la cuenta ${userId}.`);
      return c.access_token;
    });
  }

  /** Cliente autenticado para una cuenta (o la predeterminada). */
  cliente(cuenta) {
    const userId = this.resolverCuenta(cuenta);
    return new ClienteMeli(this, userId);
  }
}

export class ClienteMeli {
  constructor(sesiones, userId) {
    this.sesiones = sesiones;
    this.userId = userId;
    this._me = null;
  }

  async _pedir(p) {
    const t = this.sesiones.transporte;
    let token = await this.sesiones.token(this.userId);
    try {
      return await t.solicitar({ ...p, token });
    } catch (e) {
      if (!(e instanceof MeliError) || e.status !== 401) throw e;
      // Token rechazado antes de tiempo: renovar UNA vez y reintentar.
      token = await this.sesiones.token(this.userId, { forzar: true });
      return t.solicitar({ ...p, token });
    }
  }

  get(r, query) { return this._pedir({ metodo: 'GET', ruta: r, query }); }
  post(r, json, query) { return this._pedir({ metodo: 'POST', ruta: r, json, query }); }
  put(r, json, query) { return this._pedir({ metodo: 'PUT', ruta: r, json, query }); }
  del(r, query) { return this._pedir({ metodo: 'DELETE', ruta: r, query }); }
  multipart(r, formData, { timeoutMs = 180000 } = {}) { return this._pedir({ metodo: 'POST', ruta: r, multipart: formData, timeoutMs }); }

  /** /users/me cacheado durante la vida del cliente. */
  async me() {
    this._me ||= await this.get('/users/me');
    return this._me;
  }

  async sitio() {
    try { return this.sesiones.datosCuenta(this.userId).sitio || (await this.me()).site_id || 'MLA'; } catch { return 'MLA'; }
  }

  rutaUsuario(sufijo = '') {
    return ruta`/users/${this.userId}` + sufijo;
  }
}
