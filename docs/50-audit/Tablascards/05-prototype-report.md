# 05 · Informe del prototipo (Fase 5)

> Fecha: 2026-10-17 · Rama `spike/entity-view-system` (creada desde `audit/tablascards`), **sin commitear** · Sin cambios en código de producción: solo archivos nuevos en `components/entity-view/` y `features/*/entity-view/`, más la configuración de Storybook (`.storybook/main.ts`, `.storybook/preview.ts`).
> Evidencia: **V** = Verificado (comando u observación real) · **P** = Probable · **Pd** = Pendiente.

## 1. Resumen

- La alternativa C (ADR-0087) **funciona sobre entidades reales**. UoM, Productos, OV (con sus líneas y el despacho editable) y Compras (modos órdenes/notas) se reconstruyeron **sin ningún `computed`, `renderCard` ni columna inline**, con dos extensiones de feature (`docRef` en `features/documents` y `productPrice` en `features/inventory`) que no tocan el núcleo.
- Las configuraciones inválidas **fallan al compilar**: 16 casos probados por tests de tipos (el último exige la etiqueta del hub).
- La prueba de alta con un subagente sin contexto se hizo en **3 archivos, 98 líneas y unos 2 minutos**, con nota 4/5. Destapó un hueco de arquitectura (el registro de extensiones en tiempo de ejecución), ya corregido en el spike (§6).
- La crítica de diseño (`impeccable`, evaluaciones A y B aisladas) encontró problemas de densidad, estados y afordancia. Se corrigieron en el spike los que eran propios. Los heredados (contraste de `StatusBadge`/`Chip`, la regla Fitts global, `EntityCard`, el `-` de `DataCell`) quedan como **prerrequisitos de adopción** (§7).

## 2. Qué se construyó

| Capa | Archivo | Líneas | Rol |
|---|---|---|---|
| Núcleo | `components/entity-view/core/value-kinds.ts` | 100 | Registro abierto de tipos de valor (`interface ValueKinds` + `registerValueKind`) |
| | `core/define-entity.ts` | 290 | `defineEntity<T>()`, constructores tipados, layouts por superficie, `.without()` |
| | `core/formatters.ts` | 100 | Formatters puros (es-CL), únicos para tabla, card, subtítulo y exportación |
| | `core/use-entity-collection.ts` | 140 | Estado headless (TanStack) con paginación cliente/servidor/ninguna |
| | `core/align.ts` | 12 | Alineación semántica compartida |
| | `kinds/core-kinds.tsx` | 190 | Renderers de los 13 tipos del núcleo sobre `DataCell`, `StatusBadge` y `DomainHubStatus` |
| Superficies | `surfaces/Collection.tsx` | 555 | `Collection.Root/Toolbar/View/Table/Grid`, estados, card por slots |
| | `surfaces/EditableCollection.tsx` | 330 | Superficie editable P1/P2 + `editableSchema` (zod) + adaptadores de errores RHF |
| | `surfaces/CollectionModes.tsx` | 40 | Modos tipados (órdenes ↔ notas) sin casts |
| | `surfaces/EntityViewProvider.tsx` | 30 | Punto de arranque: opener (`openEntity`) y etiquetas |
| Guía | `components/entity-view/README.md` | — | Única documentación usada en la prueba de alta |
| Entidades | `features/inventory/entity-view/uom.entity.ts` | 26 | Trivial |
| | `features/inventory/entity-view/product.entity.tsx` | 80 | Extensión `productPrice` + icono por tipo + imagen |
| | `features/sales/entity-view/saleOrder.entity.ts` | 45 | Hub, estado derivado, cuerpo de workflow, exportación (stub) |
| | `features/orders/entity-view/orderLine.entity.ts` | 75 | Líneas con `docRef`, pie de totales, `deliveryLinesEditable` (P1) |
| | `features/purchasing/entity-view/purchaseOrder.entity.ts` | 48 | Facetas como dimensiones (sin columnas ocultas) |
| | `features/billing/entity-view/purchaseInvoice.entity.ts` | 30 | Notas de compra, NC con signo negativo |
| | `features/documents/entity-view/docRef.kind.tsx` | 55 | Extensión de referencia a documento (constructor autoregistrado) |
| Banco de trabajo | 5 archivos de stories, 21 stories | — | Estados loading/empty/error, claro/oscuro, compact/comfortable, matriz de casos límite |

