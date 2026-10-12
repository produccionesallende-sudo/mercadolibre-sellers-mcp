// Receptor HTTP de notificaciones de Mercado Libre.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearReceptor, leerConfigNotificaciones, interpretarNotificacion, LIMITE_CUERPO } from '../src/notificaciones/receptor.js';
import { configurarLog } from '../src/log.js';

const logs = [];
configurarLog({ nivel: 'debug', escritor: (l) => logs.push(l) });

const EJEMPLO = { _id: 'abc-123', resource: '/orders/2195160686', user_id: 777, topic: 'orders_v2', application_id: 1234567890123456, attempts: 1, sent: '2026-10-12T10:00:00.000Z', received: '2026-10-12T10:00:00.100Z' };

describe('configuración del receptor', () => {
  test('valores por defecto y validaciones', () => {
    const c = leerConfigNotificaciones({});
    assert.equal(c.puerto, 3000); assert.equal(c.ruta, '/notifications'); assert.equal(c.host, '0.0.0.0'); assert.equal(c.clientId, null);
    assert.equal(leerConfigNotificaciones({ PORT: '8080', NOTIFICACIONES_RUTA: 'hooks/ml/' }).ruta, '/hooks/ml');
    assert.equal(leerConfigNotificaciones({ PORT: '8080' }).puerto, 8080);
    assert.throws(() => leerConfigNotificaciones({ PORT: 'abc' }), /PORT inválido/);
    assert.throws(() => leerConfigNotificaciones({ NOTIFICACIONES_RUTA: '/a b' }), /inválida/);
  });
  test('interpretarNotificacion valida y recorta', () => {
    assert.equal(interpretarNotificacion(EJEMPLO).ok, true);
    assert.equal(interpretarNotificacion(EJEMPLO).notificacion.topic_conocido, true);
    assert.equal(interpretarNotificacion({ topic: 'raro', resource: '/x' }).notificacion.topic_conocido, false);
    assert.equal(interpretarNotificacion([]).ok, false);
    assert.equal(interpretarNotificacion({ topic: 'orders_v2' }).ok, false);
    assert.equal(interpretarNotificacion({ topic: 'orders_v2', resource: 'http://evil' }).ok, false);
  });
});

describe('receptor HTTP', () => {
  let r, base, archivo, recibidas = [];
  before(async () => {
    archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mlnotif-')), 'sub', 'notificaciones.jsonl');
    r = crearReceptor(leerConfigNotificaciones({ PORT: '0', NOTIFICACIONES_HOST: '127.0.0.1', ML_CLIENT_ID: '1234567890123456', NOTIFICACIONES_ARCHIVO: archivo }), { alRecibir: (n) => recibidas.push(n) });
    const puerto = await r.iniciar();
    base = `http://127.0.0.1:${puerto}`;
  });
  after(async () => { await r.detener(); fs.rmSync(path.dirname(path.dirname(archivo)), { recursive: true, force: true }); });

  const post = (cuerpo, { ruta = '/notifications', headers = { 'Content-Type': 'application/json' } } = {}) =>
    fetch(base + ruta, { method: 'POST', headers, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });

  test('GET /health responde 200 sin datos sensibles', async () => {
    const res = await fetch(base + '/health');
    assert.equal(res.status, 200);
    const j = await res.json();
    assert.equal(j.ok, true); assert.ok(j.version);
    assert.ok(!JSON.stringify(j).includes('1234567890123456'));
  });

  test('POST válido de Mercado Libre → 200 rápido, log y archivo', async () => {
    const t0 = Date.now();
    const res = await post(EJEMPLO);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.ok(Date.now() - t0 < 500);
    await new Promise((ok) => setTimeout(ok, 20));
    assert.equal(recibidas.length, 1);
    assert.equal(recibidas[0].topic, 'orders_v2');
    assert.equal(recibidas[0].resource, '/orders/2195160686');
    assert.equal(r.contadores.aceptadas, 1);
    assert.ok(logs.some((l) => l.includes('Notificación recibida') && l.includes('topic=orders_v2') && l.includes('/orders/2195160686')));
    const linea = fs.readFileSync(archivo, 'utf8').trim().split('\n');
    assert.equal(linea.length, 1);
    assert.equal(JSON.parse(linea[0]).topic, 'orders_v2');
  });

  test('application_id distinto → 200 pero se ignora', async () => {
    const res = await post({ ...EJEMPLO, application_id: 999 });
    assert.equal(res.status, 200);
    await new Promise((ok) => setTimeout(ok, 20));
    assert.equal(r.contadores.ignoradas, 1);
    assert.equal(recibidas.length, 1, 'no se procesó');
    assert.ok(logs.some((l) => l.includes('ignorada') && l.includes('999')));
  });

  test('errores: JSON inválido 400, cuerpo sin topic 400, content-type 415, cuerpo grande 413, método 405, ruta 404', async () => {
    assert.equal((await post('{no es json')).status, 400);
    assert.equal((await post({ hola: 1 })).status, 400);
    assert.equal((await post('x=1', { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).status, 415);
    assert.equal((await post({ ...EJEMPLO, relleno: 'x'.repeat(LIMITE_CUERPO + 10) })).status, 413);
    assert.equal((await fetch(base + '/notifications')).status, 405);
    assert.equal((await post(EJEMPLO, { ruta: '/otra' })).status, 404);
    assert.equal((await fetch(base + '/health', { method: 'DELETE' })).status, 405);
    assert.equal(r.contadores.rechazadas, 4);
    assert.equal(recibidas.length, 1);
  });

  test('un fallo en el procesamiento posterior no afecta la respuesta 200', async () => {
    const r2 = crearReceptor(leerConfigNotificaciones({ PORT: '0', NOTIFICACIONES_HOST: '127.0.0.1' }), { alRecibir: () => { throw new Error('explota'); } });
    const p = await r2.iniciar();
    try {
      const res = await fetch(`http://127.0.0.1:${p}/notifications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(EJEMPLO) });
      assert.equal(res.status, 200);
      await new Promise((ok) => setTimeout(ok, 20));
      assert.ok(logs.some((l) => l.includes('Error en el procesamiento') && l.includes('explota')));
      assert.equal(r2.contadores.aceptadas, 1, 'sin ML_CLIENT_ID no se filtra');
    } finally { await r2.detener(); }
  });

  test('los logs no contienen cuerpos crudos ni tokens', async () => {
    await post({ ...EJEMPLO, access_token: 'APP_USR-1111111111111111-101010-abcdefabcdefabcdefabcdefabcdefab-777' });
    await new Promise((ok) => setTimeout(ok, 20));
    const todo = logs.join('\n');
    assert.ok(!todo.includes('APP_USR-1111111111111111'));
    assert.ok(!todo.includes('"received"'), 'no se vuelca el JSON completo');
    assert.ok(!fs.readFileSync(archivo, 'utf8').includes('APP_USR-1111111111111111'));
  });
});
