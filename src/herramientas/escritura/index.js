// HERRAMIENTAS DE ESCRITURA — modifican la cuenta real de Mercado Libre.
// Están deshabilitadas por defecto (SOLO_LECTURA=true). Aunque se habiliten,
// cada una exige `confirmar: true` y describe el cambio exacto. El servidor
// (src/servidor.js) verifica la política ANTES de llamar a run() y registra
// cada ejecución en el log local de auditoría.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { cuentaParam, itemId, clientePara } from '../comunes.js';
import { ruta } from '../../meli/transporte.js';
import { dinero, numero } from '../../formato.js';
import { MeliError } from '../../errores.js';

const confirmar = z.literal(true).describe('Debe ser true: confirma que el usuario aprobó este cambio exacto en la conversación');

function faltaConfirmacion(args) {
  return args.confirmar !== true ? '⚠️ No se ejecutó: esta operación modifica tu cuenta real. Mostrá el cambio exacto al usuario y repetí la llamada con confirmar=true solo si lo aprueba.' : null;
}

export const herramientas = [
  {
    name: 'ml_actualizar_publicacion',
    titulo: 'Actualizar publicación (ESCRITURA)',
    lectura: false,
    descripcion: 'MODIFICA una publicación real: precio, stock y/o estado (active/paused). Para publicaciones con variaciones, indicá variacion_id para precio/stock. Requiere escritura habilitada y confirmar=true.',
    esquema: { ...cuentaParam, item_id: itemId, precio: z.number().positive().optional(), stock: z.number().int().min(0).optional(), estado: z.enum(['active', 'paused']).optional(), variacion_id: z.string().regex(/^\d{1,20}$/).optional(), confirmar },
    async run(args, ctx) {
      const f = faltaConfirmacion(args); if (f) return f;
      const c = await clientePara(ctx, args);
      const cambios = {};
      if (args.precio != null) cambios.price = args.precio;
      if (args.stock != null) cambios.available_quantity = args.stock;
      if (args.estado) cambios.status = args.estado;
      if (!Object.keys(cambios).length) return 'No indicaste ningún cambio (precio, stock o estado).';
      const antes = await c.get(ruta`/items/${args.item_id}`, { attributes: 'id,title,price,available_quantity,status,currency_id,variations' });
      let cuerpo = cambios;
      if (args.variacion_id) {
        const { status, ...deVariacion } = cambios;
        cuerpo = { ...(status ? { status } : {}), variations: [{ id: Number(args.variacion_id), ...deVariacion }] };
      } else if (antes.variations?.length && (cambios.price != null || cambios.available_quantity != null)) {
        return `La publicación tiene ${antes.variations.length} variaciones: indicá variacion_id para cambiar precio/stock (ver ml_publicacion).`;
      }
      let b;
      try { b = await c.put(ruta`/items/${args.item_id}`, cuerpo); } catch (e) {
        if (e instanceof MeliError && e.status === 400 && /automation|automatiz/i.test(e.message)) return `Mercado Libre rechazó el cambio de precio: la publicación tiene automatización de precios activa. Desactivala en el panel y reintentá. (${e.message})`;
        if (e instanceof MeliError && e.status === 409) return 'Mercado Libre informó un conflicto (409): otra modificación estaba en curso. Esperá unos segundos y reintentá.';
        throw e;
      }
      return `✅ **${args.item_id}** actualizado.\n- Antes: ${dinero(antes.price, antes.currency_id)} · stock ${numero(antes.available_quantity)} · ${antes.status}\n- Ahora: ${dinero(b.price, b.currency_id)} · stock ${numero(b.available_quantity)} · ${b.status}${b.warnings?.length ? '\n⚠️ Avisos: ' + b.warnings.map((w) => w.message).join('; ') : ''}`;
    },
  },
  {
    name: 'ml_crear_publicacion',
    titulo: 'Crear publicación (ESCRITURA)',
    lectura: false,
    descripcion: 'CREA una publicación real. Con `copiar_de` clona una publicación PROPIA (título, categoría, atributos, fotos, descripción, términos de venta) y permite pisar título/precio/stock — útil para duplicar entre tus cuentas. Nunca copies fotos/textos de terceros. Requiere escritura habilitada y confirmar=true.',
    esquema: { ...cuentaParam,
      copiar_de: itemId.optional().describe('item_id PROPIO a clonar'),
      titulo: z.string().min(3).max(60).optional(), precio: z.number().positive().optional(), stock: z.number().int().min(0).optional(),
      categoria: z.string().regex(/^[A-Z]{3}\d{1,12}$/).optional(), descripcion: z.string().max(50000).optional(),
      condicion: z.enum(['new', 'used', 'not_specified']).optional(), tipo: z.enum(['gold_special', 'gold_pro', 'free', 'bronze', 'silver', 'gold', 'gold_premium']).optional(),
      moneda: z.string().regex(/^[A-Z]{3}$/).optional(), imagenes: z.array(z.string().url().startsWith('https://')).max(12).optional().describe('URLs HTTPS de fotos propias'),
      atributos: z.array(z.object({ id: z.string().min(1).max(60), value_name: z.string().min(1).max(255) })).max(60).optional().describe('Atributos de ficha técnica, ej. [{id:"BRAND",value_name:"Acme"}]'),
      confirmar },
    async run(args, ctx) {
      const f = faltaConfirmacion(args); if (f) return f;
      const c = await clientePara(ctx, args);
      let base = {}, descOrigen = null;
      if (args.copiar_de) {
        const o = await c.get(ruta`/items/${args.copiar_de}`);
        try { descOrigen = (await c.get(ruta`/items/${args.copiar_de}/description`)).plain_text; } catch { /* sin descripción */ }
        base = {
          title: o.title, category_id: o.category_id, price: o.price, currency_id: o.currency_id,
          available_quantity: o.available_quantity, condition: o.condition, listing_type_id: o.listing_type_id,
          buying_mode: o.buying_mode, pictures: (o.pictures || []).map((p) => ({ source: p.secure_url || p.url })),
          attributes: (o.attributes || []).filter((a) => a.value_name != null).map((a) => ({ id: a.id, value_name: a.value_name })),
          ...(o.sale_terms?.length ? { sale_terms: o.sale_terms.map((t) => ({ id: t.id, value_name: t.value_name })) } : {}),
          ...(o.shipping ? { shipping: { mode: o.shipping.mode, local_pick_up: o.shipping.local_pick_up, free_shipping: o.shipping.free_shipping } } : {}),
          ...(o.channels?.length ? { channels: o.channels } : {}),
        };
      }
      const cuerpo = {
        ...base,
        ...(args.titulo ? { title: args.titulo } : {}), ...(args.precio != null ? { price: args.precio } : {}),
        ...(args.stock != null ? { available_quantity: args.stock } : {}), ...(args.categoria ? { category_id: args.categoria } : {}),
        ...(args.condicion ? { condition: args.condicion } : {}), ...(args.tipo ? { listing_type_id: args.tipo } : {}),
        ...(args.moneda ? { currency_id: args.moneda } : {}), ...(args.imagenes?.length ? { pictures: args.imagenes.map((u) => ({ source: u })) } : {}),
        ...(args.atributos?.length ? { attributes: args.atributos } : {}),
      };
      if (!cuerpo.title || !cuerpo.category_id) return 'Falta título o categoría: pasá titulo y categoria (ml_categorias ayuda a elegirla), o usá copiar_de con una publicación propia.';
      if (!cuerpo.currency_id) {
        const me = await c.me();
        try { cuerpo.currency_id = (await c.get(ruta`/sites/${me.site_id}`)).default_currency_id; } catch { /* la API lo pedirá */ }
      }
      cuerpo.condition ??= 'new';
      cuerpo.listing_type_id ??= 'gold_special';
      cuerpo.available_quantity ??= 1;
      cuerpo.buying_mode ??= 'buy_it_now';
      if (!cuerpo.price) return 'Falta el precio.';
      const nuevo = await c.post('/items', cuerpo);
      let notaDesc = '';
      const texto = args.descripcion ?? descOrigen;
      if (texto) {
        try { await c.post(ruta`/items/${nuevo.id}/description`, { plain_text: texto }); notaDesc = ' Descripción cargada.'; }
        catch (e) { notaDesc = ` ⚠️ La descripción no se pudo cargar (${e.message}).`; }
      }
      return `✅ Publicación creada: **${nuevo.id}** — ${nuevo.title ?? cuerpo.title} a ${dinero(nuevo.price ?? cuerpo.price, cuerpo.currency_id)}\n${nuevo.permalink ?? ''}\nEstado: ${nuevo.status ?? 'active'}.${notaDesc}${nuevo.warnings?.length ? '\n⚠️ Avisos: ' + nuevo.warnings.map((w) => w.message).join('; ') : ''} Revisala en tu panel de Mercado Libre.`;
    },
  },
  {
    name: 'ml_responder_pregunta',
    titulo: 'Responder pregunta (ESCRITURA)',
    lectura: false,
    descripcion: 'PUBLICA una respuesta real y visible a una pregunta de comprador (irreversible). Sin datos de contacto (Mercado Libre lo penaliza). Requiere escritura habilitada y confirmar=true con el texto exacto aprobado.',
    esquema: { ...cuentaParam, pregunta_id: z.string().regex(/^\d{1,20}$/), texto: z.string().min(1).max(2000).describe('Respuesta a publicar (máx. 2000 caracteres)'), confirmar },
    async run(args, ctx) {
      const f = faltaConfirmacion(args); if (f) return f;
      if (/(\+?\d[\d\s().-]{7,}\d)|@|wa\.me|whatsapp|instagram|facebook|https?:\/\//i.test(args.texto)) {
        return '⛔ No se publicó: la respuesta parece contener datos de contacto o enlaces (teléfono, email, redes, URL). Mercado Libre lo penaliza. Reformulala sin esos datos.';
      }
      const c = await clientePara(ctx, args);
      await c.post('/answers', { question_id: Number(args.pregunta_id), text: args.texto });
      return `✅ Respuesta publicada a la pregunta ${args.pregunta_id}.`;
    },
  },
  {
    name: 'ml_aceptar_promocion',
    titulo: 'Aceptar promoción (ESCRITURA)',
    lectura: false,
    descripcion: 'ACTIVA una publicación dentro de una promoción de Mercado Libre, al precio indicado (visible para compradores). Requiere escritura habilitada y confirmar=true por ítem.',
    esquema: { ...cuentaParam, item_id: itemId, promocion_id: z.string().min(1).max(80), tipo: z.string().regex(/^[A-Z_]{2,40}$/).describe('Tipo de la promoción (DEAL, DOD, MARKETPLACE_CAMPAIGN…)'), precio_final: z.number().positive().optional().describe('deal_price; si falta, Mercado Libre usa el sugerido'), confirmar },
    async run(args, ctx) {
      const f = faltaConfirmacion(args); if (f) return f;
      const c = await clientePara(ctx, args);
      const cuerpo = { promotion_id: args.promocion_id, promotion_type: args.tipo };
      if (args.precio_final != null) cuerpo.deal_price = args.precio_final;
      const r = await c.post(ruta`/seller-promotions/items/${args.item_id}`, cuerpo, { app_version: 'v2' });
      return `✅ ${args.item_id} aceptado en la promoción ${args.promocion_id}${args.precio_final != null ? ` a ${dinero(args.precio_final)}` : ''}.${r?.status ? ` Estado: ${r.status}.` : ''}`;
    },
  },
  {
    name: 'ml_subir_clip',
    titulo: 'Subir un clip (ESCRITURA)',
    lectura: false,
    descripcion: 'Sube un Clip (video vertical corto) a una publicación. Requisitos de Mercado Libre: MP4/MOV, vertical, 10-61 s, mínimo 360x640, máximo 280 MB, publicación activa; moderación 24-48 h. Por seguridad el archivo debe estar dentro de la carpeta de clips (ML_DIRECTORIO_CLIPS). Requiere escritura habilitada y confirmar=true.',
    esquema: { ...cuentaParam, item_id: itemId, archivo: z.string().min(1).max(260).describe('Nombre del archivo dentro de la carpeta de clips (ej. MLA123-clip.mp4)'), confirmar },
    async run(args, ctx) {
      const f = faltaConfirmacion(args); if (f) return f;
      const dir = path.resolve(ctx.config.dirClips);
      const nombre = args.archivo;
      const completo = path.resolve(dir, nombre);
      if (/[\\/]/.test(nombre) || nombre.includes('..') || nombre.startsWith('.') || !completo.startsWith(dir + path.sep)) return `Por seguridad solo se leen videos dentro de ${dir}. Copiá el archivo ahí y pasá solo su nombre (sin rutas).`;
      if (!fs.existsSync(completo)) return `No encuentro "${nombre}" en ${dir}. Copiá el video a esa carpeta y reintentá.`;
      const ext = nombre.toLowerCase().split('.').pop();
      const mime = { mp4: 'video/mp4', mov: 'video/quicktime', mpeg: 'video/mpeg', avi: 'video/x-msvideo' }[ext];
      if (!mime) return `Mercado Libre solo acepta MP4, MOV, MPEG o AVI (recibí .${ext}).`;
      const st = fs.statSync(completo);
      if (st.size > 280 * 1024 * 1024) return `El archivo pesa ${(st.size / 1048576).toFixed(0)} MB y el máximo es 280 MB.`;
      const c = await clientePara(ctx, args);
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(completo)], { type: mime }), nombre);
      let r, ultimo;
      for (const rt of [ruta`/marketplace/items/${args.item_id}/clips/upload`, ruta`/items/${args.item_id}/clips/upload`]) {
        try { r = await c.multipart(rt, form); break; } catch (e) { ultimo = e; if (!(e instanceof MeliError) || ![400, 403, 404].includes(e.status)) throw e; }
      }
      if (!r) {
        const m = String(ultimo?.message || '');
        if (/shorter/i.test(m)) return '❌ Rechazado: el video dura menos de 10 segundos.';
        if (/longer|61/i.test(m)) return '❌ Rechazado: el video supera los 61 segundos.';
        if (/resolution|360x640/i.test(m)) return '❌ Rechazado: resolución menor a 360x640 (ideal 1080x1920 vertical).';
        return `❌ No se pudo subir: ${m || 'la API de Clips puede no estar habilitada para tu cuenta; subilo desde el panel del vendedor'}.`;
      }
      return `✅ Clip subido a **${args.item_id}** (id ${r.clip_uuid ?? r.id ?? 's/d'}). Entra a moderación (24-48 h): verificalo después con ml_clips.`;
    },
  },
  {
    name: 'ml_borrar_clip',
    titulo: 'Borrar un clip (ESCRITURA)',
    lectura: false,
    descripcion: 'Borra un clip de una publicación (por ejemplo uno rechazado, para subir la versión corregida). Requiere escritura habilitada y confirmar=true.',
    esquema: { ...cuentaParam, item_id: itemId, clip_uuid: z.string().regex(/^[A-Za-z0-9-]{8,64}$/).describe('ID del clip (sale de ml_clips)'), confirmar },
    async run(args, ctx) {
      const f = faltaConfirmacion(args); if (f) return f;
      const c = await clientePara(ctx, args);
      let r, ultimo;
      for (const rt of [ruta`/marketplace/items/${args.item_id}/clips/${args.clip_uuid}`, ruta`/items/${args.item_id}/clips/${args.clip_uuid}`]) {
        try { r = await c.del(rt); break; } catch (e) { ultimo = e; if (!(e instanceof MeliError) || ![400, 403, 404].includes(e.status)) throw e; }
      }
      if (!r) return `❌ No se pudo borrar: ${ultimo?.message || 'clip o publicación no encontrados'}.`;
      const filas = (Array.isArray(r) ? r : [r]).map((x) => `- ${x.site_id || args.item_id}: ${x.status === 'DELETED' ? '✅ borrado' : x.status ?? 'ok'}`);
      return `# Clip ${String(args.clip_uuid).slice(0, 8)}… borrado\n` + filas.join('\n');
    },
  },
];
