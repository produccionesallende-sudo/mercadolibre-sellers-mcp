#!/usr/bin/env node
// Escáner de secretos previo a cada commit/push. Recorre los archivos del
// repositorio (ignorando node_modules y .git) buscando tokens, claves y
// archivos que nunca deberían subirse. Sale con código 1 si encuentra algo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IGNORAR_DIRS = new Set(['node_modules', '.git', 'coverage', 'tmp', '.tmp']);
const ARCHIVOS_PROHIBIDOS = [/^\.env(\..+)?$/, /^cuentas\.json(\..+)?$/, /^vigilancia\.json$/, /^auditoria-escrituras\.log$/, /\.(pem|key|p12|pfx)$/i, /^claude_desktop_config\.json$/];
const PERMITIDOS_ENV = new Set(['.env.example']);

const PATRONES = [
  ['Access token de Mercado Libre', /\bAPP_USR-\d{6,}-\d{6}-[a-f0-9]{32}-\d+/],
  ['Refresh token / code de Mercado Libre', /\bTG-[a-f0-9]{24,}-\d+\b/],
  ['Token de prueba de Mercado Libre', /\bTEST-\d{6,}-\d{6}-[a-f0-9]{32}-\d+/],
  ['Client Secret de Mercado Libre (32+ chars) asignado', /(CLIENT_SECRET|APP_SECRET)\s*[=:]\s*["']?[A-Za-z0-9]{32,}/],
  ['Client ID real asignado', /(CLIENT_ID|APP_ID)\s*[=:]\s*["']?\d{10,}\b/],
  ['Token de GitHub', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['Clave privada', /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Clave AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['Token Slack', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Bearer literal', /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{20,}/],
];
// Ejemplos ficticios permitidos (pruebas y documentación)
const EXCEPCIONES = [/abcdefabcdefabcdefabcdefabcdefab/, /1234567890123456/, /SECRETO-DE-PRUEBA/, /TU_CLIENT/, /TU_APP/, /\{\{/, /TG-([a-f])\1{15,}-\d+/];

const hallazgos = [];
function recorrer(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (!IGNORAR_DIRS.has(ent.name)) recorrer(p); continue; }
    const rel = path.relative(raiz, p);
    if (ARCHIVOS_PROHIBIDOS.some((re) => re.test(ent.name)) && !PERMITIDOS_ENV.has(ent.name)) { hallazgos.push(`${rel}: archivo que no debe subirse`); continue; }
    if (/\.(png|jpg|jpeg|gif|webp|ico|woff2?|mp4|mov|zip)$/i.test(ent.name) || ent.name === 'package-lock.json') continue;
    let texto;
    try { texto = fs.readFileSync(p, 'utf8'); } catch { continue; }
    texto.split('\n').forEach((linea, i) => {
      if (EXCEPCIONES.some((re) => re.test(linea))) return;
      for (const [nombre, re] of PATRONES) if (re.test(linea)) hallazgos.push(`${rel}:${i + 1}: ${nombre}`);
    });
  }
}
recorrer(raiz);

if (hallazgos.length) {
  console.error('⛔ Posibles secretos encontrados:\n' + hallazgos.map((h) => '  - ' + h).join('\n'));
  process.exit(1);
}
console.log('✅ Sin secretos detectados en el repositorio.');
