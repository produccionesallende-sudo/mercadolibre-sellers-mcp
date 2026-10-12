// Registro de todas las herramientas. Las de escritura viven en una carpeta
// separada y se marcan con lectura:false; la política las bloquea por defecto.
import { herramientas as conexion } from './local/conexion.js';
import { herramientas as vigilancia } from './local/vigilancia.js';
import { herramientas as ventas } from './lectura/ventas.js';
import { herramientas as publicaciones } from './lectura/publicaciones.js';
import { herramientas as mercado } from './lectura/mercado.js';
import { herramientas as publicidad } from './lectura/publicidad.js';
import { herramientas as clips } from './lectura/clips.js';
import { herramientas as escritura } from './escritura/index.js';
import { HERRAMIENTAS_ESCRITURA } from '../config.js';

export const HERRAMIENTAS = Object.freeze([
  ...conexion, ...ventas, ...publicaciones, ...mercado, ...publicidad, ...clips, ...vigilancia, ...escritura,
]);

// Coherencia: toda herramienta lectura:false debe estar en la lista de la
// política, y viceversa. Falla al cargar si alguien se olvida.
const marcadas = new Set(HERRAMIENTAS.filter((h) => !h.lectura).map((h) => h.name));
for (const n of HERRAMIENTAS_ESCRITURA) if (!marcadas.has(n)) throw new Error(`La política lista ${n} como escritura pero no existe o está marcada como lectura.`);
for (const n of marcadas) if (!HERRAMIENTAS_ESCRITURA.includes(n)) throw new Error(`${n} es de escritura pero no figura en HERRAMIENTAS_ESCRITURA (config.js).`);
const nombres = HERRAMIENTAS.map((h) => h.name);
if (new Set(nombres).size !== nombres.length) throw new Error('Hay herramientas con nombre duplicado.');

export const HERRAMIENTAS_LECTURA = Object.freeze(HERRAMIENTAS.filter((h) => h.lectura).map((h) => h.name));
