// Helpers comunes para las pruebas: directorio temporal, env base y contexto.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crearContexto } from '../../src/servidor.js';
import { crearMock, CODE_OK } from './mock-meli.js';
import { olvidarSecretos } from '../../src/redaccion.js';
import { configurarLog } from '../../src/log.js';

export const CLIENT_ID = '1234567890123456';
export const CLIENT_SECRET = 'SECRETO-DE-PRUEBA-NUNCA-REAL-abcdef123456';
export const REDIRECT = 'https://ejemplo.test/callback';

export const logs = [];
configurarLog({ nivel: 'debug', escritor: (l) => logs.push(l) });

export function dirTemporal() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mlmcp-test-'));
}

export function envBase(apiBase, extra = {}) {
  return {
    ML_CLIENT_ID: CLIENT_ID,
    ML_CLIENT_SECRET: CLIENT_SECRET,
    ML_REDIRECT_URI: REDIRECT,
    ML_CONFIG_DIR: dirTemporal(),
    ML_API_BASE: apiBase,
    ML_SITE: 'MLA',
    ...extra,
  };
}

/** Levanta el simulador y crea un contexto apuntando a él. */
export async function entorno(extraEnv = {}) {
  olvidarSecretos();
  logs.length = 0;
  const mock = crearMock();
  const apiBase = await mock.iniciar();
  const env = envBase(apiBase, extraEnv);
  const ctx = crearContexto({ env });
  return {
    mock, env, ctx, apiBase,
    async conectar() {
      await ctx.sesiones.iniciarConexion({});
      return ctx.sesiones.completarConexion({ entrada: CODE_OK });
    },
    async cerrar() {
      await mock.detener();
      fs.rmSync(env.ML_CONFIG_DIR, { recursive: true, force: true });
    },
  };
}
