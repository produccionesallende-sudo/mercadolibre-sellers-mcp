---
name: descubrir-ganadores-ml
description: Investigar qué productos conviene vender en Mercado Libre. Usar cuando el usuario pregunte "qué puedo vender", "qué se está vendiendo", "productos ganadores", "tendencias en mi categoría", "qué nicho tiene poca competencia", "me conviene entrar en esta categoría" o quiera ampliar su catálogo.
---

# Descubrir productos ganadores

## Objetivo
Encontrar oportunidades reales (demanda comprobada, competencia manejable, margen posible) y dejar al usuario con una lista corta de candidatos, cada uno con datos de respaldo y un plan de seguimiento.

## Flujo
1. Definir el punto de partida con el usuario: una categoría, una búsqueda, un rubro que ya vende o "cualquier cosa". Si vende algo hoy, llamar `ml_panel_ventas(cuenta?)` para partir de sus categorías fuertes.
2. Llamar `ml_tendencias(cuenta?, categoria?, sitio?, limite=30)` para obtener las búsquedas en alza. Marcar las que tienen relación con el rubro del usuario.
3. Para cada búsqueda prometedora, llamar `ml_descubrir_ganadores(cuenta?, busqueda=<término>, sitio?)` o `ml_descubrir_ganadores(cuenta?, categoria=<id>)`. Tomar: publicaciones con más ventas, rango de precios, cantidad de vendedores, presencia de grandes marcas o tiendas oficiales.
4. Para las 3 a 5 mejores candidatas, llamar `ml_buscar(cuenta?, consulta=<término>, limite=20)` y evaluar competencia: cuántos vendedores con reputación verde, si hay Full dominante, dispersión de precios.
5. Estimar viabilidad económica: `ml_categorias(cuenta?, titulo=<título tipo>)` para predecir la categoría y `ml_comisiones(cuenta?, precio=<precio mediano del mercado>, categoria)`. Si el usuario conoce el costo de compra, llamar `ml_rentabilidad` con esos datos; si no, mostrar solo comisión y pedir el costo.
6. Puntuar cada candidata de 1 a 5 en demanda, competencia y margen, con una línea que justifique cada puntaje a partir de los datos obtenidos.
7. Para las candidatas que el usuario quiera seguir, ofrecer `ml_vigilar(cuenta?, accion="agregar", tipo="busqueda"|"tendencias"|"publicacion", ref, nota)` y revisarlas en dos semanas con vigilancia-ml antes de invertir en stock.

## Formato de salida
```
OPORTUNIDADES — sitio <MLx> — base: <categoría/búsqueda>

| # | Producto / búsqueda | Demanda | Competencia | Margen | Precio mediano | Vendedores | Comisión |
| 1 | "<término>" | 5/5 (tendencia en alza) | 3/5 (<n> vendedores, sin tienda oficial) | ?/5 (falta costo) | $<x> | <n> | <n> % |

Detalle por candidata:
- <término>: top vendedor <nick> con <n> ventas a $<x>; precios entre $<x> y $<y>; ...

Siguiente paso: vigilar "<término>" dos semanas y conseguir costo de proveedor.
```

## Reglas
- Nunca inventar datos: volúmenes, precios y cantidad de vendedores salen de las herramientas; no afirmar "se venden miles" sin un número devuelto.
- No garantizar que un producto venderá; presentar las oportunidades como hipótesis a validar.
- No sugerir copiar publicaciones, fotos o textos de terceros (ver copiar-publicaciones-ml).
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Este skill no crea publicaciones; si el usuario quiere publicar, derivar a copiar-publicaciones-ml.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo.
- Descartar de entrada categorías con restricciones legales o de permisos (medicamentos, armas, productos que exigen homologación) salvo que el usuario confirme que puede venderlos.
- Si `ml_tendencias` o `ml_descubrir_ganadores` devuelven vacío para el sitio o categoría, decirlo y proponer ampliar la búsqueda; no reemplazar con conocimiento general.
