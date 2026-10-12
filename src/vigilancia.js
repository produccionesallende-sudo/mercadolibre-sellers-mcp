// Vigilancia de competencia: lista de objetivos, snapshots e historial,
// 100 % local (<dirConfig>/vigilancia.json). Solo datos públicos de ML.
import fs from 'node:fs';
import path from 'node:path';
import { ruta } from './meli/transporte.js';
import { dinero, numero } from './formato.js';

export const TIPOS = ['vendedor', 'publicacion', 'busqueda', 'tendencias'];
const MAX_PUNTOS = 60;

export class Vigilancia {
  constructor(dirConfig) {
    this.archivo = path.join(dirConfig, 'vigilancia.json');
    this.dir = dirConfig;
  }

  leer() {
    try {
      const d = JSON.parse(fs.readFileSync(this.archivo, 'utf8'));
      return { objetivos: d.objetivos || [], snapshots: d.snapshots || {}, historial: d.historial || {} };
    } catch { return { objetivos: [], snapshots: {}, historial: {} }; }
  }

  guardar(d) {
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const tmp = `${this.archivo}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(d, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.archivo);
  }

  static clave(o) { return `${o.tipo}:${o.ref}:${o.sitio || ''}`; }

  agregar({ tipo, ref, nota, sitio }) {
    const d = this.leer();
    const o = { tipo, ref: String(ref).trim(), nota: nota ? String(nota).slice(0, 200) : undefined, sitio, agregado: new Date().toISOString().slice(0, 10) };
    if (d.objetivos.some((x) => Vigilancia.clave(x) === Vigilancia.clave(o))) return { ya: true, objetivo: o };
    d.objetivos.push(o);
    this.guardar(d);
    return { ya: false, objetivo: o };
  }

  quitar(ref) {
    const d = this.leer();
    const r = String(ref).trim();
    const antes = d.objetivos.length;
    const quitados = d.objetivos.filter((o) => o.ref === r || Vigilancia.clave(o) === r);
    d.objetivos = d.objetivos.filter((o) => !quitados.includes(o));
    for (const o of quitados) { delete d.snapshots[Vigilancia.clave(o)]; delete d.historial[Vigilancia.clave(o)]; }
    this.guardar(d);
    return antes - d.objetivos.length;
  }

  buscar(ref) {
    const r = String(ref).trim();
    const d = this.leer();
    const o = d.objetivos.find((x) => x.ref === r || Vigilancia.clave(x) === r);
    return o ? { objetivo: o, puntos: d.historial[Vigilancia.clave(o)] || [], snapshot: d.snapshots[Vigilancia.clave(o)] } : null;
  }
}

// ───────────── snapshots por tipo (reciben el cliente autenticado) ─────────────
export async function tomarSnapshot(c, o, sitio) {
  const s = o.sitio || sitio;
  if (o.tipo === 'vendedor') {
    const q = /^\d+$/.test(o.ref) ? { seller_id: o.ref } : { nickname: o.ref };
    const r = await c.get(ruta`/sites/${s}/search`, { ...q, limit: 50, sort: 'relevance' });
    const items = {};
    for (const x of r.results || []) items[x.id] = { precio: x.price, titulo: x.title };
    return { total: r.paging?.total ?? Object.keys(items).length, items };
  }
  if (o.tipo === 'publicacion') {
    const b = await c.get(ruta`/items/${o.ref}`, { attributes: 'id,title,price,sold_quantity,status,available_quantity' });
    return { precio: b.price, vendidos: b.sold_quantity ?? null, estado: b.status, stock: b.available_quantity, titulo: b.title };
  }
  if (o.tipo === 'busqueda') {
    const r = await c.get(ruta`/sites/${s}/search`, { q: o.ref, limit: 10 });
    return { top: (r.results || []).map((x) => ({ id: x.id, precio: x.price, vendedor: x.seller?.nickname ?? String(x.seller?.id ?? '') })) };
  }
  if (o.tipo === 'tendencias') {
    const r = await c.get(o.ref && o.ref !== s ? ruta`/trends/${s}/${o.ref}` : ruta`/trends/${s}`);
    return { keywords: (Array.isArray(r) ? r : []).slice(0, 20).map((t) => t.keyword) };
  }
  throw new Error(`Tipo de objetivo desconocido: ${o.tipo}`);
}

const cambioPct = (n, v) => (v ? `${n > v ? '↑' : '↓'} ${numero(Math.abs(((n - v) / v) * 100), 1)}%` : '');

export function compararSnapshots(o, viejo, nuevo) {
  const cambios = [];
  if (o.tipo === 'vendedor') {
    const nuevos = Object.keys(nuevo.items).filter((id) => !viejo.items[id]);
    const bajas = Object.keys(viejo.items).filter((id) => !nuevo.items[id]);
    if (nuevos.length) cambios.push(`publicó ${nuevos.length} nueva(s): ` + nuevos.slice(0, 3).map((id) => `${nuevo.items[id].titulo} (${dinero(nuevo.items[id].precio)})`).join(' · '));
    if (bajas.length) cambios.push(`dio de baja/pausó ${bajas.length} publicación(es)`);
    for (const id of Object.keys(nuevo.items)) {
      const v = viejo.items[id], n = nuevo.items[id];
      if (v && v.precio !== n.precio) cambios.push(`${n.titulo}: ${dinero(v.precio)} → ${dinero(n.precio)} (${cambioPct(n.precio, v.precio)})`);
    }
  } else if (o.tipo === 'publicacion') {
    if (viejo.precio !== nuevo.precio) cambios.push(`precio: ${dinero(viejo.precio)} → ${dinero(nuevo.precio)} (${cambioPct(nuevo.precio, viejo.precio)})`);
    const delta = (nuevo.vendidos ?? 0) - (viejo.vendidos ?? 0);
    if (delta > 0) cambios.push(`vendió ~${delta} unidad(es) desde el último control (estimado por sold_quantity)`);
    if (viejo.estado !== nuevo.estado) cambios.push(`estado: ${viejo.estado} → ${nuevo.estado}`);
  } else if (o.tipo === 'busqueda') {
    const lv = viejo.top?.[0], ln = nuevo.top?.[0];
    if (lv && ln && (lv.id !== ln.id || lv.vendedor !== ln.vendedor)) cambios.push(`nuevo líder de la búsqueda: ${ln.vendedor} a ${dinero(ln.precio)} (antes ${lv.vendedor})`);
    else if (lv && ln && lv.precio !== ln.precio) cambios.push(`el líder (${ln.vendedor}) movió el precio: ${dinero(lv.precio)} → ${dinero(ln.precio)}`);
    const viejos = new Set((viejo.top || []).map((x) => x.id));
    const entrantes = (nuevo.top || []).filter((x) => !viejos.has(x.id));
    if (entrantes.length) cambios.push(`entraron ${entrantes.length} publicación(es) nueva(s) al top 10`);
  } else if (o.tipo === 'tendencias') {
    const kv = viejo.keywords || [], kn = nuevo.keywords || [];
    const entraron = kn.filter((k) => !kv.includes(k)), salieron = kv.filter((k) => !kn.includes(k));
    if (entraron.length) cambios.push(`entraron al top: ${entraron.slice(0, 5).map((k) => `"${k}"`).join(', ')}`);
    if (salieron.length) cambios.push(`salieron del top: ${salieron.slice(0, 5).map((k) => `"${k}"`).join(', ')}`);
    for (const k of kn.slice(0, 10)) {
      const pv = kv.indexOf(k), pn = kn.indexOf(k);
      if (pv > -1 && pv - pn >= 5) cambios.push(`"${k}" subió del puesto ${pv + 1} al ${pn + 1}`);
    }
  }
  return cambios;
}

export function puntoHistorial(o, datos) {
  if (o.tipo === 'publicacion') return { precio: datos.precio, vendidos: datos.vendidos };
  if (o.tipo === 'busqueda') return datos.top?.[0] ? { lider: datos.top[0].vendedor, precioLider: datos.top[0].precio } : null;
  if (o.tipo === 'vendedor') {
    const precios = Object.values(datos.items || {}).map((x) => x.precio).filter((n) => n > 0).sort((a, b) => a - b);
    return { publicaciones: datos.total, precioMediana: precios.length ? precios[Math.floor(precios.length / 2)] : null };
  }
  return null;
}

export function registrarHistorial(d, clave, o, datos, ahora = Date.now()) {
  const p = puntoHistorial(o, datos);
  if (!p) return;
  const arr = (d.historial[clave] ||= []);
  const ultimo = arr[arr.length - 1];
  if (ultimo && JSON.stringify({ ...ultimo, t: 0 }) === JSON.stringify({ ...p, t: 0 }) && ahora - ultimo.t < 20 * 3600000) return;
  arr.push({ t: ahora, ...p });
  if (arr.length > MAX_PUNTOS) arr.splice(0, arr.length - MAX_PUNTOS);
}