Comando: `wc -l components/entity-view/**/*.ts* features/*/entity-view/*.ts*` (cifras redondeadas tras `/simplify`).

## 3. Métricas frente al sistema actual

### 3.1 Código de presentación por entidad

Líneas no vacías ni de comentario. "Actual" = `*Fields` + bloque `renderCard` + columnas inline de la vista; "Nuevo" = archivo de entidad (incluye extensiones propias) + cuerpo de la vista (≈ 8–10 líneas, ver las stories).

| Entidad | Actual | Nuevo | Escapes actuales | Escapes nuevos |
|---|---|---|---|---|
| UoM | 52 (`uomFields`) + 11 (`renderCard`) + columnas inline (`UoMClientView.tsx:80,:111`) | 21 + ~9 | `renderCard` pass-through, 2 columnas inline, campo `uom_type` duplicado | 0 |
| Productos | 76 + 97 (`renderCard`) + 22 columnas inline | 64 (con la extensión) + ~9 | 2 `computed`, `renderCard`, columna de selección | 0 |
| OV | 96 + 28 (`renderCard`) + 29 (columnas de notas, `SalesOrdersView.tsx:322-350`) | 35 + ~9 | 3 `computed`, `renderCard`, 5 columnas duplicadas, `undefined as unknown as` (TC-018) | 0 |
| Compras | 65 + 48 (`*Fields`) + 46 (`renderCard`) + 125 (columnas inline `:726-860`) | 40 + 23 + ~25 (modos) | 2 `computed`, 3 columnas ocultas para facetas, 6 duplicadas, `renderCard` | 1 cast heredado (`getHubStatuses`) |
| Líneas de OV/OC | 65 (`orderLineFields`) | 62 (incluye P1 editable) | 2 `computed`, 7 `placement: 'detail'`, bug TC-012 | 0 (TC-012 imposible: `.without("work_order_summary")` no compila) |

Comandos: `grep -cvE '^\s*$|^\s*//|^\s*\*'` por archivo; bloques `renderCard` medidos con el script awk de `01` §2.2.

### 3.2 Núcleo, tipado y escapes

| Métrica (§6 del prompt) | Actual | Prototipo | Evidencia |
|---|---|---|---|
| Props del componente de colección | `DataTable` 57 + `DataTableView` 12 · `AutoEntityCard` 22 | `Root` 8 · `Toolbar` 3 · `View` 4 · `EditableCollection` 7 · `CollectionModes` 4 (≤ 12, regla de la Puerta B) | V: `awk '/interface X/,/^}/'` |
| Configuraciones inválidas detectadas en compilación | 0 tests de tipos | **16** (`@ts-expect-error` en `define-entity.types.test.ts`) | V: comprobación por mutación (al volver válida una, `tsc` falla con TS2578) |
| Escapes no tipados en entidades | 51 `computed` + 44 `renderCard` (repo) | 0 en las 6 entidades; 1 cast heredado | V: `grep -rnE "as unknown as\|computed\|renderCard" features/*/entity-view` |
| Casts dentro del núcleo | — | 3 puentes documentados (contexto genérico, registro correlacionado, `splitMeta`) | V; ajuste A7 (§6) |
| Extensiones dentro de la feature | — | 2 (`docRef`, `productPrice`), 0 cambios en el núcleo para añadirlas | V |
| Altura de fila compact | — (sin captura del sistema actual, §8) | **40 px**; cabezal 37 px (antes del arreglo: 57/49 px) | V: `getBoundingClientRect` en `uom-trivial--table` |

