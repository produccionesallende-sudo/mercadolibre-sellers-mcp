// Flujo OAuth completo contra el simulador, refresh de tokens, expiración,
// reintento ante 401, multicuenta y desconexión.
import { test, describe, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { entorno, CLIENT_ID, REDIRECT, logs } from './ayuda/entorno.js';
import { CODE_OK, TOKEN_OK, REFRESH_1, REFRESH_2 } from './ayuda/mock-meli.js';
import { crearContexto } from '../src/servidor.js';
import { MeliError, ConfigError } from '../src/errores.js';

describe('oauth y sesiones', () => {
  let e;
  before(async () => { e = await entorno(); });
  after(async () => { await e.cerrar(); });

  test('iniciar conexión guarda PKCE+state pendiente y arma la URL oficial', async () => {
    const r = await e.ctx.sesiones.iniciarConexion({ sitio: 'MLA' });
    const u = new URL(r.url);
    assert.equal(u.origin, 'https://auth.mercadolibre.com.ar');
    assert.equal(u.searchParams.get('client_id'), CLIENT_ID);
    assert.equal(u.searchParams.get('redirect_uri'), REDIRECT);
    assert.equal(u.searchParams.get('state'), r.state);
    assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
    const d = e.ctx.almacen.leer();
    assert.ok(d.pendientes[r.state]?.verifier);
  });

  test('completar con state incorrecto se rechaza; sin state y 1 pendiente, se acepta', async () => {
    await assert.rejects(e.ctx.sesiones.completarConexion({ entrada: `${REDIRECT}?code=${CODE_OK}&state=INVENTADO` }), /state/);
    const r = await e.ctx.sesiones.completarConexion({ entrada: CODE_OK });
    assert.equal(r.user_id, '777'); assert.equal(r.nickname, 'TIENDA_DEMO'); assert.equal(r.offline, true);
    const canje = e.mock.estado.peticiones.find((p) => p.ruta === '/oauth/token');
    const cuerpo = Object.fromEntries(new URLSearchParams(canje.cuerpo));
    assert.equal(cuerpo.grant_type, 'authorization_code');
    assert.equal(cuerpo.redirect_uri, REDIRECT);
    assert.ok(cuerpo.code_verifier?.length >= 43, 'manda code_verifier (PKCE)');
    assert.equal(canje.headers['content-type'], 'application/x-www-form-urlencoded');
    assert.deepEqual(Object.keys(e.ctx.almacen.leer().pendientes), [], 'pendiente consumida');
  });

  test('código inválido => error claro y la pendiente se consume (un solo uso)', async () => {
    await e.ctx.sesiones.iniciarConexion({});
    await assert.rejects(e.ctx.sesiones.completarConexion({ entrada: 'TG-malo-malo-malo-malo' }), (err) => err instanceof MeliError && err.status === 400);
    await assert.rejects(e.ctx.sesiones.completarConexion({ entrada: CODE_OK }), /No hay una autorización iniciada/);
  });

  test('pendiente vencida (15 min) se descarta', async () => {
    let t = Date.now();
    const ctx2 = crearContexto({ env: e.env, ahora: () => t });
    await ctx2.sesiones.iniciarConexion({});
    t += 16 * 60 * 1000;
    await assert.rejects(ctx2.sesiones.completarConexion({ entrada: CODE_OK }), /No hay una autorización iniciada/);
    // La pendiente "del futuro" (reloj simulado) no debe contaminar las pruebas siguientes
    await e.ctx.almacen.modificar((d) => { d.pendientes = {}; });
  });

  test('token vigente no refresca; cerca de vencer refresca (single-flight) y rota el refresh token', async () => {
    let t = Date.now();
    const ctx2 = crearContexto({ env: e.env, ahora: () => t });
    e.mock.estado.refrescos = 0;
    assert.equal(await ctx2.sesiones.token('777'), TOKEN_OK);
    assert.equal(e.mock.estado.refrescos, 0);
    t += 6 * 3600 * 1000 - 60 * 1000; // a 1 minuto de vencer
    const [a, b, c] = await Promise.all([ctx2.sesiones.token('777'), ctx2.sesiones.token('777'), ctx2.sesiones.token('777')]);
    assert.equal(a, TOKEN_OK); assert.equal(b, TOKEN_OK); assert.equal(c, TOKEN_OK);
    assert.equal(e.mock.estado.refrescos, 1, 'un solo refresh para 3 pedidos concurrentes');
    assert.equal(ctx2.almacen.leer().cuentas['777'].refresh_token, REFRESH_2);
    const ref = e.mock.estado.peticiones.filter((p) => p.ruta === '/oauth/token').pop();
    assert.equal(Object.fromEntries(new URLSearchParams(ref.cuerpo)).refresh_token, REFRESH_1);
  });

  test('refresh rechazado por ML => 401 amigable y la cuenta queda marcada para reconectar', async () => {
    let t = Date.now() + 365 * 86400000;
    const ctx2 = crearContexto({ env: e.env, ahora: () => t });
    e.mock.estado.refreshValido = 'TG-otro-no-valido-xxxxxxxxxx';
    await assert.rejects(ctx2.sesiones.token('777'), (err) => err instanceof MeliError && err.status === 401);
    assert.equal(ctx2.sesiones.listar()[0].requiere_reconexion, true);
    e.mock.estado.refreshValido = REFRESH_2;
    assert.equal(await ctx2.sesiones.token('777'), TOKEN_OK, 'cuando ML vuelve a aceptar, se recupera');
  });

  test('401 inesperado en una llamada => un refresh forzado y un reintento', async () => {
    e.mock.estado.tokenValido = 'APP_USR-otro-token-que-el-mock-aceptara-ahora-1';
    e.mock.estado.refrescos = 0;
    const c = e.ctx.sesiones.cliente();
    const me = await c.get('/users/me');
    assert.equal(me.nickname, 'TIENDA_DEMO');
    assert.equal(e.mock.estado.refrescos, 1);
  });

  test('el token nunca viaja en la query ni a otro host', () => {
    for (const p of e.mock.estado.peticiones) {
      assert.ok(!('access_token' in p.query), `token en query en ${p.ruta}`);
      if (p.ruta !== '/oauth/token') assert.match(p.headers.authorization || '', /^Bearer /);
    }
  });

  test('multicuenta: segunda cuenta, predeterminada y resolución', async () => {
    await e.ctx.sesiones.iniciarConexion({});
    const r = await e.ctx.sesiones.completarConexion({ entrada: 'TG-dddddddddddddddddddddddd-888' });
    assert.equal(r.user_id, '888');
    assert.equal(e.ctx.sesiones.listar().length, 2);
    assert.equal(e.ctx.sesiones.resolverCuenta(), '777', 'la primera sigue como predeterminada');
    await e.ctx.sesiones.fijarPredeterminada('888');
    assert.equal(e.ctx.sesiones.resolverCuenta(), '888');
    assert.throws(() => e.ctx.sesiones.resolverCuenta('999'), ConfigError);
  });

  test('desconectar borra tokens; "todas" elimina el archivo', async () => {
    assert.equal((await e.ctx.sesiones.desconectar('888')).borradas, 1);
    assert.equal(e.ctx.sesiones.listar().length, 1);
    await e.ctx.sesiones.desconectar('todas');
    assert.ok(!fs.existsSync(e.ctx.almacen.archivo));
    assert.throws(() => e.ctx.sesiones.resolverCuenta(), (err) => err.status === 401);
  });

  test('los logs nunca contienen tokens, códigos ni el client secret', () => {
    const todo = logs.join('\n');
    for (const s of [TOKEN_OK, REFRESH_1, REFRESH_2, CODE_OK, e.env.ML_CLIENT_SECRET]) assert.ok(!todo.includes(s), `secreto en logs: ${s.slice(0, 12)}`);
  });
});
