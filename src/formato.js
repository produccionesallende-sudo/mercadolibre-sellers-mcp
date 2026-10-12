// Helpers de presentación (texto Markdown para Claude).
const LOCALE_POR_SITIO = { MLA: 'es-AR', MLB: 'pt-BR', MLM: 'es-MX', MLC: 'es-CL', MCO: 'es-CO', MLU: 'es-UY', MPE: 'es-PE' };

let localeActual = 'es-AR';
export function fijarLocale(sitio) {
  localeActual = LOCALE_POR_SITIO[sitio] || 'es-419';
}

export function numero(n, dec = 0) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(localeActual, { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}

export function dinero(n, moneda = '$', dec = 2) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${moneda} ${numero(n, dec)}`;
}

export function pct(n, dec = 1) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${numero(n, dec)}%`;
}

export function fecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(localeActual);
}

export function variacion(actual, previo) {
  if (!previo) return '';
  const d = ((actual - previo) / previo) * 100;
  return ` (${d >= 0 ? '↑' : '↓'} ${numero(Math.abs(d), 1)}% vs período anterior)`;
}

/** Tabla Markdown. */
export function tabla(cabeceras, filas) {
  const esc = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    `| ${cabeceras.map(esc).join(' | ')} |`,
    `| ${cabeceras.map(() => '---').join(' | ')} |`,
    ...filas.map((f) => `| ${f.map(esc).join(' | ')} |`),
  ].join('\n');
}

export function limitarTexto(s, max = 60) {
  const t = String(s ?? '');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Fecha ISO (YYYY-MM-DD) para la API de publicidad. */
export function isoDia(d) {
  return new Date(d).toISOString().slice(0, 10);
}