### 3.3 Comparación con las pantallas actuales (app de desarrollo, usuario de demo)

Capturas en `evidence/legacy/` (UoM, Productos, OV y Compras; vistas lista y card; 1440 y 390 px). Medido con `playwright-cli` sobre `http://192.168.1.93:3000` (2026-10-17).

| Métrica | UoM | Productos | OV | Compras | Prototipo |
|---|---|---|---|---|---|
| Altura de fila (lista) | 45 px | 45 px | 33 px | 49 px | 40 px (UoM, con badges) |
| Altura de cabecera | 36 px | 36 px | 37 px | 36 px | 37 px |
| `<table>` por tabla | 2 (cabecera y cuerpo partidos) | 2 | 1 | 2 | 1 |
| `th` con `scope` / `aria-sort` | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | todos / en la columna ordenada |
| Filas enfocables por teclado | 0 | 0 | 0 | 0 | celda principal = botón |
| Botones sin nombre accesible | 1 | 1 | 1 | **52** | 0 |
| Inputs sin etiqueta | 1 | 1 | 1 | 1 | 0 |
| Desborde horizontal de página | no | no | no | no | no |

**Defectos visibles del sistema actual** que el prototipo no tiene (V, `evidence/legacy/compras--card.390.png`): en la card de Compras a 390 px el título aparece como "-", las métricas se cortan a la derecha y la paginación muestra **"Página 1 de NaN"** (TC-032).

## 4. Verificación

| Prueba | Resultado | Comando |
|---|---|---|
| Type-check (proyecto completo) | **0 errores** | `npx tsc --noEmit -p tsconfig.json` |
| Lint del spike y Storybook | **limpio** | `npx eslint components/entity-view features/*/entity-view .storybook` |
| Unitarios (jsdom) | **32/32** (formatters, resolución, orden semántico, totales por unidad, esquema editable, semántica de tabla, estados, card, formulario RHF + zod) | `npx vitest run --project '!storybook' components/entity-view` (Node 24 local) |
| Stories como tests (Chromium) | **21/21** (incluye los `play` de UoM y del despacho editable) | `npx vitest run --project storybook components/entity-view features/{inventory,sales,purchasing}/entity-view` |
| a11y de Storybook en modo `error` (corrida diagnóstica) | Antes de los arreglos: `aria-progressbar-name` (propio, **corregido**), checkbox de card sin nombre (heredado de `EntityCard`, **evitado**: el spike usa su propio checkbox etiquetado), `color-contrast` (heredado, §7) | `preview.ts` con `a11y.test: 'error'` temporalmente, revertido |
| Detector `impeccable` (CLI) | **0 hallazgos** | `impeccable detect --json <7 rutas>` |
| Capturas | **42** (21 stories × 1440/390 px), todas renderizadas, **0 desbordes horizontales**, 0 errores de consola salvo un 404 intermitente no atribuible | `evidence/spike/*.png`; script con espera de render |
| Vitest en el servidor remoto | 28/28 en la primera tanda (antes de añadir tests) | `docker compose exec -T frontend npx vitest run components/entity-view` |

**Defectos que encontró la verificación** (todos corregidos en el spike):

| Defecto | Cómo apareció | Corrección |
|---|---|---|
| El atributo nativo `max` del `<input type=number>` bloqueaba el submit: RHF nunca validaba y el usuario veía el globo del navegador | El `play` de la story falló; se reprodujo en jsdom | Sin `min`/`max` nativos; tope como pista visible "Máx. N" vía `aria-describedby`; adaptador `editableErrorsFromForm` (el resolver es la única validación) |
| Totales que sumaban unidades distintas ("705,00" = Hoja + Millar) | Captura | `formatSum` y el pie editable agrupan por opciones (unidad, moneda): "600 Hoja · 5 Millar" |
| `DataCell.Category` sin dominio pinta "-" (tags vacíos) | Captura | Chips neutros cuando no hay dominio |
| La meta en el centro del header aplastaba el título ("Dis", "Pap") | Captura | La meta va debajo del header |
| Grilla de cards con `1fr` que desbordaba a 390 px | Captura (`scrollWidth`) | Columnas `minmax(0,1fr)` |
| Borde superior "suelto" en tablas | Captura + DOM | `overflow-hidden` en el contenedor redondeado |
| UoM 0,001 g mostrada como "0,00" | Captura | Decimales por fila |
| Regresión de `/simplify`: `pagination: undefined` rompía las colecciones sin paginar | Stories | Omitir la clave en lugar de pasar `undefined` |

