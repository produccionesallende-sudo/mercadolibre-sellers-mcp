#!/usr/bin/env node
// Punto de entrada: servidor MCP por stdio para Claude Desktop / Claude Code.
// No hay instalador, auto-actualización ni telemetría: solo el servidor.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { crearContexto, crearServidor } from './servidor.js';
import { HERRAMIENTAS } from './herramientas/index.js';
import { log } from './log.js';
import { VERSION } from './version.js';

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  process.stdout.write(`mercadolibre-sellers-mcp ${VERSION}\n`);
  process.exit(0);
}
if (process.argv.includes('--listar-herramientas')) {
  for (const h of HERRAMIENTAS) process.stdout.write(`${h.lectura ? 'LECTURA  ' : 'ESCRITURA'} ${h.name}\n`);
  process.exit(0);
}

try {
  const ctx = crearContexto();
  const server = crearServidor(ctx);
  await server.connect(new StdioServerTransport());
  const e = ctx.politica.estado();
  log.info(`listo v${VERSION} · ${HERRAMIENTAS.length} herramientas · modo ${e.soloLectura ? 'SOLO LECTURA' : 'escritura: ' + e.escriturasPermitidas.join(',')} · datos en ${ctx.config.dirConfig}`);
} catch (e) {
  log.error('No se pudo iniciar el servidor:', e);
  process.exit(1);
}
