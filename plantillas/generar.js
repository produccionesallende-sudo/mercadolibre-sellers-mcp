#!/usr/bin/env node
/**
 * Genera una imagen SVG a partir de una plantilla y un archivo JSON de datos.
 *
 * Uso:
 *   node plantillas/generar.js --plantilla beneficio --datos datos.json --salida foto-2.svg [--foto foto.png] [--forzar]
 *
 * - Reemplaza los marcadores {{CAMPO}} de la plantilla con los valores del JSON.
 * - Avisa por stderr si falta algún campo (se reemplaza por texto vacío).
 * - Con --foto incrusta la imagen (png/jpg/jpeg/webp) como data URI en <image id="foto">.
 * - No sobreescribe un archivo existente salvo que se pase --forzar.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const PLANTILLAS_PERMITIDAS = ["beneficio", "caracteristicas", "medidas", "incluye"];
const TIPOS_IMAGEN = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const directorioPlantillas = dirname(fileURLToPath(import.meta.url));

function mostrarAyuda() {
  process.stdout.write(
    [
      "Uso: node plantillas/generar.js --plantilla <nombre> --datos <datos.json> --salida <archivo.svg> [--foto <imagen>] [--forzar]",
      "",
      "Plantillas disponibles: " + PLANTILLAS_PERMITIDAS.join(", "),
      "",
      "Opciones:",
      "  --plantilla  Nombre de la plantilla (sin extensión).",
      "  --datos      Archivo JSON con los campos a reemplazar.",
      "  --salida     Ruta del SVG de salida.",
      "  --foto       (opcional) Imagen png/jpg/jpeg/webp para incrustar en la plantilla.",
      "  --forzar     (opcional) Sobreescribe el archivo de salida si ya existe.",
      "  --ayuda      Muestra esta ayuda.",
      "",
    ].join("\n")
  );
}

function fallar(mensaje) {
  process.stderr.write("Error: " + mensaje + "\n");
  process.exit(1);
}

function parsearArgumentos(argv) {
  const opciones = { forzar: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--plantilla":
      case "--datos":
      case "--salida":
      case "--foto": {
        const valor = argv[i + 1];
        if (valor === undefined || valor.startsWith("--")) fallar(`falta el valor de ${arg}`);
        opciones[arg.slice(2)] = valor;
        i++;
        break;
      }
      case "--forzar":
        opciones.forzar = true;
        break;
      case "--ayuda":
      case "-h":
      case "--help":
        mostrarAyuda();
        process.exit(0);
        break;
      default:
        fallar(`argumento desconocido: ${arg}`);
    }
  }
  return opciones;
}

function escaparXml(valor) {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function leerDatos(ruta) {
  let contenido;
  try {
    contenido = readFileSync(ruta, "utf8");
  } catch {
    fallar(`no se pudo leer el archivo de datos: ${ruta}`);
  }
  let datos;
  try {
    datos = JSON.parse(contenido);
  } catch (e) {
    fallar(`el archivo de datos no es JSON válido: ${e.message}`);
  }
  if (datos === null || typeof datos !== "object" || Array.isArray(datos)) {
    fallar("el archivo de datos debe contener un objeto JSON con los campos de la plantilla");
  }
  return datos;
}

function incrustarFoto(svg, rutaFoto) {
  const extension = extname(rutaFoto).toLowerCase();
  const tipo = TIPOS_IMAGEN[extension];
  if (!tipo) {
    fallar(`formato de foto no soportado (${extension || "sin extensión"}); usá png, jpg, jpeg o webp`);
  }
  let bytes;
  try {
    bytes = readFileSync(rutaFoto);
  } catch {
    fallar(`no se pudo leer la foto: ${rutaFoto}`);
  }
  const dataUri = `data:${tipo};base64,${bytes.toString("base64")}`;

  // Captura la etiqueta <image ... id="foto" ...> completa (autocerrada o no).
  const patron = /<image\b[^>]*\bid="foto"[^>]*>/;
  const coincidencia = svg.match(patron);
  if (!coincidencia) {
    process.stderr.write("Aviso: la plantilla no tiene un elemento <image id=\"foto\">; se ignora --foto.\n");
    return svg;
  }

  const etiquetaOriginal = coincidencia[0];
  let etiquetaNueva;
  if (/\bhref="[^"]*"/.test(etiquetaOriginal)) {
    etiquetaNueva = etiquetaOriginal.replace(/\bhref="[^"]*"/, () => `href="${dataUri}"`);
  } else {
    // Inserta el atributo justo antes del cierre de la etiqueta.
    etiquetaNueva = etiquetaOriginal.replace(/\s*\/?>$/, (cierre) => ` href="${dataUri}"${cierre.trim()}`);
  }
  return svg.replace(patron, () => etiquetaNueva);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    mostrarAyuda();
    process.exit(1);
  }
  const opciones = parsearArgumentos(argv);

  if (!opciones.plantilla) fallar("falta --plantilla");
  if (!opciones.datos) fallar("falta --datos");
  if (!opciones.salida) fallar("falta --salida");

  if (!PLANTILLAS_PERMITIDAS.includes(opciones.plantilla)) {
    fallar(
      `plantilla no permitida: "${opciones.plantilla}". Opciones válidas: ${PLANTILLAS_PERMITIDAS.join(", ")}`
    );
  }

  const rutaPlantilla = join(directorioPlantillas, `${opciones.plantilla}.svg`);
  let svg;
  try {
    svg = readFileSync(rutaPlantilla, "utf8");
  } catch {
    fallar(`no se encontró la plantilla en ${rutaPlantilla}`);
  }

  const datos = leerDatos(opciones.datos);
  const faltantes = new Set();

  svg = svg.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, campo) => {
    if (Object.prototype.hasOwnProperty.call(datos, campo) && datos[campo] !== null && datos[campo] !== undefined) {
      return escaparXml(datos[campo]);
    }
    faltantes.add(campo);
    return "";
  });

  for (const campo of faltantes) {
    process.stderr.write(`Aviso: falta el campo "${campo}" en los datos; se dejó vacío.\n`);
  }

  if (opciones.foto) {
    svg = incrustarFoto(svg, opciones.foto);
  }

  const rutaSalida = resolve(opciones.salida);
  if (existsSync(rutaSalida) && !opciones.forzar) {
    fallar(`el archivo de salida ya existe: ${rutaSalida} (usá --forzar para sobreescribir)`);
  }

  try {
    writeFileSync(rutaSalida, svg, "utf8");
  } catch (e) {
    fallar(`no se pudo escribir la salida: ${e.message}`);
  }

  process.stdout.write(rutaSalida + "\n");
}

main();