## 5. Crítica de diseño (`impeccable critique`)

Dos evaluaciones aisladas en subagentes: A (diseño, sin detector) y B (detector + overlay en el navegador). Puntuaciones de A **antes** de los arreglos de esta fase.

### 5.1 Veredicto y heurísticas (A)

**Mayormente específico del producto, con huecos genéricos.** Lo propio de imprenta está en el contenido (totales por unidad, "cantidad a despachar" con motivo "Requiere producción", cabecera canónica, K100). El marco (toolbar, estados, grilla) era un CRUD genérico.

| # | Heurística | Nota | Tras los arreglos |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | Skeleton por columna con la altura real de fila |
| 2 | Lenguaje del mundo real | 3 | "Despachar todo lo pendiente"; "Sin pendiente" |
| 3 | Control y libertad | 2 | "Reintentar" en el estado de error |
| 4 | Consistencia | 2 | Vacío uniforme "—"; "Máx." en pista y error; tags alineados al cabezal |
| 5 | Prevención de errores | 3 | Filas con tope 0 deshabilitadas; el pie excluye celdas inválidas |
| 6 | Reconocer antes que recordar | 2 | Celda principal subrayada en hover/foco. **Pendiente**: hub sin etiquetas |
| 7 | Flexibilidad y eficiencia | 2 | **Pendiente**: navegación por teclado entre filas; recordar la vista elegida |
| 8 | Estética minimalista | 2 | Densidad recuperada (57 → 40 px) |
| 9 | Recuperación de errores | 2 | Copy operativo en lugar de "Error 500"; reintento |
| 10 | Ayuda | n/a | — |
| | **Total** | **20/36** | Sin re-puntuar (requiere otra corrida A) |

### 5.2 Evidencia mecánica (B)

- **CLI:** 0 hallazgos.
- **Overlay en 7 stories:**
  - `undersized-ui-text`: cabeceras de 10 px y etiquetas de card de 9 px. Patrón del sistema de diseño (track B); se registra como alerta de legibilidad para el sistema de diseño.
  - `low-contrast`: chips **warning 1,2–1,3:1** ("Menor", "Dinámico") y **success 2,4–2,7:1** ("Mayor"). Son tokens heredados de `StatusBadge`/`Chip`, no del spike. Los grises de 3,0–3,2:1 corresponden a `muted-foreground` en metadatos.
- **Respaldo:** 0 desbordes de página y 0 errores de consola. Checkboxes de card sin etiqueta (heredado; resuelto en el spike con un checkbox propio).

### 5.3 Prioridades y estado

