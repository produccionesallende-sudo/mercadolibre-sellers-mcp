---
name: setup-ml
description: Primer uso del MCP mercadolibre-sellers-mcp. Usar cuando el usuario diga "conectar mi cuenta de Mercado Libre", "configurar Mercado Libre", "empezar con el MCP", "vincular otra cuenta", "no sé por dónde empezar" o cuando ninguna cuenta aparezca conectada al intentar otra tarea.
---

# Setup inicial de Mercado Libre

## Objetivo
Dejar al vendedor con al menos una cuenta conectada, verificar que el MCP funciona, mostrar un primer vistazo real de su negocio y proponer una rutina de uso.

## Flujo
1. Llamar `ml_estado()` y explicar en una frase: versión, si está en modo solo lectura, qué escrituras están permitidas y dónde se guardan los tokens. Aclarar que el modo solo lectura es el predeterminado y es seguro.
2. Llamar `ml_cuentas()`. Si ya hay cuentas, saltar al paso 6. Si no hay ninguna, continuar.
3. Llamar `ml_conectar(sitio?)`. Si el usuario no indica país, preguntar (MLA Argentina, MLM México, MLB Brasil, MLC Chile, MCO Colombia, MLU Uruguay, MPE Perú). Mostrar el enlace de autorización tal cual lo devuelve la herramienta.
4. Pedir al usuario que abra el enlace, inicie sesión con la cuenta vendedora y autorice. Luego que pegue la URL completa a la que fue redirigido (o solo el código). Explicar que la URL puede mostrar un error de página, eso es normal: lo que importa es el parámetro `code`.
5. Llamar `ml_conectar(codigo=<lo que pegó>)`. Confirmar con `ml_cuentas()` que la cuenta aparece. Si se van a usar varias cuentas, repetir los pasos 3-5 por cada una y luego fijar la principal con `ml_cuentas(predeterminada=<alias>)`.
6. Primer vistazo: llamar `ml_panel_ventas(cuenta?)` y resumir facturación de hoy y del mes, productos más vendidos y métodos de envío.
7. Primer diagnóstico: llamar `ml_auditar_publicaciones(cuenta?, limite=20)` y listar las publicaciones en rojo con su arreglo concreto.
8. Proponer la rutina sugerida (ver abajo) y mencionar qué skills cubren cada parte.

## Formato de salida
```
Estado del MCP: v<x> | solo lectura: sí/no | tokens en: <ruta>
Cuentas conectadas: <alias> (<sitio>) [predeterminada]

Hoy: $<x> en <n> ventas | Mes: $<x>
Top 3 productos: ...
Publicaciones en rojo: <n> (ver detalle)

Rutina sugerida:
- Diario: panel-ventas-ml + responder-preguntas-ml
- Semanal: reporte-ventas-ml, vigilancia-ml, publicidad-ml
- Mensual: mejorar-publicaciones-ml, descubrir-ganadores-ml
```

## Multi-cuenta
- Cada cuenta se identifica por alias. Cuando el usuario mencione "la otra cuenta", confirmar el alias con `ml_cuentas()` antes de operar.
- `ml_metricas(cuenta="todas")` consolida varias cuentas; el resto de herramientas opera sobre una cuenta a la vez.
- Para quitar una cuenta: `ml_desconectar(cuenta)`; usar `revocar_en_mercadolibre=true` solo si el usuario lo pide explícitamente.

## Reglas
- Nunca inventar datos: cada cifra, alias o estado debe salir de una respuesta de herramienta. Si algo falla, mostrar el error textual.
- Nunca pedir ni guardar contraseñas de Mercado Libre; la autorización ocurre siempre en el navegador del usuario.
- Escrituras solo con confirmación explícita por ítem y solo si el propietario habilitó la escritura. Este skill no realiza escrituras.
- Si el MCP responde que está en solo lectura, explicarlo con calma: el propietario lo habilita con `SOLO_LECTURA=false` en la configuración del MCP. No intentar evadirlo ni sugerir atajos.
- Si el enlace de autorización vence o el código no sirve, repetir `ml_conectar()` para generar uno nuevo; no reintentar con el mismo código.
