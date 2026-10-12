// Pruebas unitarias: configuración, redacción de secretos, OAuth/PKCE,
// transporte (allowlist, rutas, reintentos) y almacén cifrado.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { leerConfig, validarApiBase, HERRAMIENTAS_ESCRITURA, escrituraPermitida } from '../src/config.js';
import { redactar, registrarSecreto, olvidarSecretos } from '../src/redaccion.js';
import { generarPkce, urlDeAutorizacion, extraerCodigo, validarRedirectUri } from '../src/meli/oauth.js';
import { crearTransporte, ruta } from '../src/meli/transporte.js';
import { AlmacenCuentas } from '../src/almacen.js';
import { MeliError, ConfigError, mensajeParaUsuario } from '../src/errores.js';
import { dirTemporal, CLIENT_SECRET } from './ayuda/entorno.js';

describe('config', () => {
  test('SOLO_LECTURA es true por defecto y solo "false" explícito lo desactiva', () => {
    assert.equal(leerConfig({}).soloLectura, true);
    assert.equal(leerConfig({ SOLO_LECTURA: 'true' }).soloLectura, true);
    assert.equal(leerConfig({ SOLO_LECTURA: 'FALSE' }).soloLectura, false);
    assert.equal(leerConfig({ SOLO_LECTURA: 'false' }).soloLectura, false);
    assert.equal(leerConfig({ SOLO_LECTURA: 'no se' }).soloLectura, true, 'valor raro => solo lectura');
    assert.equal(leerConfig({ SOLO_LECTURA: '' }).soloLectura, true);
    assert.equal(leerConfig({ ML_SOLO_LECTURA: '1' }).soloLectura, true);
  });
  test('con solo lectura, ninguna escritura está permitida aunque se listen', () => {
    const c = leerConfig({ SOLO_LECTURA: 'true', ESCRITURAS_PERMITIDAS: 'ml_actualizar_publicacion' });
    assert.deepEqual([...c.escriturasPermitidas], []);
    for (const n of HERRAMIENTAS_ESCRITURA) assert.equal(escrituraPermitida(c, n), false);
  });
  test('escritura habilitada: lista vacía = todas; lista explícita filtra; nombres desconocidos se ignoran', () => {
    assert.deepEqual([...leerConfig({ SOLO_LECTURA: 'false' }).escriturasPermitidas], [...HERRAMIENTAS_ESCRITURA]);
    const c = leerConfig({ SOLO_LECTURA: 'false', ESCRITURAS_PERMITIDAS: 'ml_responder_pregunta, ml_inventada' });
    assert.deepEqual([...c.escriturasPermitidas], ['ml_responder_pregunta']);
    assert.equal(escrituraPermitida(c, 'ml_crear_publicacion'), false);
  });
  test('ML_API_BASE solo acepta la API oficial o loopback', () => {
    assert.equal(validarApiBase(undefined), 'https://api.mercadolibre.com');
    assert.equal(validarApiBase('https://api.mercadolibre.com/'), 'https://api.mercadolibre.com');
    assert.equal(validarApiBase('http://127.0.0.1:9999'), 'http://127.0.0.1:9999');
    assert.throws(() => validarApiBase('https://evil.example.com'), /solo puede ser/);
    assert.throws(() => validarApiBase('http://api.mercadolibre.com'), /solo puede ser/);
    assert.throws(() => validarApiBase('http://10.0.0.5:80'), /solo puede ser/);
  });
  test('ML_APP_ID / ML_APP_SECRET se aceptan como alias', () => {
    const c = leerConfig({ ML_APP_ID: '1', ML_APP_SECRET: 'abcdefg' });
    assert.equal(c.clientId, '1'); assert.equal(c.clientSecret, 'abcdefg');
  });
});