| Prioridad | Problema | Propiedad | Estado |
|---|---|---|---|
| P1 | Densidad compact incumplida: filas de 57 px por la regla Fitts global (`globals.css:766`) sobre los `Button` de cabecera y celda principal | Spike, disparado por una regla heredada | **Corregido localmente** (`h-7` + margen negativo → 40 px). Corrección de fondo = prerrequisito R3 (§7) |
| P2 | La celda principal no parece enlace y pierde el renderer de su tipo | Spike | **Parcial**: subrayado en hover/foco. El renderer completo dentro del botón no es posible porque `DataCell` renderiza `div` (HTML inválido dentro de `button`) → prerrequisito R1 |
| P3 | Loading con salto de layout; error sin salida y con mensaje crudo; vacío sin distinguir el filtro | Spike | **Corregido** (skeleton por columna, error dentro del marco con reintento, `isFiltered`) |
| P4 | Despacho: input lejos de "Pendiente", tope 0 editable, decimales y forma inconsistentes, pie que sumaba inválidos | Spike | **Corregido** (a–d, f). **Pendiente** (e): a 390 px la primera columna no es fija |
| P5 | Alineación y vacíos inconsistentes; icono de orden mal colocado en columnas numéricas | Spike / heredado | **Corregido** lo propio. Heredado: "$-48.000" en negativos (formatter de `DataCell.Currency`) |
| — | Contraste de chips warning/success | Heredado | Prerrequisito R6 (§7) |
| — | Hub de 3–4 anillos sin texto; vocabulario de estado distinto en tabla (badge) y card (hub) | Decisión de diseño | **Resuelto (Puerta C): hub con etiqueta en ambas superficies**. `hubStatus` exige un `caption: StatusValue` (StatusBadge con texto) seguido de los anillos; su texto también alimenta orden y exportación. Un hub sin etiqueta no compila (test de tipos nº 16). En cards estrechas (consulta de contenedor < 28rem) el hub baja bajo el título para no aplastar el folio |

## 6. Prueba de alta de entidad (subagente sin contexto)

- **Tarea:** dar de alta "Máquina de impresión" (ficticia): tabla de 10 columnas (estado, cantidad con unidad, dinero, progreso, contacto, referencia a OT, fecha), cards con meta, cuerpo de progreso y tono por estado.
- **Material:** solo `components/entity-view/README.md`.
- **Resultado (V):**
  - 3 archivos, 98 líneas, unos 2 minutos.
  - 1 error de compilación: un `CardTone` inexistente ("neutral"), detectado por el tipado.
  - Lint limpio, nota 4/5.
  - Archivos archivados en `evidence/onboarding-probe/` y retirados del árbol.

