// Almacén LOCAL de cuentas y tokens.
//
// Seguridad:
//  - Archivo único <dirConfig>/cuentas.json, cifrado con AES-256-GCM.
//    La clave se deriva (scrypt) del Client Secret de TU aplicación (+ el
//    opcional ML_CLAVE_ALMACEN). Una copia suelta del archivo no sirve sin ese
//    secreto, que vive en la configuración de Claude, no en este archivo.
//  - Carpeta 0700 y archivo 0600 (en Windows, la carpeta del perfil de usuario
//    ya está restringida a tu usuario).
//  - Escritura atómica (archivo temporal + rename).
//  - Bloqueo entre procesos para el refresh: el refresh_token de Mercado Libre
//    es de un solo uso; dos refresh simultáneos (p. ej. Claude Desktop y Claude
//    Code a la vez) podrían invalidar la sesión.
//  - Nada de esto sale de la computadora.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigError } from './errores.js';
import { registrarSecreto } from './redaccion.js';

const VERSION_FORMATO = 1;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export class AlmacenCuentas {
  /**
   * @param {{dirConfig: string, clientSecret: string|null, claveAlmacen?: string|null}} opciones
   */
  constructor({ dirConfig, clientSecret, claveAlmacen = null }) {
    this.dir = dirConfig;
    this.archivo = path.join(dirConfig, 'cuentas.json');
    this.archivoBloqueo = path.join(dirConfig, 'cuentas.lock');
    this.secreto = clientSecret ? clientSecret + (claveAlmacen ? '\u0000' + claveAlmacen : '') : null;
    this._claves = new Map(); // cache salt -> clave derivada
    this._salt = null; // salt vigente (el IV de GCM es aleatorio en cada escritura)
  }

  _asegurarDir() {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(this.dir, 0o700); } catch { /* Windows: sin efecto */ }
  }

  _clave(salt) {
    if (!this.secreto) throw new ConfigError('Falta ML_CLIENT_SECRET en la configuración: sin él no se puede abrir el almacén cifrado de tokens.');
    const k = salt.toString('base64');
    if (!this._claves.has(k)) this._claves.set(k, crypto.scryptSync(this.secreto, salt, 32, { N: 16384, r: 8, p: 1 }));
    return this._claves.get(k);
  }

  existe() {
    return fs.existsSync(this.archivo);
  }

  /** @returns {{cuentas: Record<string, any>, predeterminada?: string, pendientes: Record<string, any>}} */
  leer() {
    let crudo;
    try { crudo = fs.readFileSync(this.archivo, 'utf8'); } catch (e) {
      if (e.code === 'ENOENT') return { cuentas: {}, pendientes: {} };
      throw e;
    }
    let sobre;
    try { sobre = JSON.parse(crudo); } catch {
      throw new ConfigError(`El archivo de cuentas (${this.archivo}) está dañado. Borralo con ml_desconectar cuenta="todas" y volvé a conectar.`);
    }
    if (sobre?.version !== VERSION_FORMATO || !sobre.cifrado) {
      throw new ConfigError(`Formato de almacén desconocido en ${this.archivo}. Borralo con ml_desconectar cuenta="todas" y volvé a conectar.`);
    }
    const { salt, iv, tag, datos } = sobre.cifrado;
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', this._clave(Buffer.from(salt, 'base64')), Buffer.from(iv, 'base64'));
      d.setAuthTag(Buffer.from(tag, 'base64'));
      const plano = Buffer.concat([d.update(Buffer.from(datos, 'base64')), d.final()]).toString('utf8');
      this._salt = Buffer.from(salt, 'base64');
      const obj = JSON.parse(plano);
      obj.cuentas ||= {};
      obj.pendientes ||= {};
      for (const c of Object.values(obj.cuentas)) { registrarSecreto(c.access_token); registrarSecreto(c.refresh_token); }
      return obj;
    } catch (e) {
      if (e instanceof ConfigError) throw e;
      throw new ConfigError('No se pudieron descifrar los tokens guardados (¿cambió el ML_CLIENT_SECRET o ML_CLAVE_ALMACEN?). Ejecutá ml_desconectar cuenta="todas" y volvé a conectar las cuentas.');
    }
  }

  guardar(obj) {
    this._asegurarDir();
    this._salt ||= crypto.randomBytes(16);
    const salt = this._salt;
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', this._clave(salt), iv);
    const datos = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
    const sobre = {
      version: VERSION_FORMATO,
      aviso: 'Archivo cifrado con tokens de Mercado Libre. No lo compartas. Generado por mercadolibre-sellers-mcp.',
      cifrado: { alg: 'aes-256-gcm', kdf: 'scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), datos: datos.toString('base64') },
    };
    const tmp = `${this.archivo}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(sobre, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.archivo);
    try { fs.chmodSync(this.archivo, 0o600); } catch { /* Windows */ }
  }

  /** Lee, modifica y guarda dentro del bloqueo entre procesos. */
  async modificar(fn) {
    return this.conBloqueo(async () => {
      const d = this.leer();
      const r = await fn(d);
      this.guardar(d);
      return r;
    });
  }

  /**
   * Bloqueo simple entre procesos con archivo exclusivo (flag "wx").
   * Un bloqueo de más de 60 s se considera abandonado.
   */
  async conBloqueo(fn, { esperaMaxMs = 45000 } = {}) {
    this._asegurarDir();
    const inicio = Date.now();
    let fd;
    for (;;) {
      try {
        fd = fs.openSync(this.archivoBloqueo, 'wx', 0o600);
        fs.writeSync(fd, String(process.pid));
        break;
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        try {
          const edad = Date.now() - fs.statSync(this.archivoBloqueo).mtimeMs;
          if (edad > 60000) { fs.rmSync(this.archivoBloqueo, { force: true }); continue; }
        } catch { continue; }
        if (Date.now() - inicio > esperaMaxMs) throw new ConfigError('El almacén de cuentas está bloqueado por otro proceso. Reintentá en unos segundos.');
        await esperar(100 + Math.random() * 150);
      }
    }
    try {
      return await fn();
    } finally {
      try { fs.closeSync(fd); } catch { /* */ }
      fs.rmSync(this.archivoBloqueo, { force: true });
    }
  }

  /** Borra TODO el almacén local (todas las cuentas). */
  borrarTodo() {
    const habia = this.existe();
    fs.rmSync(this.archivo, { force: true });
    return habia;
  }
}