describe('redacción de secretos', () => {
  test('oculta tokens por patrón y valores registrados', () => {
    olvidarSecretos();
    registrarSecreto('MI-SECRETO-ESPECIAL-9876');
    const s = redactar('token APP_USR-1234567890-101010-abcdefabcdefabcdefabcdef-777 refresh TG-abcdefghij-777 Authorization: Bearer xyz.abc secret=MI-SECRETO-ESPECIAL-9876 {"client_secret":"hola","code":"TG-1"}');
    assert.ok(!s.includes('APP_USR-1234567890'));
    assert.ok(!s.includes('TG-abcdefghij'));
    assert.ok(!s.includes('xyz.abc'));
    assert.ok(!s.includes('MI-SECRETO-ESPECIAL'));
    assert.ok(!s.includes('"hola"'));
    assert.ok(s.includes('[REDACTADO]'));
  });
  test('MeliError redacta su mensaje', () => {
    const e = new MeliError(400, 'fallo con APP_USR-111111111-101010-aaaaaaaaaaaaaaaaaaaaaaaa-1');
    assert.ok(!e.message.includes('APP_USR-111111111'));
    assert.match(mensajeParaUsuario(new MeliError(429, 'x', { reintentarEn: 12 })), /12 segundos/);
    assert.match(mensajeParaUsuario(new MeliError(401, 'x')), /ml_conectar/);
    assert.match(mensajeParaUsuario(new MeliError(503, 'x')), /error interno/);
    assert.match(mensajeParaUsuario(new ConfigError('falta algo')), /falta algo/);
  });
});

describe('oauth / pkce', () => {
  test('PKCE S256 correcto y URL con state', () => {
    const { verifier, challenge } = generarPkce();
    assert.ok(verifier.length >= 43 && verifier.length <= 128);
    assert.equal(challenge, crypto.createHash('sha256').update(verifier).digest('base64url'));
    const u = new URL(urlDeAutorizacion({ clientId: '1', redirectUri: 'https://x.test/cb', sitio: 'MLM', state: 'st', challenge }));
    assert.equal(u.origin, 'https://auth.mercadolibre.com.mx');
    assert.equal(u.pathname, '/authorization');
    assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(u.searchParams.get('state'), 'st');
    assert.equal(u.searchParams.get('response_type'), 'code');
    assert.throws(() => urlDeAutorizacion({ clientId: '1', redirectUri: 'x', sitio: 'XXX', state: 's', challenge: 'c' }), /Sitio desconocido/);
  });
  test('extraerCodigo acepta código pelado o URL completa y rechaza basura', () => {
    assert.deepEqual(extraerCodigo('TG-abcdefghijklmnop-1'), { code: 'TG-abcdefghijklmnop-1', state: null });
    assert.deepEqual(extraerCodigo('https://x.test/cb?code=TG-abcdefghijklmnop-1&state=ZZ'), { code: 'TG-abcdefghijklmnop-1', state: 'ZZ' });
    assert.throws(() => extraerCodigo('hola'), /formato inválido/);
    assert.throws(() => extraerCodigo('https://x.test/cb?error=access_denied'), /access_denied/);
    assert.throws(() => extraerCodigo('TG-abc; rm -rf /'), /formato inválido/);
  });
  test('redirect URI: https o loopback http', () => {
    assert.equal(validarRedirectUri('https://x.test/cb').loopback, false);
    assert.equal(validarRedirectUri('http://127.0.0.1:8765/cb').loopback, true);
    assert.throws(() => validarRedirectUri('http://ejemplo.com/cb'), /HTTPS/);
    assert.throws(() => validarRedirectUri('https://x.test/cb#frag'), /fragmento/);
  });
});

