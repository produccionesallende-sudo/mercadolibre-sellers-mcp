// Conexión de cuentas, estado del MCP y desconexión. Todo local salvo el
// canje OAuth y la revocación opcional, que van directo a Mercado Libre.
import { z } from 'zod';
import { SITIOS } from '../../meli/oauth.js';
import { esperarCallback } from '../../meli/callback-local.js';
import { ruta } from '../../meli/transporte.js';
import { VERSION } from '../../version.js';
import { MeliError } from '../../errores.js';
import { log } from '../../log.js';

export const herramientas = [
  {
    name: 'ml_conectar',
    titulo: 'Conectar cuenta de Mercado Libre',
    lectura: true,
    descripcion: 'Vincula una cuenta de vendedor de Mercado Libre con este MCP. Sin argumentos devuelve el enlace para autorizar en el navegador (OAuth oficial con PKCE). Con `codigo` (el código "TG-..." o la URL completa de la barra del navegador después de autorizar) completa la conexión. Los tokens quedan cifrados solo en esta computadora.',
    esquema: {
      codigo: z.string().min(10).max(2048).optional().describe('Código de autorización (TG-...) o la URL completa a la que redirigió Mercado Libre'),
      sitio: z.enum(SITIOS).optional().describe('País de la cuenta: MLA (Argentina), MLM (México), MLB (Brasil), MLC, MCO, MLU, MPE…'),
      esperar_callback_local: z.boolean().optional().describe('Si la redirect URI es http://127.0.0.1:PUERTO/..., levanta un receptor local y espera la autorización automáticamente'),
    },
    async run(args, ctx) {
      if (args.codigo) {
        const r = await ctx.sesiones.completarConexion({ entrada: args.codigo });
        return `✅ Cuenta conectada: **${r.nickname}** (${r.sitio}, user_id ${r.user_id}).` +
          (r.offline ? '' : '\n\n⚠️ Mercado Libre no devolvió refresh token: la sesión vencerá en unas horas. Activá el permiso `offline_access` en tu aplicación y volvé a conectar.') +
          `\n\nModo actual: ${ctx.config.soloLectura ? '🔒 SOLO LECTURA (ninguna herramienta puede modificar la cuenta)' : '✏️ escritura habilitada para: ' + ctx.config.escriturasPermitidas.join(', ')}.`;
      }
      const inicio = await ctx.sesiones.iniciarConexion({ sitio: args.sitio });
      if (inicio.loopback && args.esperar_callback_local) {
        const texto = `Abrí este enlace en tu navegador, iniciá sesión con TU cuenta de vendedor y tocá "Autorizar":\n\n${inicio.url}\n\nEstoy esperando la respuesta en ${inicio.redirectUri} (máximo 10 minutos)…`;
        log.info(texto);
        const { code, state } = await esperarCallback(inicio.redirectUri, { stateEsperado: inicio.state });
        const r = await ctx.sesiones.completarConexion({ entrada: code, state });
        return `✅ Cuenta conectada automáticamente: **${r.nickname}** (${r.sitio}, user_id ${r.user_id}).`;
      }
      return [
        'Abrí este enlace en tu navegador, iniciá sesión con **tu cuenta de vendedor** de Mercado Libre y tocá **Autorizar**:',
        '',
        inicio.url,
        '',
        `Al terminar, el navegador te lleva a: ${inicio.redirectUri}`,
        'Copiá la **URL completa** de la barra de direcciones (contiene `code=TG-...`) y pasámela con `ml_conectar codigo="<esa URL>"`. También sirve pegar solo el código.',
        '',
        `⏱️ El enlace vence en ${inicio.venceEnMin} minutos y es de un solo uso. La redirect URI configurada en tu aplicación del DevCenter tiene que ser EXACTAMENTE: ${inicio.redirectUri}`,
      ].join('\n');
    },
  },
  {
    name: 'ml_cuentas',
    titulo: 'Cuentas conectadas',
    lectura: true,
    descripcion: 'Lista las cuentas de Mercado Libre conectadas en esta computadora (soporta varias tiendas). Con `predeterminada` fija cuál usar cuando no se indica cuenta.',
    esquema: { predeterminada: z.string().regex(/^\d{1,20}$/).optional().describe('user_id de la cuenta a fijar como predeterminada') },
    async run(args, ctx) {
      let aviso = '';
      if (args.predeterminada) aviso = `✅ **${await ctx.sesiones.fijarPredeterminada(args.predeterminada)}** quedó como cuenta predeterminada.\n\n`;
      const cs = ctx.sesiones.listar();
      if (!cs.length) return aviso + 'No hay cuentas conectadas todavía. Usá ml_conectar para vincular la primera.';
      return aviso + '## Cuentas conectadas\n' + cs.map((c) =>
        `- **${c.nickname}** (${c.sitio}) — user_id ${c.user_id}${c.predeterminada ? ' · ⭐ predeterminada' : ''}${c.requiere_reconexion ? ' · ⚠️ requiere reconexión (ml_conectar)' : ''} · conectada el ${c.conectada_el?.slice(0, 10) ?? '—'}`,
      ).join('\n') + '\n\nPara conectar otra tienda: ml_conectar de nuevo. Para quitar una: ml_desconectar.';
    },
  },
  {
    name: 'ml_desconectar',
    titulo: 'Desconectar cuenta',
    lectura: true, // Reduce acceso; permitida incluso en modo solo lectura.
    descripcion: 'Borra los tokens guardados de una cuenta en esta computadora (deja de estar conectada). Con `revocar_en_mercadolibre=true` además revoca la autorización de la aplicación en Mercado Libre (DELETE /users/{id}/applications/{app_id}), lo que invalida cualquier token emitido. Con cuenta="todas" borra el almacén completo.',
    esquema: {
      cuenta: z.union([z.literal('todas'), z.string().regex(/^\d{1,20}$/)]).describe('user_id de la cuenta a desconectar, o "todas"'),
      revocar_en_mercadolibre: z.boolean().optional().describe('Revocar también la autorización en Mercado Libre antes de borrar los tokens'),
    },
    async run(args, ctx) {
      const lineas = [];
      if (args.revocar_en_mercadolibre && args.cuenta !== 'todas') {
        try {
          const c = ctx.sesiones.cliente(args.cuenta);
          await c.del(ruta`/users/${args.cuenta}/applications/${ctx.config.clientId}`);
          lineas.push('✅ Autorización revocada en Mercado Libre (la aplicación ya no tiene acceso a esa cuenta).');
        } catch (e) {
          if (e instanceof MeliError && e.status === 401) lineas.push('ℹ️ La sesión ya no era válida en Mercado Libre; se borran los tokens locales igual.');
          else lineas.push(`⚠️ No se pudo revocar en Mercado Libre (${e.message}). Podés hacerlo desde tu cuenta: Mi perfil → Seguridad → Aplicaciones conectadas. Se borran los tokens locales igual.`);
        }
      }
      const r = await ctx.sesiones.desconectar(args.cuenta);
      if (args.cuenta === 'todas') lineas.push(r.borradas ? '🗑️ Se borró el almacén local completo: no queda ninguna cuenta conectada.' : 'No había cuentas conectadas.');
      else lineas.push(r.borradas ? `🗑️ Cuenta ${r.nickname ?? args.cuenta} desconectada y tokens borrados de esta computadora.` : `La cuenta ${args.cuenta} no estaba conectada.`);
      return lineas.join('\n');
    },
  },
  {
    name: 'ml_estado',
    titulo: 'Estado del MCP',
    lectura: true,
    descripcion: 'Muestra la versión del MCP, el modo de seguridad (solo lectura / escrituras permitidas), dónde se guardan los tokens y a qué hosts se conecta. No contacta ningún servidor.',
    esquema: {},
    async run(_args, ctx) {
      const e = ctx.politica.estado();
      return [
        `# mercadolibre-sellers-mcp v${VERSION}`,
        `- **Modo:** ${e.soloLectura ? '🔒 SOLO LECTURA (por defecto)' : '✏️ ESCRITURA HABILITADA'}`,
        `- **Escrituras permitidas:** ${e.escriturasPermitidas.length ? e.escriturasPermitidas.join(', ') : 'ninguna'}`,
        `- **Escrituras bloqueadas:** ${e.escriturasBloqueadas.length ? e.escriturasBloqueadas.join(', ') : 'ninguna'}`,
        `- **Credenciales de la app:** ${ctx.config.clientId ? 'ML_CLIENT_ID cargado' : '⚠️ falta ML_CLIENT_ID'} · ${ctx.config.clientSecret ? 'ML_CLIENT_SECRET cargado' : '⚠️ falta ML_CLIENT_SECRET'} · ${ctx.config.redirectUri ? 'redirect URI: ' + ctx.config.redirectUri : '⚠️ falta ML_REDIRECT_URI'}`,
        `- **Cuentas conectadas:** ${ctx.sesiones.listar().length}`,
        `- **Tokens (cifrados AES-256-GCM):** ${ctx.almacen.archivo}`,
        `- **Registro local de escrituras:** ${e.archivoAuditoria}`,
        `- **Hosts a los que se conecta:** ${ctx.config.apiBase} (API) y auth.mercadolibre.* (solo el enlace de autorización que abrís en tu navegador). Ningún otro.`,
        '- **Actualizaciones:** manuales (git pull / descarga). El MCP nunca se actualiza solo ni consulta GitHub.',
      ].join('\n');
    },
  },
];
