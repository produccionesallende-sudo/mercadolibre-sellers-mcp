// Política de escrituras: TODA herramienta capaz de modificar Mercado Libre
// pasa por acá antes de ejecutar. Si SOLO_LECTURA está activo (default) o la
// herramienta no está en ESCRITURAS_PERMITIDAS, se bloquea ANTES de tocar la
// red. Además, cada escritura ejecutada deja una línea en un registro local
// (redactado, sin tokens) para que el propietario pueda auditar qué cambió.
import fs from 'node:fs';
import path from 'node:path';
import { EscrituraBloqueadaError } from './errores.js';
import { escrituraPermitida, HERRAMIENTAS_ESCRITURA } from './config.js';
import { redactarObjeto } from './redaccion.js';
import { log } from './log.js';

export class PoliticaEscritura {
  constructor(config) {
    this.config = config;
    this.archivoAuditoria = path.join(config.dirConfig, 'auditoria-escrituras.log');
  }

  esEscritura(nombre) {
    return HERRAMIENTAS_ESCRITURA.includes(nombre);
  }

  /** Lanza EscrituraBloqueadaError si la herramienta no puede ejecutarse. */
  verificar(nombre) {
    if (!this.esEscritura(nombre)) return;
    if (this.config.soloLectura) {
      throw new EscrituraBloqueadaError(
        `🔒 ${nombre} está bloqueada: el MCP está en modo SOLO LECTURA (es el modo por defecto). ` +
        'Para habilitar escrituras, el propietario debe poner SOLO_LECTURA=false en la configuración del MCP y reiniciar Claude. Ver README → "Habilitar escritura".',
      );
    }
    if (!escrituraPermitida(this.config, nombre)) {
      throw new EscrituraBloqueadaError(
        `🔒 ${nombre} no está en ESCRITURAS_PERMITIDAS (permitidas: ${this.config.escriturasPermitidas.join(', ') || 'ninguna'}). ` +
        'El propietario puede agregarla en la configuración del MCP.',
      );
    }
  }

  /** Registra una escritura ejecutada (éxito o fallo). Nunca guarda tokens. */
  registrar({ herramienta, cuenta, args, resultado, error }) {
    try {
      fs.mkdirSync(this.config.dirConfig, { recursive: true, mode: 0o700 });
      const linea = JSON.stringify(redactarObjeto({
        fecha: new Date().toISOString(),
        herramienta,
        cuenta: cuenta ?? null,
        args: args ?? {},
        ok: !error,
        resultado: error ? undefined : String(resultado ?? '').slice(0, 300),
        error: error ? String(error.message ?? error).slice(0, 300) : undefined,
      }));
      fs.appendFileSync(this.archivoAuditoria, linea + '\n', { mode: 0o600 });
    } catch (e) {
      log.warn('No se pudo escribir el registro de auditoría:', e);
    }
  }

  estado() {
    return {
      soloLectura: this.config.soloLectura,
      escriturasPermitidas: [...this.config.escriturasPermitidas],
      escriturasBloqueadas: HERRAMIENTAS_ESCRITURA.filter((n) => !escrituraPermitida(this.config, n)),
      archivoAuditoria: this.archivoAuditoria,
    };
  }
}
