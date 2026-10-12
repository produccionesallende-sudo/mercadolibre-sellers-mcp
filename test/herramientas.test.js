// Herramientas contra el simulador: lecturas, bloqueo de escrituras en modo
// solo lectura, escrituras habilitadas con confirmación, auditoría, errores de
// ML, rate limit y validación de parámetros.
import { test, describe, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { entorno, logs } from './ayuda/entorno.js';
import { TOKEN_OK } from './ayuda/mock-meli.js';
import { HERRAMIENTAS } from '../src/herramientas/index.js';
import { HERRAMIENTAS_ESCRITURA } from '../src/config.js';
import { ejecutarHerramienta, crearContexto } from '../src/servidor.js';

const porNombre = Object.fromEntries(HERRAMIENTAS.map((h) => [h.name, h]));
const llamar = (ctx, nombre, args) => ejecutarHerramienta(ctx, porNombre[nombre], args);
const texto = (r) => r.content[0].text;

describe('herramientas (modo solo lectura por defecto)', () => {
  let e;
  before(async () => { e = await entorno(); await e.conectar(); });
  after(async () => { await e.cerrar(); });

  test('inventario: 34 herramientas, 6 de escritura, nombres únicos, esquemas válidos', () => {
    assert.equal(HERRAMIENTAS.length, 34);
    assert.deepEqual(HERRAMIENTAS.filter((h) => !h.lectura).map((h) => h.name).sort(), [...HERRAMIENTAS_ESCRITURA].sort());
    for (const h of HERRAMIENTAS) {
      assert.match(h.name, /^ml_[a-z_]+$/);
      assert.ok(h.descripcion.length > 20);
      assert.doesNotThrow(() => z.object(h.esquema));
      if (!h.lectura) assert.ok(h.esquema.confirmar, `${h.name} exige confirmar`);
    }
  });

  test('ml_estado informa solo lectura y hosts', async () => {
    const t = texto(await llamar(e.ctx, 'ml_estado', {}));
    assert.match(t, /SOLO LECTURA/);
    assert.match(t, /Escrituras bloqueadas:\*\* ml_actualizar_publicacion/);
    assert.match(t, /auth\.mercadolibre/);
  });

  test('todas las escrituras quedan bloqueadas ANTES de tocar la red', async () => {
    const antes = e.mock.estado.peticiones.length;
    const casos = {
      ml_actualizar_publicacion: { item_id: 'MLA111', precio: 1, confirmar: true },
      ml_crear_publicacion: { titulo: 'x', categoria: 'MLA1', precio: 1, confirmar: true },
      ml_responder_pregunta: { pregunta_id: '555', texto: 'hola', confirmar: true },
      ml_aceptar_promocion: { item_id: 'MLA111', promocion_id: 'P1', tipo: 'DEAL', confirmar: true },
      ml_subir_clip: { item_id: 'MLA111', archivo: 'a.mp4', confirmar: true },
      ml_borrar_clip: { item_id: 'MLA111', clip_uuid: 'abc12345-xxxx', confirmar: true },
    };
    for (const n of HERRAMIENTAS_ESCRITURA) {
      const r = await ejecutarHerramienta(e.ctx, porNombre[n], casos[n]).catch((err) => ({ content: [{ type: 'text', text: err.message }], isError: true }));
      assert.equal(r.isError, true, n);
      assert.match(texto(r), /SOLO LECTURA/, n);
    }
    assert.equal(e.mock.estado.peticiones.length, antes, 'ninguna petición salió');
    assert.equal(e.mock.estado.itemActualizado, null);
    assert.equal(e.mock.estado.respuestas.length, 0);
  });

  test('lecturas principales devuelven datos del simulador', async () => {
    assert.match(texto(await llamar(e.ctx, 'ml_cuentas', {})), /TIENDA_DEMO.*777.*predeterminada/);
    assert.match(texto(await llamar(e.ctx, 'ml_ordenes', { dias: 7 })), /\*\*101\*\*.*Termo/);
    assert.match(texto(await llamar(e.ctx, 'ml_orden', { orden_id: '101' })), /COMPRADOR1/);
    const panel = texto(await llamar(e.ctx, 'ml_panel_ventas', {}));
    assert.match(panel, /Hoy:\*\* \$ 60\.500/); assert.match(panel, /FULL/); assert.match(panel, /Buenos Aires/);
    assert.match(texto(await llamar(e.ctx, 'ml_metricas', { dias: 7 })), /Facturación:\*\* \$ 80\.500/);
    assert.match(texto(await llamar(e.ctx, 'ml_envio', { orden_id: '101' })), /TRK123/);
    assert.match(texto(await llamar(e.ctx, 'ml_publicaciones', {})), /MLA111.*42\.000.*stock 10/);
    const pub = texto(await llamar(e.ctx, 'ml_publicacion', { item_id: 'MLA111' }));
    assert.match(pub, /Termo Acero/); assert.match(pub, /https:\/\/http2\.mlstatic\.com\/a\.jpg/); assert.match(pub, /Descripción original/);
    assert.match(texto(await llamar(e.ctx, 'ml_visitas', { item_id: 'MLA111' })), /1\.234 visitas/);
    const aud = texto(await llamar(e.ctx, 'ml_auditar_publicaciones', {}));
    assert.match(aud, /🔴 MLA222/); assert.match(aud, /SIN STOCK/); assert.match(aud, /perdiendo el catálogo/); assert.match(aud, /solo lectura/i);
    assert.match(texto(await llamar(e.ctx, 'ml_preguntas', {})), /\[555\][\s\S]*Tienen stock/);
    assert.match(texto(await llamar(e.ctx, 'ml_comisiones', { precio: 42000 })), /Clásica.*5\.880/);
    assert.match(texto(await llamar(e.ctx, 'ml_precio_catalogo', { item_id: 'MLA111' })), /Perdiendo.*\n.*39\.990/);
    assert.match(texto(await llamar(e.ctx, 'ml_buscar', { consulta: 'termo' })), /LIDER/);
    assert.match(texto(await llamar(e.ctx, 'ml_reputacion', {})), /platinum/);
    assert.match(texto(await llamar(e.ctx, 'ml_promociones', {})), /Hot Sale/);
    assert.match(texto(await llamar(e.ctx, 'ml_promociones', { promocion_id: 'P1', tipo: 'DEAL' })), /37\.800/);
    assert.match(texto(await llamar(e.ctx, 'ml_tendencias', {})), /termo stanley/);
    assert.match(texto(await llamar(e.ctx, 'ml_categorias', { titulo: 'termo acero' })), /MLA1055/);
    assert.match(texto(await llamar(e.ctx, 'ml_descubrir_ganadores', { categoria: 'MLA1055' })), /Ranking oficial/);
    assert.match(texto(await llamar(e.ctx, 'ml_descubrir_ganadores', { busqueda: 'termo' })), /Señal de oportunidad/);
    assert.match(texto(await llamar(e.ctx, 'ml_publicidad', {})), /Campaña A.*12\.000/);
    assert.match(texto(await llamar(e.ctx, 'ml_publicidad', { item_id: 'MLA111' })), /Grupo termo/);
    const rent = texto(await llamar(e.ctx, 'ml_rentabilidad', { item_id: 'MLA111', costo: 20000, impuestos_pct: 5 }));
    assert.match(rent, /Ganancia neta/); assert.match(rent, /14%/);
    assert.match(texto(await llamar(e.ctx, 'ml_rentabilidad', { precio: 100 })), /me falta/);
    assert.match(texto(await llamar(e.ctx, 'ml_clips', { item_id: 'MLA111' })), /rechazado.*\n.*duplicado/);
    assert.match(texto(await llamar(e.ctx, 'ml_clips', {})), /Mapa de video/);
  });

  test('usa /items/bulk, cabeceras nuevas de envíos y api-version de Product Ads', () => {
    const ps = e.mock.estado.peticiones;
    assert.ok(ps.some((p) => p.ruta === '/items/bulk'));
    assert.ok(ps.some((p) => p.ruta.startsWith('/shipments/') && p.headers['x-format-new'] === 'true'));
    assert.ok(ps.some((p) => p.ruta.includes('/product_ads/campaigns/search') && p.headers['api-version'] === '2'));
    assert.ok(ps.every((p) => !p.ruta.startsWith('/advertising/product_ads/')), 'no usa rutas de Product Ads dadas de baja');
  });

  test('vigilancia local: agregar, novedades, historial', async () => {
    assert.match(texto(await llamar(e.ctx, 'ml_vigilar', { accion: 'agregar', tipo: 'vendedor', ref: 'RIVAL', nota: 'rival directo' })), /Agregado/);
    assert.match(texto(await llamar(e.ctx, 'ml_vigilar', { accion: 'agregar', tipo: 'publicacion', ref: 'MLA111' })), /Agregado/);
    assert.match(texto(await llamar(e.ctx, 'ml_vigilar', { accion: 'listar' })), /Rivales.*\n.*RIVAL/);
    assert.match(texto(await llamar(e.ctx, 'ml_novedades_competencia', {})), /Sin novedades/);
    e.mock.items.MLA111.price = 45000; e.mock.items.MLA111.sold_quantity = 60;
    const nov = texto(await llamar(e.ctx, 'ml_novedades_competencia', {}));
    assert.match(nov, /42\.000 → \$ 45\.000/); assert.match(nov, /~5 unidad/);
    assert.match(texto(await llamar(e.ctx, 'ml_historial_competencia', { ref: 'MLA111' })), /\| Fecha \| Precio/);
    assert.match(texto(await llamar(e.ctx, 'ml_vigilar', { accion: 'quitar', ref: 'RIVAL' })), /Quitado/);
    e.mock.items.MLA111.price = 42000;
  });

  test('errores de Mercado Libre se traducen (404, 429 agotado, 500)', async () => {
    const r404 = await llamar(e.ctx, 'ml_publicacion', { item_id: 'MLA999999' });
    assert.equal(r404.isError, true); assert.match(texto(r404), /No encontrado.*404/);
    e.mock.estado.fallar429 = 10;
    const ctxRapido = crearContexto({ env: e.env });
    ctxRapido.transporte = e.ctx.transporte; // comparte transporte real (con backoff) — usamos uno con espera nula:
    const { crearTransporte } = await import('../src/meli/transporte.js');
    const { Sesiones } = await import('../src/meli/sesiones.js');
    const transporte = crearTransporte({ apiBase: e.apiBase, esperar: async () => {}, maxReintentos: 2 });
    ctxRapido.sesiones = new Sesiones({ config: ctxRapido.config, almacen: ctxRapido.almacen, transporte });
    const r429 = await llamar(ctxRapido, 'ml_reputacion', {});
    assert.equal(r429.isError, true); assert.match(texto(r429), /limitando.*429/);
    e.mock.estado.fallar429 = 0;
    e.mock.estado.fallar500 = 5;
    const r500 = await llamar(ctxRapido, 'ml_reputacion', {});
    assert.match(texto(r500), /error interno/);
    e.mock.estado.fallar500 = 0;
    e.mock.estado.fallar429 = 1;
    assert.match(texto(await llamar(ctxRapido, 'ml_reputacion', {})), /platinum/, 'un 429 aislado se reintenta y pasa');
  });

  test('validación de parámetros (zod) rechaza entradas inválidas', () => {
    const esq = z.object(porNombre.ml_publicacion.esquema);
    assert.equal(esq.safeParse({ item_id: 'MLA111' }).success, true);
    assert.equal(esq.safeParse({ item_id: '../etc/passwd' }).success, false);
    assert.equal(esq.safeParse({ item_id: 'MLA111', cuenta: 'abc' }).success, false);
    assert.equal(z.object(porNombre.ml_ordenes.esquema).safeParse({ dias: 0 }).success, false);
    assert.equal(z.object(porNombre.ml_ordenes.esquema).safeParse({ limite: 9999 }).success, false);
    assert.equal(z.object(porNombre.ml_responder_pregunta.esquema).safeParse({ pregunta_id: '1', texto: 'x', confirmar: false }).success, false);
    assert.equal(z.object(porNombre.ml_crear_publicacion.esquema).safeParse({ imagenes: ['http://inseguro.test/a.jpg'], confirmar: true }).success, false);
  });

  test('sin cuenta conectada, las herramientas guían a ml_conectar', async () => {
    const ctx2 = crearContexto({ env: { ...e.env, ML_CONFIG_DIR: fs.mkdtempSync(path.join(e.env.ML_CONFIG_DIR, 'vacio-')) } });
    const r = await llamar(ctx2, 'ml_ordenes', {});
    assert.equal(r.isError, true); assert.match(texto(r), /ml_conectar/);
    assert.match(texto(await llamar(ctx2, 'ml_cuentas', {})), /No hay cuentas/);
  });

  test('sin credenciales, ml_conectar explica qué falta sin exponer nada', async () => {
    const ctx2 = crearContexto({ env: { ML_CONFIG_DIR: e.env.ML_CONFIG_DIR, ML_API_BASE: e.apiBase } });
    const r = await llamar(ctx2, 'ml_conectar', {});
    assert.equal(r.isError, true); assert.match(texto(r), /ML_CLIENT_ID/);
  });

  test('ml_conectar devuelve la URL oficial y luego completa con la URL pegada', async () => {
    const t1 = texto(await llamar(e.ctx, 'ml_conectar', { sitio: 'MLA' }));
    const url = t1.match(/https:\/\/auth\.mercadolibre\.com\.ar\/authorization\?[^\s]+/)[0];
    const state = new URL(url).searchParams.get('state');
    const t2 = texto(await llamar(e.ctx, 'ml_conectar', { codigo: `https://ejemplo.test/callback?code=TG-cccccccccccccccccccccccc-777&state=${state}` }));
    assert.match(t2, /Cuenta conectada.*TIENDA_DEMO/);
    assert.match(t2, /SOLO LECTURA/);
  });

  test('ml_desconectar con revocación llama al endpoint oficial', async () => {
    const t = texto(await llamar(e.ctx, 'ml_desconectar', { cuenta: '777', revocar_en_mercadolibre: true }));
    assert.match(t, /revocada/); assert.match(t, /tokens borrados/);
    assert.ok(e.mock.estado.peticiones.some((p) => p.metodo === 'DELETE' && p.ruta === '/users/777/applications/1234567890123456'));
    await e.conectar();
  });

  test('las respuestas y logs no filtran tokens', () => {
    assert.ok(!logs.join('\n').includes(TOKEN_OK));
  });
});

describe('herramientas de escritura (SOLO_LECTURA=false)', () => {
  let e;
  before(async () => { e = await entorno({ SOLO_LECTURA: 'false', ESCRITURAS_PERMITIDAS: 'ml_actualizar_publicacion,ml_responder_pregunta,ml_aceptar_promocion,ml_crear_publicacion,ml_borrar_clip,ml_subir_clip' }); await e.conectar(); });
  after(async () => { await e.cerrar(); });

  test('sin confirmar=true no se ejecuta nada', async () => {
    const t = texto(await llamar(e.ctx, 'ml_actualizar_publicacion', { item_id: 'MLA111', precio: 43000 }));
    assert.match(t, /No se ejecutó/);
    assert.equal(e.mock.estado.itemActualizado, null);
  });

  test('actualizar publicación hace PUT /items/{id} y registra auditoría redactada', async () => {
    const t = texto(await llamar(e.ctx, 'ml_actualizar_publicacion', { item_id: 'MLA111', precio: 43000, stock: 7, confirmar: true }));
    assert.match(t, /actualizado/); assert.match(t, /43\.000/);
    assert.deepEqual(e.mock.estado.itemActualizado, { price: 43000, available_quantity: 7 });
    const log = fs.readFileSync(e.ctx.politica.archivoAuditoria, 'utf8');
    assert.match(log, /"herramienta":"ml_actualizar_publicacion"/);
    assert.match(log, /"ok":true/);
    assert.ok(!log.includes(TOKEN_OK));
    e.mock.items.MLA111.price = 42000; e.mock.items.MLA111.available_quantity = 10;
  });

  test('responder pregunta bloquea datos de contacto y publica texto limpio', async () => {
    assert.match(texto(await llamar(e.ctx, 'ml_responder_pregunta', { pregunta_id: '555', texto: 'Llamame al 11 5555 1234', confirmar: true })), /datos de contacto/);
    assert.equal(e.mock.estado.respuestas.length, 0);
    assert.match(texto(await llamar(e.ctx, 'ml_responder_pregunta', { pregunta_id: '555', texto: 'Sí, tenemos stock. ¡Comprá con confianza!', confirmar: true })), /publicada/);
    assert.deepEqual(e.mock.estado.respuestas[0], { question_id: 555, text: 'Sí, tenemos stock. ¡Comprá con confianza!' });
  });

  test('aceptar promoción y crear publicación clonando una propia', async () => {
    assert.match(texto(await llamar(e.ctx, 'ml_aceptar_promocion', { item_id: 'MLA111', promocion_id: 'P1', tipo: 'DEAL', precio_final: 37800, confirmar: true })), /aceptado/);
    assert.equal(e.mock.estado.promoAceptada.deal_price, 37800);
    const t = texto(await llamar(e.ctx, 'ml_crear_publicacion', { copiar_de: 'MLA111', titulo: 'Termo Copia', stock: 3, confirmar: true }));
    assert.match(t, /MLA999/);
    assert.equal(e.mock.estado.itemCreado.title, 'Termo Copia');
    assert.equal(e.mock.estado.itemCreado.category_id, 'MLA1055');
    assert.equal(e.mock.estado.itemCreado.available_quantity, 3);
    assert.ok(e.mock.estado.peticiones.some((p) => p.ruta === '/items/MLA999/description' && p.metodo === 'POST'));
  });

  test('subir clip: solo dentro de la carpeta de clips; borrar clip', async () => {
    assert.match(texto(await llamar(e.ctx, 'ml_subir_clip', { item_id: 'MLA111', archivo: '../../etc/passwd', confirmar: true })), /solo se leen videos dentro/);
    assert.match(texto(await llamar(e.ctx, 'ml_subir_clip', { item_id: 'MLA111', archivo: 'no-existe.mp4', confirmar: true })), /No encuentro/);
    fs.mkdirSync(e.ctx.config.dirClips, { recursive: true });
    fs.writeFileSync(path.join(e.ctx.config.dirClips, 'clip.mp4'), Buffer.alloc(1024));
    fs.writeFileSync(path.join(e.ctx.config.dirClips, 'clip.txt'), 'x');
    assert.match(texto(await llamar(e.ctx, 'ml_subir_clip', { item_id: 'MLA111', archivo: 'clip.txt', confirmar: true })), /solo acepta/);
    assert.match(texto(await llamar(e.ctx, 'ml_subir_clip', { item_id: 'MLA111', archivo: 'clip.mp4', confirmar: true })), /Clip subido/);
    const sub = e.mock.estado.peticiones.find((p) => p.ruta.endsWith('/clips/upload'));
    assert.match(sub.headers['content-type'], /multipart\/form-data/);
    assert.match(texto(await llamar(e.ctx, 'ml_borrar_clip', { item_id: 'MLA111', clip_uuid: 'abc12345-xxxx', confirmar: true })), /borrado/);
  });

  test('ESCRITURAS_PERMITIDAS parcial bloquea el resto', async () => {
    const ctx2 = crearContexto({ env: { ...e.env, ESCRITURAS_PERMITIDAS: 'ml_responder_pregunta' } });
    const r = await ejecutarHerramienta(ctx2, porNombre.ml_actualizar_publicacion, { item_id: 'MLA111', precio: 1, confirmar: true }).catch((err) => ({ isError: true, content: [{ text: err.message }] }));
    assert.equal(r.isError, true); assert.match(texto(r), /no está en ESCRITURAS_PERMITIDAS/);
  });
});
