// Vigilancia de competencia y tendencias (datos públicos, almacenamiento local).
import { z } from 'zod';
import { cuentaParam, clientePara } from '../comunes.js';
import { Vigilancia, TIPOS, tomarSnapshot, compararSnapshots, registrarHistorial } from '../../vigilancia.js';
import { dinero, fecha, numero, pct, tabla } from '../../formato.js';

export const herramientas = [
  {
    name: 'ml_vigilar',
    titulo: 'Lista de seguimiento',
    lectura: true,
    descripcion: 'Administra la lista de seguimiento de competencia y tendencias (se guarda solo en esta computadora). Tipos: vendedor (nickname o id), publicacion (item_id), busqueda (keyword) y tendencias (categoría o sitio). Acciones: listar, agregar, quitar.',
    esquema: { ...cuentaParam, accion: z.enum(['listar', 'agregar', 'quitar']), tipo: z.enum(TIPOS).optional(), ref: z.string().min(1).max(120).optional().describe('Nickname/id del vendedor, item_id, keyword, o categoría para tendencias'), nota: z.string().max(200).optional() },
    async run(args, ctx) {
      const v = new Vigilancia(ctx.config.dirConfig);
      if (args.accion === 'listar') {
        const d = v.leer();
        if (!d.objetivos.length) return 'La lista de seguimiento está vacía. Agregá con ml_vigilar accion=agregar tipo=vendedor ref=NICK_RIVAL.';
        const titulos = { vendedor: '🥊 Rivales', publicacion: '📦 Publicaciones seguidas', busqueda: '🔍 Búsquedas vigiladas', tendencias: '📈 Tendencias' };
        const resumen = (o) => {
          const s = d.snapshots[Vigilancia.clave(o)];
          if (!s) return '';
          const f = fecha(new Date(s.t).toISOString());
          if (o.tipo === 'vendedor') return ` · ${Object.keys(s.datos.items || {}).length} publicaciones registradas (${f})`;
          if (o.tipo === 'publicacion') return ` · último control: ${dinero(s.datos.precio)} · ${s.datos.vendidos ?? '—'} vendidos (${f})`;
          if (o.tipo === 'busqueda') return s.datos.top?.[0] ? ` · líder: ${s.datos.top[0].vendedor} a ${dinero(s.datos.top[0].precio)} (${f})` : '';
          return ` · top registrado (${f})`;
        };
        const grupos = TIPOS.map((t) => { const del = d.objetivos.filter((o) => o.tipo === t); return del.length ? `### ${titulos[t]} (${del.length})\n` + del.map((o) => `- **${o.ref}**${o.nota ? ' — ' + o.nota : ''}${resumen(o)}`).join('\n') : null; }).filter(Boolean);
        return '# Lista de seguimiento\n\n' + grupos.join('\n\n') + '\n\nCorré ml_novedades_competencia para ver qué cambió.';
      }
      if (args.accion === 'quitar') {
        if (!args.ref) return 'Indicá ref (lo que aparece en la lista) para quitar.';
        const n = v.quitar(args.ref);
        return n ? `Quitado del seguimiento (${n}).` : `No encontré "${args.ref}" en la lista.`;
      }
      if (!args.tipo || (!args.ref && args.tipo !== 'tendencias')) return 'Para agregar indicá tipo y ref (en tendencias, ref puede ser una categoría o quedar vacío para el sitio entero).';
      const c = await clientePara(ctx, args);
      const sitio = await c.sitio();
      const r = v.agregar({ tipo: args.tipo, ref: args.ref || sitio, nota: args.nota, sitio });
      if (r.ya) return 'Ya estaba en la lista de seguimiento.';
      let nota = '';
      try {
        const d = v.leer();
        const datos0 = await tomarSnapshot(c, r.objetivo, sitio);
        d.snapshots[Vigilancia.clave(r.objetivo)] = { t: Date.now(), datos: datos0 };
        registrarHistorial(d, Vigilancia.clave(r.objetivo), r.objetivo, datos0);
        v.guardar(d);
      } catch (e) { nota = ` (no pude tomar el primer registro: ${e.message})`; }
      return `✅ Agregado al seguimiento: ${r.objetivo.tipo} **${r.objetivo.ref}**${nota}. Corré ml_novedades_competencia en unos días y te digo qué cambió.`;
    },
  },
  {
    name: 'ml_novedades_competencia',
    titulo: 'Novedades de competencia y tendencias',
    lectura: true,
    descripcion: 'Recorre la lista de seguimiento y reporta SOLO lo que cambió desde la última corrida: precios, publicaciones nuevas o dadas de baja, ventas estimadas de rivales, cambios de líder en búsquedas y keywords que entraron/salieron de tendencias.',
    esquema: { ...cuentaParam },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      const sitio = await c.sitio();
      const v = new Vigilancia(ctx.config.dirConfig);
      const d = v.leer();
      if (!d.objetivos.length) return 'La lista de seguimiento está vacía: agregá objetivos con ml_vigilar.';
      const secciones = []; let sinCambios = 0, primeros = 0;
      for (const o of d.objetivos) {
        const clave = Vigilancia.clave(o);
        let nuevo;
        try { nuevo = { t: Date.now(), datos: await tomarSnapshot(c, o, sitio) }; }
        catch (e) { secciones.push(`### ${o.tipo}: ${o.ref}\n- ⚠️ no se pudo consultar (${e.message})`); continue; }
        const viejo = d.snapshots[clave];
        if (!viejo) { primeros++; d.snapshots[clave] = nuevo; registrarHistorial(d, clave, o, nuevo.datos); continue; }
        const cambios = compararSnapshots(o, viejo.datos, nuevo.datos);
        const dias = Math.max(1, Math.round((nuevo.t - viejo.t) / 86400000));
        if (cambios.length) secciones.push(`### ${o.tipo}: ${o.ref}${o.nota ? ' (' + o.nota + ')' : ''} — últimos ${dias} día(s)\n` + cambios.map((x) => '- ' + x).join('\n'));
        else sinCambios++;
        d.snapshots[clave] = nuevo;
        registrarHistorial(d, clave, o, nuevo.datos);
      }
      v.guardar(d);
      const pie = [];
      if (sinCambios) pie.push(`${sinCambios} objetivo(s) sin cambios`);
      if (primeros) pie.push(`${primeros} con primer registro recién guardado`);
      if (!secciones.length) return `Sin novedades en la competencia. ${pie.join(' · ')}.`;
      return '# Novedades de competencia y tendencias\n\n' + secciones.join('\n\n') + (pie.length ? `\n\n_${pie.join(' · ')}._` : '');
    },
  },
  {
    name: 'ml_historial_competencia',
    titulo: 'Historial de competencia',
    lectura: true,
    descripcion: 'Evolución en el tiempo de un objetivo vigilado: precio y ventas de una publicación rival, líder y precio líder de una búsqueda, o cantidad de publicaciones y precio mediana de un vendedor. Se alimenta con cada corrida de ml_novedades_competencia.',
    esquema: { ref: z.string().min(1).max(120).describe('El objetivo tal como figura en la lista (item_id, nickname o keyword)') },
    async run(args, ctx) {
      const r = new Vigilancia(ctx.config.dirConfig).buscar(args.ref);
      if (!r) return `"${args.ref}" no está en la lista de seguimiento. Agregalo con ml_vigilar.`;
      if (!r.puntos.length) return `**${r.objetivo.ref}** está vigilado pero sin historial todavía: corré ml_novedades_competencia.`;
      const f = (t) => fecha(new Date(t).toISOString());
      let cuerpo, resumen = '';
      if (r.objetivo.tipo === 'publicacion') {
        cuerpo = tabla(['Fecha', 'Precio', 'Vendidos'], r.puntos.map((p, i) => { const a = r.puntos[i - 1]; const delta = a?.precio ? ` (${p.precio >= a.precio ? '+' : '−'}${pct(Math.abs(((p.precio - a.precio) / a.precio) * 100))})` : ''; return [f(p.t), dinero(p.precio) + delta, p.vendidos ?? '—']; }));
        const precios = r.puntos.map((p) => p.precio), pr = r.puntos[0], ul = r.puntos[r.puntos.length - 1];
        resumen = `\n\n**Resumen:** mín ${dinero(Math.min(...precios))} · máx ${dinero(Math.max(...precios))} · ${pr.precio ? pct(((ul.precio - pr.precio) / pr.precio) * 100) : '0%'} desde el primer registro` + (ul.vendidos != null && pr.vendidos != null ? ` · ~${numero(Math.max(0, ul.vendidos - pr.vendidos))} ventas estimadas en el período` : '');
      } else if (r.objetivo.tipo === 'busqueda') {
        cuerpo = tabla(['Fecha', 'Líder', 'Precio líder'], r.puntos.map((p) => [f(p.t), p.lider, dinero(p.precioLider)]));
      } else {
        cuerpo = tabla(['Fecha', 'Publicaciones', 'Precio mediana'], r.puntos.map((p) => [f(p.t), p.publicaciones, p.precioMediana ? dinero(p.precioMediana) : '—']));
      }
      return `# Historial: ${r.objetivo.tipo} ${r.objetivo.ref}\n(${r.puntos.length} registro(s))\n\n` + cuerpo + resumen;
    },
  },
];
