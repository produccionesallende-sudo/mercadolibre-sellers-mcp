// Definiciones compartidas por las herramientas.
import { z } from 'zod';

export const cuentaParam = {
  cuenta: z.string().regex(/^\d{1,20}$/).optional().describe('user_id de la cuenta de Mercado Libre si hay varias conectadas (ver ml_cuentas)'),
};

export const itemId = z.string().regex(/^[A-Z]{3}\d{3,15}$/, 'Formato esperado: MLA123456789').describe('ID de la publicación, ej. MLA123456789');
export const sitioParam = z.string().regex(/^[A-Z]{3}$/).optional().describe('Sitio/país: MLA, MLM, MLB, MLC, MCO, MLU, MPE…');
export const categoriaParam = z.string().regex(/^[A-Z]{3}\d{1,12}$/).optional().describe('ID de categoría, ej. MLA1055');
export const limiteParam = (def, max = 50) => z.number().int().min(1).max(max).optional().describe(`Cantidad a devolver (default ${def}, máx ${max})`);
export const diasParam = (def, max = 365) => z.number().int().min(1).max(max).optional().describe(`Últimos N días (default ${def})`);

/** Crea un cliente autenticado para la cuenta indicada y fija el locale. */
export async function clientePara(ctx, args) {
  const c = ctx.sesiones.cliente(args?.cuenta);
  ctx.formato.fijarLocale(await c.sitio());
  return c;
}
