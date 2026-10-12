// Logger mínimo: SIEMPRE a stderr (stdout está reservado al protocolo MCP) y
// SIEMPRE redactado. No hay telemetría ni envío de logs a ningún lado.
import { redactar } from './redaccion.js';

const NIVELES = { error: 0, warn: 1, info: 2, debug: 3 };
let nivel = NIVELES[String(process.env.ML_LOG_NIVEL || 'info').toLowerCase()] ?? NIVELES.info;
let salida = (linea) => process.stderr.write(linea + '\n');

export function configurarLog({ nivel: n, escritor } = {}) {
  if (n && NIVELES[n] != null) nivel = NIVELES[n];
  if (escritor) salida = escritor;
}

function escribir(n, partes) {
  if (NIVELES[n] > nivel) return;
  const texto = partes.map((p) => (p instanceof Error ? p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
  salida(`[mercadolibre-sellers-mcp] ${n.toUpperCase()} ${redactar(texto)}`);
}

export const log = {
  error: (...p) => escribir('error', p),
  warn: (...p) => escribir('warn', p),
  info: (...p) => escribir('info', p),
  debug: (...p) => escribir('debug', p),
};
