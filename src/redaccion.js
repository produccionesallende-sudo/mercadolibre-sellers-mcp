// Redacción de secretos: todo texto que sale hacia logs, errores o el registro
// de auditoría pasa por acá. Combina valores secretos conocidos (Client Secret,
// tokens cargados en memoria) con patrones de los formatos de Mercado Libre.

const conocidos = new Set();

/** Registra un valor secreto para que nunca aparezca literal en una salida. */
export function registrarSecreto(valor) {
  if (typeof valor === 'string' && valor.length >= 6) conocidos.add(valor);
}

/** Solo para pruebas. */
export function olvidarSecretos() {
  conocidos.clear();
}

const PATRONES = [
  // Access tokens de Mercado Libre (APP_USR-..., TEST-...)
  [/\b(APP_USR|TEST)-[A-Za-z0-9-]{8,}/g, '$1-[REDACTADO]'],
  // Códigos de autorización y refresh tokens (TG-...)
  [/\bTG-[A-Za-z0-9-]{8,}/g, 'TG-[REDACTADO]'],
  // Cabecera Authorization
  [/(Bearer\s+)[^\s"',]+/gi, '$1[REDACTADO]'],
  // Campos sensibles en JSON
  [/("(?:access_token|refresh_token|client_secret|code_verifier|code|token|secret)"\s*:\s*")[^"]*(")/gi, '$1[REDACTADO]$2'],
  // Campos sensibles en query strings / form-urlencoded
  [/\b((?:access_token|refresh_token|client_secret|code_verifier|code)=)[^&\s"']+/gi, '$1[REDACTADO]'],
];

export function redactar(texto) {
  if (texto == null) return texto;
  let s = String(texto);
  for (const v of conocidos) {
    if (s.includes(v)) s = s.split(v).join('[REDACTADO]');
  }
  for (const [re, rep] of PATRONES) s = s.replace(re, rep);
  return s;
}

/** Redacta recursivamente un objeto (para el registro de auditoría). */
export function redactarObjeto(obj) {
  return JSON.parse(redactar(JSON.stringify(obj ?? null)));
}
