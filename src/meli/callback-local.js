// Callback local opcional para OAuth: un servidor HTTP mínimo en 127.0.0.1
// que recibe UNA sola redirección (?code=...&state=...), muestra una página
// de confirmación y se apaga. Solo se usa si ML_REDIRECT_URI apunta a
// http://127.0.0.1:PUERTO/... (o localhost). Nunca escucha en otras interfaces.
import http from 'node:http';

const PAGINA = (titulo, cuerpo) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f6f7f3;color:#17211c}
.c{background:#fff;border:1px solid #dde2db;border-radius:14px;padding:28px;max-width:520px;text-align:center}</style></head>
<body><div class="c"><h1>${titulo}</h1><p>${cuerpo}</p></div></body></html>`;

/**
 * Espera una redirección en la URL indicada.
 * @param {string} redirectUri  p.ej. http://127.0.0.1:8765/callback
 * @param {{stateEsperado: string, timeoutMs?: number}} p
 * @returns {Promise<{code: string, state: string}>}
 */
export function esperarCallback(redirectUri, { stateEsperado, timeoutMs = 10 * 60 * 1000 }) {
  const u = new URL(redirectUri);
  if (!['127.0.0.1', 'localhost'].includes(u.hostname) || u.protocol !== 'http:') {
    return Promise.reject(new Error('El callback local solo funciona con http://127.0.0.1 o http://localhost.'));
  }
  const puerto = Number(u.port || 80);
  return new Promise((resolver, rechazar) => {
    let terminado = false;
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${puerto}`);
      if (url.pathname !== u.pathname) { res.writeHead(404).end(); return; }
      const code = url.searchParams.get('code'), state = url.searchParams.get('state');
      const err = url.searchParams.get('error');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      if (err) {
        res.writeHead(400).end(PAGINA('❌ Autorización rechazada', `Mercado Libre informó: ${String(err).replace(/[<>&]/g, '')}. Podés cerrar esta ventana.`));
        return;
      }
      if (!code || state !== stateEsperado) {
        res.writeHead(400).end(PAGINA('❌ Respuesta inválida', 'Falta el código o el "state" no coincide. Volvé a Claude e iniciá la conexión de nuevo.'));
        return;
      }
      res.writeHead(200).end(PAGINA('✅ Cuenta autorizada', 'Ya podés cerrar esta ventana y volver a Claude. El código quedó en tu computadora; nada se envió a terceros.'));
      finalizar(null, { code, state });
    });
    const temporizador = setTimeout(() => finalizar(new Error('Se agotó el tiempo esperando la autorización (10 minutos).')), timeoutMs);
    function finalizar(e, v) {
      if (terminado) return;
      terminado = true;
      clearTimeout(temporizador);
      server.close();
      e ? rechazar(e) : resolver(v);
    }
    server.on('error', (e) => finalizar(e));
    server.listen(puerto, '127.0.0.1');
  });
}
