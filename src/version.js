// Versión local del paquete. No hay chequeo remoto de actualizaciones: el
// servidor nunca contacta GitHub ni ningún host distinto de Mercado Libre.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));

export const NOMBRE = pkg.name;
export const VERSION = pkg.version;