**Dudas (orden cronológico):**
1. Los valores de `CardTone` no estaban en la guía.
2. `docRef` compilaba pero **solo se registraba en las stories**: en la app habría fallado en tiempo de ejecución, y la única vía era un import profundo entre features (invariante #3).
3. El `EntityViewProvider` no aparecía en la guía. Sin él, la celda principal no abre nada.
4. No se explicaba el icono por defecto para una etiqueta no registrada.

**Ajustes aplicados por la prueba:**

| ID | Ajuste | Estado |
|---|---|---|
| A1 | **Las extensiones exportan un constructor que registra su tipo al usarse** (`docRef(f, …)`; la entidad de producto registra el suyo al cargarse). Ya no hace falta un arranque en ejecución para los tipos, y desde otra feature se importa por **barrel** | Hecho en el spike. Exportar desde `@/features/documents` al adoptar (el spike no toca barrels) |
| A2 | `label` debe ser una **unión tipada** de las etiquetas del `entity-registry`, no `string` (hoy compila una etiqueta inexistente sin icono, drawer ni URL) | Pd: requiere `ENTITY_REGISTRY` `as const satisfies …` (Fase 6) |
| A3 | Guía completada: `CardTone`, provider, icono por defecto, campos opcionales de la fuente, patrón de constructor de extensión | Hecho |

## 7. Ajustes a la arquitectura y prerrequisitos de adopción

De la revisión de altitud (`/simplify`) y de la crítica: el spike evita estos defectos **localmente**. La adopción debe corregirlos en su origen para poder borrar los parches.

| ID | Prerrequisito | Dónde | Parche del spike que elimina |
|---|---|---|---|
| R1 | Prop `align` en `DataCell` (defecto semántico por variante) y opción de render en línea (`span`) para usarlo dentro de un botón | `components/shared/DataTableCells.tsx` (contrato `component-contracts.md#datacell-primitives`) | `ALIGN_FLEX` por llamada; texto plano en la celda principal |
| R2 | Marcador de vacío único "—" en tono secundario en `DataCell` (prop `empty` o constante) | `DataTableCells.tsx` | `EmptyCell` en cada tipo |
| R3 | Escape explícito y legítimo de la regla Fitts para superficies densas (`data-density="compact"` o variante `Button size="inline"`) | `app/globals.css:766-769`, `components/ui/button.tsx` | `h-7` y margen negativo |
| R4 | `EntityCard`: `selectionLabel` en su checkbox y slot `EntityCard.Meta` bajo el header | `components/shared/EntityCard.tsx` | Checkbox propio en `actions`; `CardMeta` propio |
| R5 | `getHubStatuses` tipado contra una interfaz estructural mínima | `lib/workflow-status.ts` | Cast en `purchaseOrder.entity.ts:11` (y los equivalentes del sistema actual) |
| R6 | Contraste de los intents warning/success en `StatusBadge`/`Chip` (1,2:1 y 2,5:1 medidos) | Tokens de color (`globals.css`, `color-system.md`) — **requiere ADR de color** | — |
| R7 | Contexto tipado (`createCollectionContext<T>()`) y registro sin cast correlacionado | `components/entity-view` | 3 casts internos |
| R8 | Etiqueta de entidad tipada (A2) | `lib/entity-registry.ts` | — |

**Mejoras de rendimiento** (revisión de eficiencia; no medidas, P):
- fila memoizada en tablas y en la superficie editable (hoy cada pulsación re-renderiza ≤ 50 filas);
- contexto y colección memoizados;
- `accessorFn` barato con `sortingFn` semántico solo en la columna ordenada.

Con los tamaños medidos (páginas de 20–100 filas) no son urgentes. Entran en la línea base PF-6 de la Fase 6.

## 8. Pendiente y fuera del spike

| Pendiente | Motivo |
|---|---|
| Sincronización con la URL (vista, orden, página; ADR-0022) y conexión con `UnifiedSearchBar` | El spike usa estado local; `facets` está declarado y no se consume |
| Exportación real | Stub en la OV; **Pd-backend**: no existe `/export/` de listas |
| Kanban/timeline de OT | No prototipado (caso específico; el diseño lo resuelve como superficie registrable) |
| Primera columna fija a 390 px en la superficie editable; navegación por teclado entre filas; recordar la vista elegida | Hallazgos de la crítica no abordados |
| Story tests en el servidor remoto | El contenedor no tiene el Chromium de Playwright; se ejecutan en local con Node 24 |
| Re-puntuación de la crítica tras los arreglos | Requiere otra corrida A |

## 9. Puerta C (2026-10-17): aprobada

1. Prototipo validado: ADR-0087 → *Accepted* con A1–A3 y R1–R8; ADR-0078 → *Superseded*.
2. R1–R5 forman el primer lote de la Fase 7; R6 (contraste) va como ADR de color aparte.
3. Vocabulario de estado unificado: **hub con etiqueta** en tabla y card (implementado, §5.3).
4. Comparación con las pantallas actuales hecha con el usuario de demo (§3.3). Las credenciales no quedaron en ningún archivo.
5. El spike se commitea en `spike/entity-view-system`.

### Preguntas que se hicieron

1. ¿Validas el prototipo y pasas ADR-0087 a *Accepted* (y ADR-0078 a *Superseded*), incorporando A1–A3 y los prerrequisitos R1–R8?
2. ¿R1–R5 (cambios en `DataCell`, `EntityCard`, regla Fitts y `getHubStatuses`) entran como **primer lote de la Fase 7**, antes de migrar entidades? ¿Y R6 (contraste) como ADR de color aparte?
3. Vocabulario de estado: la tabla usa un badge legible (`stageSummary`) y la card el hub de anillos. ¿Se unifica (hub con etiqueta o badge en ambas) o se mantiene la diferencia?
4. ¿Me das credenciales de un usuario de demo para capturar las pantallas actuales y completar la comparación del §8?
5. ¿Commiteo el spike en `spike/entity-view-system`?
