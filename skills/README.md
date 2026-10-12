# Skills para mercadolibre-sellers-mcp

Cada carpeta contiene un `SKILL.md`: instrucciones que Claude sigue para resolver una tarea concreta usando las herramientas del MCP `mercadolibre-sellers-mcp`. Los skills no reemplazan al MCP: lo orquestan. Todos respetan la misma regla de seguridad: el MCP arranca en modo solo lectura y ninguna escritura se ejecuta sin confirmación explícita del usuario por cada ítem.

## Índice

| Skill | Qué hace | Cuándo se activa |
|---|---|---|
| `setup-ml` | Conecta la primera cuenta (o varias), verifica el estado del MCP y muestra un primer panel y auditoría | "conectar mi cuenta", "empezar", "configurar Mercado Libre" |
| `panel-ventas-ml` | Vistazo rápido de hoy y del mes, top de productos, envíos y preguntas pendientes | "cómo venimos", "qué se vendió hoy" |
| `reporte-ventas-ml` | Informe ejecutivo diario/semanal/mensual comparado con el período anterior | "reporte de ventas", "cómo cerró el mes" |
| `responder-preguntas-ml` | Redacta todas las respuestas pendientes, las aprueba el usuario y las publica una por una | "responder preguntas", "contestá lo pendiente" |
| `mejorar-publicaciones-ml` | Audita, prioriza por visitas vs. conversión y propone título/precio/stock exactos | "mejorar publicaciones", "por qué no vendo" |
| `competencia-ml` | Posición frente a rivales, buy box de catálogo, rentabilidad antes de mover precios | "cómo estoy contra la competencia", "a cuánto lo venden otros" |
| `vigilancia-ml` | Lista de vigilancia (vendedores, publicaciones, búsquedas, tendencias) y revisión semanal | "vigilar a este vendedor", "qué novedades hay" |
| `publicidad-ml` | Product Ads (regla ACOS vs. margen) y evaluación/aceptación de promociones | "cómo va la publicidad", "me conviene esta promoción" |
| `calculadora-ml` | Conversación guiada para calcular comisiones, envío, impuestos y ganancia neta | "cuánto me queda", "a qué precio vender" |
| `descubrir-ganadores-ml` | Qué productos conviene vender: tendencias, competencia, comisión, seguimiento | "qué puedo vender", "productos ganadores" |
| `clips-ml` | Mapa de clips, requisitos técnicos, subida y borrado con confirmación | "subir un video", "me rechazaron el clip" |
| `copiar-publicaciones-ml` | Clona publicaciones propias entre cuentas propias o crea nuevas con categoría predicha | "copiar a la otra cuenta", "crear publicación" |
| `imagenes-ml` | Set fijo de 4 imágenes informativas (beneficio, características, medidas, incluye) con `plantillas/generar.js` | "armar las imágenes", "infografía del producto" |
| `visualizador-publicaciones-ml` | Tablero HTML local con semáforo por publicación para elegir qué arreglar | "ver todo de un vistazo", "armar el visualizador" |

## Rutina sugerida

- Diario: `panel-ventas-ml` y `responder-preguntas-ml`.
- Semanal: `reporte-ventas-ml`, `vigilancia-ml`, `publicidad-ml`.
- Mensual: `mejorar-publicaciones-ml` (o `visualizador-publicaciones-ml` para elegir), `descubrir-ganadores-ml`, `clips-ml`.
- Cuando haga falta: `calculadora-ml`, `competencia-ml`, `copiar-publicaciones-ml`, `imagenes-ml`.

## Cómo cargar los skills

### Claude Desktop
1. Abrir Configuración → Capacidades → Skills.
2. Elegir "Cargar skill" y seleccionar la carpeta del skill (por ejemplo `skills/panel-ventas-ml`), o un archivo comprimido de esa carpeta si la aplicación lo pide.
3. Repetir por cada skill que se quiera usar. El MCP `mercadolibre-sellers-mcp` debe estar configurado en la misma aplicación para que las herramientas `ml_*` existan.

### Claude Code
1. Copiar la carpeta del skill a `.claude/skills/` dentro del proyecto (para usarlo solo ahí) o a `~/.claude/skills/` (para todos los proyectos). Ejemplo: `.claude/skills/panel-ventas-ml/SKILL.md`.
2. Verificar que el MCP esté registrado en la configuración de Claude Code.
3. Invocar el skill por nombre (`/panel-ventas-ml`) o simplemente pedir la tarea con una de las frases de activación.

## Escrituras y modo solo lectura

- El MCP se inicia con `SOLO_LECTURA=true`. En ese modo, las herramientas de escritura (`ml_actualizar_publicacion`, `ml_crear_publicacion`, `ml_responder_pregunta`, `ml_aceptar_promocion`, `ml_subir_clip`, `ml_borrar_clip`) responden con un mensaje explicando que están deshabilitadas.
- Solo el propietario del MCP puede habilitarlas, cambiando `SOLO_LECTURA=false` en la configuración del MCP. Los skills nunca intentan evadir ese bloqueo: lo explican y entregan el trabajo preparado para que el usuario lo aplique a mano si lo prefiere.
- Aun con la escritura habilitada, cada cambio se confirma de a uno en la conversación y la herramienta exige `confirmar=true`.

## Convenciones compartidas

- Nunca inventar datos: toda cifra, ID o estado proviene de una respuesta de herramienta.
- Costo, impuestos y margen objetivo siempre los aporta el usuario; el MCP no los adivina.
- Nada de datos de contacto en respuestas, imágenes o clips: Mercado Libre lo penaliza.
- No copiar fotos ni textos de terceros.
