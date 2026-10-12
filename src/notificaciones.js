#!/usr/bin/env node
// Punto de entrada del receptor de notificaciones de Mercado Libre.
// Es un proceso separado del servidor MCP (src/index.js); se despliega en un
// servicio con URL pública HTTPS. Uso: PORT=3000 node src/notificaciones.js
import { crearReceptor, leerConfigNotificaciones } from './notificaciones/receptor.js';
import { log } from './log.js';

try {
  const receptor = crearReceptor(leerConfigNotificaciones());
  await receptor.iniciar();
  const apagar = (senal) => {
    log.info(`Señal ${senal}: cerrando el receptor (${receptor.contadores.aceptadas} aceptadas, ${receptor.contadores.ignoradas} ignoradas, ${receptor.contadores.rechazadas} rechazadas).`);
    receptor.detener().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => apagar('SIGTERM'));
  process.on('SIGINT', () => apagar('SIGINT'));
} catch (e) {
  log.error('No se pudo iniciar el receptor de notificaciones:', e);
  process.exit(1);
}
