// Clips (videos cortos) — consulta. La API de Clips no está documentada
// públicamente para todos los países; se intentan las rutas conocidas y se
// informa con claridad cuando la cuenta no la tiene habilitada.
import { cuentaParam, itemId, limiteParam, clientePara } from '../comunes.js';
import { obtenerItems, idsPublicaciones } from '../../meli/recursos.js';
import { ruta } from '../../meli/transporte.js';
import { limitarTexto, tabla } from '../../formato.js';
import { MeliError } from '../../errores.js';

export const ESTADO_CLIP = {
  PUBLISHED: '✅ publicado',
  UNDER_REVIEW: '⏳ en revisión (24-48 h)',
  REJECTED: '❌ rechazado',
  TRANSCODING_REJECTED: '⚠️ rechazo técnico al procesar el video',
  PAUSED: '⏸️ pausado',
};
const RAZON = {
  DUPLICATED_VIDEO: 'video duplicado: exportá una versión distinta, no resubas el mismo archivo',
  VIDEO_PROCESSING_ERROR: 'no se pudo procesar: reexportá como MP4 (H.264 + AAC) y volvé a subir',
};

/** Devuelve {clips:[...]} , {clips:[]} si no tiene, o null si la API no está disponible. */
export async function traerClips(c, id) {
  for (const r of [ruta`/marketplace/items/${id}/clips`, ruta`/items/${id}/clips`]) {
    try { return await c.get(r); } catch (e) {
      if (!(e instanceof MeliError)) throw e;
      if (e.status === 404 && /no clips|not found clips/i.test(e.message)) return { clips: [] };
      if (![400, 403, 404].includes(e.status)) throw e;
    }
  }
  return null;
}

const estadosDe = (r) => r?.clips?.flatMap((cl) => (cl.metadata || []).map((md) => md.moderation_status)) || [];

export const herramientas = [
  {
    name: 'ml_clips',
    titulo: 'Clips de las publicaciones',
    lectura: true,
    descripcion: 'Consulta los Clips (videos verticales cortos) de tus publicaciones: con item_id, cada clip y su estado de moderación (publicado, en revisión, rechazado con motivo); sin item_id, el mapa de video de las publicaciones activas (video clásico + clips) para priorizar. Si la cuenta no tiene la API de Clips habilitada, lo informa.',
    esquema: { ...cuentaParam, item_id: itemId.optional(), limite: limiteParam(10, 30) },
    async run(args, ctx) {
      const c = await clientePara(ctx, args);
      if (args.item_id) {
        const r = await traerClips(c, args.item_id);
        if (r === null) return `La API de Clips no respondió para **${args.item_id}**: tu cuenta/país puede no tenerla habilitada todavía (se gestionan desde el panel del vendedor).`;
        if (!r.clips?.length) return `**${args.item_id}** no tiene clips cargados.`;
        const filas = r.clips.map((cl) => `- clip \`${String(cl.clip_uuid ?? cl.id).slice(0, 8)}…\`\n` + (cl.metadata || []).map((md) => {
          let l = `  - ${md.site_id}: ${ESTADO_CLIP[md.moderation_status] || md.moderation_status}`;
          for (const [cod, txt] of Object.entries(md.moderation_reasons || {})) l += `\n    · motivo: ${RAZON[cod] || txt}`;
          return l;
        }).join('\n'));
        const es = estadosDe(r);
        return `# Clips de ${args.item_id} (${r.clips.length})\n\n` + filas.join('\n') +
          `\n\n**Resumen:** ${es.filter((s) => s === 'PUBLISHED').length} publicados · ${es.filter((s) => s === 'UNDER_REVIEW').length} en revisión · ${es.filter((s) => /REJECTED/.test(s)).length} para corregir.`;
      }
      const { ids } = await idsPublicaciones(c, { status: 'active', limite: args.limite ?? 10 });
      if (!ids.length) return 'No hay publicaciones activas para revisar.';
      const det = await obtenerItems(c, ids, 'id,title,video_id');
      const filas = [], sinNada = [];
      let apiDisponible = true;
      for (const id of ids) {
        const b = det[id]; if (!b) continue;
        const r = await traerClips(c, id);
        if (r === null) apiDisponible = false;
        const es = estadosDe(r);
        const txt = r === null ? '—' : es.length ? [es.filter((s) => s === 'PUBLISHED').length ? `✅ ${es.filter((s) => s === 'PUBLISHED').length}` : '', es.filter((s) => s === 'UNDER_REVIEW').length ? `⏳ ${es.filter((s) => s === 'UNDER_REVIEW').length}` : '', es.filter((s) => /REJECTED/.test(s)).length ? `❌ ${es.filter((s) => /REJECTED/.test(s)).length}` : ''].filter(Boolean).join(' ') : 'sin clips';
        if (!es.includes('PUBLISHED') && !b.video_id) sinNada.push(id);
        filas.push([id, limitarTexto(b.title, 40), b.video_id ? '✅' : '❌', txt]);
      }
      return `# Mapa de video de la tienda (${filas.length} publicaciones activas)\n\n` + tabla(['Publicación', 'Título', 'Video clásico', 'Clips'], filas) +
        (apiDisponible ? '' : '\n\nℹ️ La API de Clips no respondió para esta cuenta: la columna Clips puede no reflejar la realidad.') +
        (sinNada.length ? `\n\n**Prioridad:** ${sinNada.join(', ')} no tienen ningún video.` : '\n\n✅ Todas tienen al menos un video.');
    },
  },
];
