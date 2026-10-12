// Arranque real del servidor MCP por stdio (proceso hijo) y diálogo con el
// cliente oficial del SDK: listado de herramientas, llamada de lectura, bloqueo
// de escritura, validación de argumentos y arranque sin credenciales.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { entorno } from './ayuda/entorno.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function clienteStdio(env) {
  const stderr = [];
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(raiz, 'src/index.js')], env: { ...env, PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT }, stderr: 'pipe' });
  transport.stderr?.on('data', (d) => stderr.push(String(d)));
  const client = new Client({ name: 'prueba', version: '0.0.0' });
  await client.connect(transport);
  return { client, stderr, cerrar: () => client.close() };
}

describe('servidor MCP por stdio', () => {
  test('arranca, lista 34 herramientas con anotaciones y marca bloqueadas las de escritura', async () => {
    const e = await entorno();
    await e.conectar();
    const { client, stderr, cerrar } = await clienteStdio(e.env);
    try {
      const { tools } = await client.listTools();
      assert.equal(tools.length, 34);
      const escritura = tools.filter((t) => t.annotations?.readOnlyHint === false);
      assert.equal(escritura.length, 6);
      for (const t of escritura) assert.match(t.description, /BLOQUEADA/);
      const lectura = tools.find((t) => t.name === 'ml_estado');
      assert.equal(lectura.annotations.readOnlyHint, true);
      assert.ok(lectura.inputSchema);

      const r1 = await client.callTool({ name: 'ml_cuentas', arguments: {} });
      assert.match(r1.content[0].text, /TIENDA_DEMO/);

      const r2 = await client.callTool({ name: 'ml_actualizar_publicacion', arguments: { item_id: 'MLA111', precio: 1, confirmar: true } });
      assert.equal(r2.isError, true);
      assert.match(r2.content[0].text, /SOLO LECTURA/);
      assert.equal(e.mock.estado.itemActualizado, null);

      const r3 = await client.callTool({ name: 'ml_publicacion', arguments: { item_id: 'no-valido' } });
      assert.equal(r3.isError, true, 'argumento inválido rechazado por el esquema');

      await new Promise((r) => setTimeout(r, 100));
      const err = stderr.join('');
      assert.match(err, /listo v.*34 herramientas.*SOLO LECTURA/);
      assert.ok(!err.includes(e.env.ML_CLIENT_SECRET));
      assert.ok(!err.includes('APP_USR-1111111111111111'));
    } finally {
      await cerrar();
      await e.cerrar();
    }
  });

  test('arranca sin credenciales (modo degradado) y ml_estado lo informa', async () => {
    const dir = fs.mkdtempSync(path.join(raiz, 'tmp-'));
    const { client, cerrar } = await clienteStdio({ ML_CONFIG_DIR: dir });
    try {
      const r = await client.callTool({ name: 'ml_estado', arguments: {} });
      assert.match(r.content[0].text, /falta ML_CLIENT_ID/);
      assert.match(r.content[0].text, /SOLO LECTURA/);
    } finally {
      await cerrar();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('con escritura habilitada, el proceso lo anuncia y la herramienta ejecuta', async () => {
    const e = await entorno({ SOLO_LECTURA: 'false', ESCRITURAS_PERMITIDAS: 'ml_actualizar_publicacion' });
    await e.conectar();
    const { client, stderr, cerrar } = await clienteStdio(e.env);
    try {
      const { tools } = await client.listTools();
      assert.ok(!tools.find((t) => t.name === 'ml_actualizar_publicacion').description.includes('BLOQUEADA'));
      assert.ok(tools.find((t) => t.name === 'ml_crear_publicacion').description.includes('BLOQUEADA'));
      const r = await client.callTool({ name: 'ml_actualizar_publicacion', arguments: { item_id: 'MLA111', stock: 9, confirmar: true } });
      assert.equal(r.isError, undefined);
      assert.equal(e.mock.estado.itemActualizado.available_quantity, 9);
      await new Promise((r) => setTimeout(r, 100));
      assert.match(stderr.join(''), /escritura: ml_actualizar_publicacion/);
    } finally {
      await cerrar();
      await e.cerrar();
    }
  });
});