describe('transporte', () => {
  test('tag ruta codifica parámetros y rechaza traversal', () => {
    assert.equal(ruta`/items/${'MLA 1/../x'}`, '/items/MLA%201%2F..%2Fx');
    assert.throws(() => ruta`/items/${'..'}`, /inválido/);
    assert.throws(() => ruta`/items/${''}`, /inválido/);
  });
  test('rechaza rutas inválidas y hosts ajenos; token solo en cabecera', async () => {
    const llamadas = [];
    const fetchImpl = async (u, o) => { llamadas.push({ u: String(u), o }); return new Response('{}', { status: 200 }); };
    const t = crearTransporte({ apiBase: 'https://api.mercadolibre.com', fetchImpl });
    await t.solicitar({ metodo: 'GET', ruta: '/users/me', token: 'TOK', query: { a: 1, b: undefined, c: '' } });
    assert.equal(llamadas[0].u, 'https://api.mercadolibre.com/users/me?a=1');
    assert.equal(llamadas[0].o.headers.Authorization, 'Bearer TOK');
    assert.equal(llamadas[0].o.redirect, 'error');
    await assert.rejects(t.solicitar({ metodo: 'GET', ruta: 'https://evil.test/x' }), /inválida/);
    await assert.rejects(t.solicitar({ metodo: 'GET', ruta: '//evil.test/x' }), /inválida/);
    await assert.rejects(t.solicitar({ metodo: 'GET', ruta: '/a/../b' }), /inválida/);
    await assert.rejects(t.solicitar({ metodo: 'GET', ruta: '/a?x=1' }), /inválida/);
  });
  test('reintenta 429 con Retry-After y 5xx en GET, no en POST; respeta límite', async () => {
    let n = 0;
    const fetchImpl = async () => { n++; return n < 3 ? new Response('{"message":"rate"}', { status: 429, headers: { 'retry-after': '0' } }) : new Response('{"ok":1}', { status: 200 }); };
    const t = crearTransporte({ apiBase: 'https://api.mercadolibre.com', fetchImpl, esperar: async () => {} });
    assert.deepEqual(await t.solicitar({ metodo: 'GET', ruta: '/x' }), { ok: 1 });
    assert.equal(n, 3);
    n = 0;
    const t2 = crearTransporte({ apiBase: 'https://api.mercadolibre.com', fetchImpl: async () => { n++; return new Response('{"message":"boom"}', { status: 500 }); }, esperar: async () => {}, maxReintentos: 2 });
    await assert.rejects(t2.solicitar({ metodo: 'GET', ruta: '/x' }), (e) => e.status === 500);
    assert.equal(n, 3, 'GET: 1 + 2 reintentos');
    n = 0;
    await assert.rejects(t2.solicitar({ metodo: 'POST', ruta: '/x', json: {} }), (e) => e.status === 500);
    assert.equal(n, 1, 'POST no se reintenta en 5xx');
  });
  test('timeout y error de red se traducen a MeliError status 0', async () => {
    const t = crearTransporte({ apiBase: 'https://api.mercadolibre.com', fetchImpl: async () => { throw new TypeError('fetch failed'); }, esperar: async () => {}, maxReintentos: 0 });
    await assert.rejects(t.solicitar({ metodo: 'GET', ruta: '/x' }), (e) => e instanceof MeliError && e.status === 0);
  });
});

describe('almacén cifrado', () => {
  test('cifra en disco, descifra con el secreto correcto y falla con otro', async () => {
    const dir = dirTemporal();
    const a = new AlmacenCuentas({ dirConfig: dir, clientSecret: CLIENT_SECRET });
    await a.modificar((d) => { d.cuentas['1'] = { user_id: '1', access_token: 'APP_USR-SECRETO-TOKEN-xyz', refresh_token: 'TG-refresh' }; });
    const crudo = fs.readFileSync(path.join(dir, 'cuentas.json'), 'utf8');
    assert.ok(!crudo.includes('APP_USR-SECRETO'), 'el token no está en claro en disco');
    assert.ok(!crudo.includes('TG-refresh'));
    assert.match(crudo, /aes-256-gcm/);
    assert.equal(a.leer().cuentas['1'].access_token, 'APP_USR-SECRETO-TOKEN-xyz');
    const b = new AlmacenCuentas({ dirConfig: dir, clientSecret: 'otro-secreto-distinto' });
    assert.throws(() => b.leer(), /descifrar/);
    if (process.platform !== 'win32') {
      assert.equal(fs.statSync(path.join(dir, 'cuentas.json')).mode & 0o777, 0o600);
      assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
    }
    assert.ok(!fs.readdirSync(dir).some((f) => f.endsWith('.tmp')), 'sin temporales');
    fs.rmSync(dir, { recursive: true, force: true });
  });
  test('bloqueo entre procesos: serializa y limpia; detecta bloqueo abandonado', async () => {
    const dir = dirTemporal();
    const a = new AlmacenCuentas({ dirConfig: dir, clientSecret: CLIENT_SECRET });
    const orden = [];
    await Promise.all([
      a.conBloqueo(async () => { orden.push('a1'); await new Promise((r) => setTimeout(r, 120)); orden.push('a2'); }),
      a.conBloqueo(async () => { orden.push('b1'); orden.push('b2'); }),
    ]);
    assert.deepEqual(orden.slice(0, 2), ['a1', 'a2']);
    assert.ok(!fs.existsSync(path.join(dir, 'cuentas.lock')));
    fs.writeFileSync(path.join(dir, 'cuentas.lock'), '1');
    const viejo = Date.now() / 1000 - 120;
    fs.utimesSync(path.join(dir, 'cuentas.lock'), viejo, viejo);
    await a.conBloqueo(async () => orden.push('c'));
    assert.ok(orden.includes('c'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  test('sin secreto no se puede abrir el almacén', async () => {
    const a = new AlmacenCuentas({ dirConfig: dirTemporal(), clientSecret: null });
    await assert.rejects(a.modificar(() => {}), ConfigError);
  });
});
