// Arma el McpServer, registra las herramientas y aplica la política de
// seguridad en un único lugar (no depende de que cada herramienta "se acuerde").
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HERRAMIENTAS } from './herramientas/index.js';
import { leerConfig } from './config.js';
import { AlmacenCuentas } from './almacen.js';
import { crearTransporte } from './meli/transporte.js';
import { Sesiones } from './meli/sesiones.js';
import { PoliticaEscritura } from './politica.js';
import { mensajeParaUsuario } from './errores.js';
import { redactar } from './redaccion.js';
import { log } from './log.js';
import { NOMBRE, VERSION } from './version.js';
import * as formato from './formato.js';

export const INSTRUCCIONES = [
  'MCP propio para vendedores de Mercado Libre: conexión directa a la API oficial con la cuenta del vendedor; los tokens quedan cifrados en la computadora del usuario y no pasan por ningún servidor de terceros.',
  'Si no hay cuenta conectada, guiá al usuario con ml_conectar. Si hay varias, resolvé la cuenta con ml_cuentas y pasá el parámetro "cuenta".',
  'Por defecto el MCP está en SOLO LECTURA: las herramientas marcadas "(ESCRITURA)" devuelven un mensaje de bloqueo. Nunca intentes evadirlo; explicá cómo habilitarlo (README).',
  'Si la escritura está habilitada, las herramientas de escritura modifican la tienda real: mostrá antes el cambio exacto, pedí confirmación explícita por ítem en la conversación y recién entonces llamalas con confirmar=true. Nunca ejecutes escrituras en lote sin listar cada una.',
  'Nunca inventes datos: si una herramienta falla o no devuelve algo, decilo.',
].join(' ');

/**
 * Crea el contexto compartido (config, almacén, sesiones, política).
 * @param {{env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch, ahora?: () => number}} p
 */
export function crearContexto({ env = process.env, fetchImpl, ahora } = {}) {
  const config = leerConfig(env);
  const almacen = new AlmacenCuentas({ dirConfig: config.dirConfig, clientSecret: config.clientSecret, claveAlmacen: config.claveAlmacen });
  const transporte = crearTransporte({ apiBase: config.apiBase, fetchImpl });
  const sesiones = new Sesiones({ config, almacen, transporte, ahora });
  const politica = new PoliticaEscritura(config);
  return { config, almacen, transporte, sesiones, politica, formato };
}

/** Ejecuta una herramienta aplicando política, auditoría y traducción de errores. */
export async function ejecutarHerramienta(ctx, tool, args) {
  const a = args || {};
  if (!tool.lectura) ctx.politica.verificar(tool.name); // lanza si está bloqueada
  try {
    const texto = await tool.run(a, ctx);
    if (!tool.lectura) ctx.politica.registrar({ herramienta: tool.name, cuenta: a.cuenta, args: a, resultado: texto });
    return { content: [{ type: 'text', text: redactar(String(texto)) }] };
  } catch (e) {
    if (!tool.lectura) ctx.politica.registrar({ herramienta: tool.name, cuenta: a.cuenta, args: a, error: e });
    log.debug(`${tool.name} falló:`, e);
    return { content: [{ type: 'text', text: mensajeParaUsuario(e) }], isError: true };
  }
}

export function crearServidor(ctx) {
  const server = new McpServer({ name: NOMBRE, version: VERSION }, { instructions: INSTRUCCIONES });
  for (const tool of HERRAMIENTAS) {
    const bloqueada = !tool.lectura && !ctx.config.escriturasPermitidas.includes(tool.name);
    server.registerTool(
      tool.name,
      {
        title: tool.titulo,
        description: (bloqueada ? '🔒 BLOQUEADA (modo solo lectura). ' : '') + tool.descripcion,
        inputSchema: tool.esquema,
        annotations: { readOnlyHint: tool.lectura, destructiveHint: !tool.lectura, openWorldHint: true },
      },
      async (args) => {
        try {
          return await ejecutarHerramienta(ctx, tool, args);
        } catch (e) {
          // Bloqueo de política u otros errores previos a run()
          return { content: [{ type: 'text', text: mensajeParaUsuario(e) }], isError: true };
        }
      },
    );
  }
  return server;
}
