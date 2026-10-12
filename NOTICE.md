# Avisos de origen y licencias

## Este proyecto

`mercadolibre-sellers-mcp` es una implementación **propia e independiente**,
escrita desde cero, con licencia MIT (ver `LICENSE`). Su fuente técnica
principal es la documentación oficial de Mercado Libre para desarrolladores
(https://developers.mercadolibre.com.ar) y la especificación del Model Context
Protocol.

## Proyecto de referencia

Durante el diseño se analizó, **solo como referencia funcional** (qué
capacidades ofrece y qué endpoints usa), el proyecto
`mercadolibre-sellers-mcp` de "Algoritmo Digital" (paquete
`@algoritmodigital/meli-sellers-mcp` v1.12.0), publicado bajo licencia MIT.

- No se copió código fuente de ese proyecto: la arquitectura, los módulos, el
  almacén de tokens, el transporte HTTP, las herramientas, las pruebas, las
  skills, las plantillas y la documentación de este repositorio fueron
  escritos de nuevo.
- Este proyecto **no depende** en tiempo de ejecución de ningún repositorio,
  página, servidor, CRM ni servicio de ese autor. No hay chequeo remoto de
  versiones, ni redirect URI de terceros, ni instalador vía `npx github:…`.
- El resumen de la auditoría de ese proyecto está en
  `docs/auditoria-referencia.md` y la matriz de paridad funcional en
  `docs/paridad.md`.

## Dependencias de terceros (runtime)

| Paquete | Licencia | Uso |
| --- | --- | --- |
| `@modelcontextprotocol/sdk` | MIT | Servidor MCP (transporte stdio) |
| `zod` | MIT | Validación de parámetros |

Las dependencias transitivas del SDK (express, hono, jose, ajv, etc.) solo se
usan por sus transportes HTTP, que este proyecto **no** utiliza; igualmente se
auditan con `npm audit` y se fijan por `package-lock.json`.
