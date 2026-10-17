# Misión: auditar el sistema actual y diseñar un nuevo sistema de construcción de tablas, celdas y cards

> **Versión adaptada a ERPGrafico** del prompt genérico `tablascards.md` (se conserva como referencia).
> Destinatario: un agente de IA (Claude Code u otro) trabajando en sesiones sucesivas.
> Raíz: `/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico` · Entregables: `docs/50-audit/Tablascards/`

## Propósito

El sistema actual (`DataTable` + `createEntityFields` + `AutoEntityCard` + `DataCell`) **es demasiado rígido**: cuando una entidad necesita algo que el esquema no prevé, la salida es escribir JSX a mano (`renderCard`, columnas `computed`, tablas paralelas), y cada salida es deuda.

**El objetivo no es mejorar el sistema actual, sino reemplazarlo** por un sistema de construcción **modular, componible y extensible por entidad**, que:

- cubra con cero código a medida los casos comunes;
- permita que cada entidad **extienda** (nuevos tipos de valor, renderers, layouts de card, columnas especiales) **sin modificar el núcleo compartido ni recurrir a escapes no tipados**;
- comparta la semántica de los campos entre superficies (tabla, card, kanban, detalle) sin forzarlas a compartir layout;
- se pueda adoptar de forma gradual (coexistencia con el sistema actual y migración entidad por entidad).

La auditoría existe para **obtener los requisitos reales y entender por qué el diseño actual es rígido**, no para producir una lista de arreglos.

**Principio rector:** entender las necesidades reales → diagnosticar las causas de la rigidez → diseñar desde los requisitos → demostrar con prototipos sobre entidades reales → migrar de forma incremental.

---

## 0. Protocolo de sesión (léelo siempre primero)

1. **Al iniciar cada sesión**, lee: `PROGRESS.md` (créalo en la Fase 0 con la plantilla del §8), `ledger.md` (decisiones y hallazgos) y solo los entregables de la fase en curso y de la anterior.
2. **Una fase (o subfase) por sesión.** Antes de terminar o de quedarte sin contexto, actualiza `PROGRESS.md` con el último paso completado, el próximo paso exacto y las preguntas abiertas.
3. **Puertas humanas (STOP obligatorio):** detente, resume y espera aprobación explícita.
   - **Puerta A**: requisitos y diagnóstico de rigidez (fin de la Fase 3).
   - **Puerta B**: arquitectura elegida (fin de la Fase 4).
   - **Puerta C**: prototipo validado y ADRs aceptados (fin de la Fase 5). Hasta aquí **no se modifica código de producción**.
   - **Puerta D**: antes de cada lote de migración (Fase 7).
4. **Delegación:** los barridos amplios (≥10 archivos, clasificar consumidores) se delegan en un subagente `Explore` con `effort: "lower"`, pidiendo conclusiones y rutas `archivo:línea`. Los archivos núcleo los lees tú (`DataTable.tsx`, `DataTableCells.tsx`, `entity-fields.tsx`, `AutoEntityCard.tsx`, `EntityCard.tsx`, `entity-registry.ts`).
5. **Reproducibilidad:** cada cifra va con el comando que la produce.
6. **Evidencia:** clasifica las afirmaciones como **Verificado** (`archivo:línea` o salida real), **Probable**, **Pendiente** o **Decisión propuesta**. Nunca afirmes que un test corrió si no lo ejecutaste.

---

## 1. Rol

Staff Frontend Engineer y arquitecto de design system para un ERP de imprenta (Next.js 16 App Router, TypeScript estricto, Tailwind 4 con `@theme` inline, Shadcn UI, TanStack Query y Table, Zod). Diseñas APIs de componentes que otros (humanos y agentes) usarán a diario para dar de alta entidades nuevas.

---

## 2. Sistema actual (punto de partida al 2026-10-16; re-verificar en la Fase 0)

| Pieza | Implementación | Señales de rigidez (hipótesis, *Probable*) |
|---|---|---|
| Tabla | Familia `DataTable` en `components/shared/` (`DataTable.tsx` ~1000 líneas y **56 props**, más `DataTableView`, `Toolbar`, `Pagination`, `ColumnHeader`, `ColumnToggle`, `FacetedFilter`, `ExpandHeader`), primitiva `ui/table.tsx` | Componente monolítico configurado por props: cada necesidad nueva añade otra prop. Tablas paralelas (`ReportTable`, `FormLineItemsTable`, `AccountingLinesTable`, `RelatedDocumentsTable`, unas 20 tablas directas en features) porque el componente no se deja componer. |
| Esquema de campos | `createEntityFields<T>()` en `entity-fields.tsx` (~1200 líneas), unos 25 archivos `*Fields.ts` | **Unión cerrada** de `FieldType` (`text, secondary, code, contact, currency, date, number, status, chip, computed`) resuelta con un `switch` en `renderCell`: un tipo nuevo obliga a tocar el núcleo. `computed` es *"the sole escape hatch"*, es decir, JSX libre sin semántica. `placement` (`title/subtitle/header/detail`) **gobierna a la vez el layout de la card y el orden de las columnas** (ADR-0057/0059): acopla superficies distintas. Superficies fijas `table/card/kanban`. Subtítulo automático por heurística de roles (hasta 4 huecos). |
| Card | `AutoEntityCard.tsx` (~470 líneas) sobre el shell `EntityCard.tsx` (~700 líneas) | Layout por zonas fijas. **43 archivos siguen usando `renderCard` manual** porque las zonas no cubren su caso. |
| Celda | Namespace `DataCell` en `DataTableCells.tsx` (~1000 líneas): `Text, Secondary, Code, Entity, ContactLink, Link, Number, Currency, CurrencyFlow, Variance, NumericFlow, Progress, Date, Status, Chip, Category, Icon, Action, ActionGroup, ActionSingle, ActionMenu, SourceDest, WorkflowSummary` y factories `createXColumn` | Registro cerrado: varios renderers no son alcanzables desde `*Fields.ts` y solo se usan directamente. Mezcla formato, presentación y acciones. |
| Política de vistas | `lib/entity-registry.ts` (`viewPolicy`, etiquetas, rutas) | Otra fuente de verdad paralela a `*Fields.ts`. |

Cifras orientativas, a re-medir: 47 archivos con `AutoEntityCard`, 57 con `toColumns()`, 43 con `renderCard` manual y, según ADR-0078, más de 139 consumidores de la familia `DataTable`.

### 2.1. Trabajo previo: evidencia, no restricción

| Documento | Cómo usarlo |
|---|---|
| ADRs 0054–0069 (`entity-fields`, placement, cards, DataCell, badges) | Explican **por qué** el sistema es como es. Extrae las necesidades legítimas que resolvían; el nuevo sistema debe seguir cubriéndolas aunque cambie la forma. |
| ADR-0078 (separación de la familia `DataTable` detrás de una fachada; *Proposed*, en espera) | Es una alternativa de *mejora*. Evalúala en la Fase 4 frente a un rediseño y, si procede, márcala como *Superseded* por el nuevo ADR. |
| `docs/50-audit/frontend-design-review-datatable-cards.md` + `track-b-resolution-decisions.md` | Decisiones **visuales** ya validadas (cabecera canónica, tokens de densidad `--table-*`, hover único, ARIA del grid). El nuevo sistema las **hereda**: no se vuelven a discutir. |
| `docs/50-audit/design-system-ui-audit.md` | Contexto de duplicados y oleadas previas. |
| `frontend/audit-views.md` | Inventario de vistas, **probablemente obsoleto** (cita `createDomainCardView`, que ya no existe). Genéralo de nuevo. |

### 2.2. Qué se conserva y qué puede cambiar

**Se conserva (restricciones duras):**
- Invariantes de `CLAUDE.md` #1–#12: zero `any`, solo tokens semánticos, imports por barrel, sin `@/lib/api` ni `useQuery` en componentes, `StatusBadge` como único renderer de estado, loading/empty/error en los componentes compartidos, sufijos de nombre, ADR para cualquier cambio de contrato.
- Identidad visual: `DESIGN.md`, `frontend/app/globals.css` y las decisiones visuales del §2.1. El nuevo sistema cambia **cómo se construyen** tablas y cards, no la estética.
- Comportamiento funcional existente: URL como fuente de verdad de filtros, orden y página (ADR-0022); paginación en servidor con `rowCount`; registro de filas expandibles (ADR-0023); acciones de fila; navegación a la ficha con `openEntity` (ADR-0028/0086); acciones masivas.
- Guardas existentes: tests de contrato en `frontend/lib/__tests__/` y reglas ESLint en `frontend/eslint-rules/`. Se adaptan con justificación, no se borran.

**Puede cambiar (vía ADR):** la invariante #13 (`*Fields.ts` + `toColumns()`), los contratos `component-fields.md`, `component-datatable-views.md`, `component-card.md` y `component-contracts.md#datacell-primitives`, los ADRs 0054–0069 y 0078 (pasan a *Superseded* donde corresponda), la API pública de `DataTable`/`AutoEntityCard`/`DataCell` (con una estrategia de coexistencia) y el playbook `add-feature.md`.

---

## 3. Alcance

**Dentro:** construcción de colecciones (tabla, card grid, kanban, listas embebidas en drawers o fichas), celdas y valores, cards de entidad, esquema de campos, extensibilidad por entidad, estados, acciones, accesibilidad, rendimiento y la estrategia de migración.

**Fuera:** formularios y wizards (salvo clasificar `FormLineItemsTable`), navegación global, dashboards y KPI, backend. Si un requisito depende del serializer (campos ausentes, N+1, paginación), regístralo como *Pendiente-backend* sin resolverlo.

---

## 4. Fases

### PARTE I · Descubrimiento (sin cambios de código)

#### FASE 0 · Mapa y delta

1. Re-medir el §2 con comandos reproducibles: props de `DataTableProps`, miembros de `DataCell`, `FieldType`, consumidores de cada pieza, `renderCard`, columnas `computed`, tablas directas fuera de shared, `*Fields.ts` frente a entidades con vista de lista.
2. Inventario de consumidores (subagente `Explore`): archivo · entidad · superficies · usa `toColumns` · usa `AutoEntityCard` · `renderCard` manual · nº de `computed` · tabla paralela.
3. Entorno: Node local es **v18.19.1**, así que vitest no corre en local. Los tests se ejecutan en el servidor de desarrollo (`docs/30-playbooks/remote-dev-server.md`; antes comprobar `mutagen sync list` y, si no conecta, avisar y parar). La app está en `http://192.168.1.93:3000`.
4. Seleccionar **8–10 pantallas representativas**, incluyendo obligatoriamente las de **mayor rigidez** (más `computed`/`renderCard`), una trivial (catálogo simple, p. ej. UoM), una documental (factura u OV con ficha) y una específica de imprenta (OT, BOM o producción).

Entregable: `00-system-map.md` (+ `PROGRESS.md`, `ledger.md`).

#### FASE 1 · Forense de la rigidez

Para **cada escape** del sistema actual (`renderCard` manual, campo `computed`, columna inline, tabla paralela, prop añadida para un solo consumidor, override de className o condicional por entidad), registra:

| Campo | Pregunta |
|---|---|
| Escape | `archivo:línea`, tipo de escape |
| Necesidad | ¿Qué quería mostrar o hacer la entidad? (en términos de producto, no de código) |
| Restricción que lo impidió | ¿Qué parte del diseño actual lo bloqueó? (unión cerrada de tipos, zonas fijas, placement acoplado, falta de slot, prop inexistente, formato no parametrizable…) |
| Coste | Líneas duplicadas, inconsistencias visuales o funcionales que introduce |

Después, **agrupa los escapes por restricción raíz**. El resultado es una lista corta (probablemente 5–10) de **causas estructurales de rigidez**, cada una con su número de escapes y entidades afectadas. Ese es el diagnóstico central.

También documenta qué funciona bien y debe preservarse (p. ej. declarar los campos una vez, coherencia de formato, ordenamiento automático), para no perderlo en el rediseño.

Entregable: `01-rigidity-forensics.md`.

#### FASE 2 · Catálogo de necesidades por entidad

Para cada entidad con vista de colección (no solo las representativas; usa `Explore` para el barrido), una ficha compacta:

- **Superficies que usa o necesita:** tabla (densidades), card grid, kanban, lista embebida, fila expandida.
- **Tipos de valor:** dinero (moneda, decimales, flujo entrada/salida), cantidades con UoM, fechas y rangos, estados, referencias a otras entidades o documentos, contactos, imágenes o miniaturas, progreso, colores o CMYK, listas o etiquetas, valores compuestos.
- **Layout de card:** qué destaca, qué agrupa, qué necesita y las zonas actuales no dan.
- **Interacciones:** clic a ficha o drawer, acciones de fila o masivas, expansión, edición inline, selección.
- **Comportamiento de colección:** agrupación, totales o pie, filtros facetados, columnas opcionales, orden por defecto.
- **Particularidades de dominio de imprenta** que no encajan en un CRUD genérico.

Luego, una **matriz de requisitos agregada**: requisito → nº de entidades → ¿lo cubre hoy el sistema? (sí / con escape / no). Separa requisitos **comunes** (deben salir sin configuración), **frecuentes** (configuración declarativa) y **específicos** (extensión por entidad).

Entregable: `02-entity-needs.md`.

#### FASE 3 · Restricciones no funcionales y referencias

- Accesibilidad: tabla semántica frente a grid ARIA, teclado, `aria-sort`, estados no solo por color (`web-design-guidelines`).
- Rendimiento: tamaño típico de las listas, si hace falta virtualización, coste de re-render de celdas.
- Tipado: qué garantías debe dar TypeScript (claves de campo válidas, renderer compatible con el tipo del valor, configuración inválida rechazada en compilación).
- Referencias de diseño de APIs (breve y aplicado a este proyecto, sin copiar librerías): TanStack Table como núcleo headless (ya está en el proyecto), compound components y slots, registros de renderers abiertos (module augmentation de TypeScript), separación formato/presentación (formatters puros + renderers), patrones de "view definitions" de ERPs (Odoo, ERPNext: list/kanban/form views declarativas por entidad).

Entregable: `03-constraints-and-references.md`.

**→ PUERTA A.** Presenta las causas de rigidez, la matriz de requisitos (comunes / frecuentes / específicos) y lo que debe preservarse. Espera aprobación o correcciones del usuario sobre los requisitos.

### PARTE II · Diseño

#### FASE 4 · Arquitectura objetivo

1. **Principios** derivados de los requisitos aprobados. Hipótesis de partida, a confirmar o descartar con evidencia:
   - **Capas separadas:** *semántica del campo* (qué es el dato: dinero, fecha, referencia…) → *formato* (funciones puras, testeables, compartidas) → *renderer* (componente, elegido por tipo y superficie) → *layout de superficie* (tabla, card, kanban; cada uno con sus propias reglas de composición).
   - **Abierto a extensión, cerrado a modificación:** una entidad puede registrar un tipo de valor, un renderer o un layout de card propio **sin tocar shared**, con tipado completo (sin `computed` opaco).
   - **Composición antes que configuración:** núcleos pequeños más slots o subcomponentes, en lugar de componentes con decenas de props.
   - **Defaults sin configuración, escapes locales y tipados:** el caso común no escribe nada; el caso raro escribe solo su diferencia.
   - **La semántica se comparte entre superficies; el layout no.** El orden de columnas y la composición de la card se declaran por separado (rompe el acoplamiento de `placement`).
   - **Una sola fuente de verdad por entidad** (integrar o eliminar la duplicación con `entity-registry.ts`).
2. **2–3 alternativas reales** (p. ej. A: esquema declarativo abierto con registro de tipos y renderers; B: composición headless con componentes por entidad sobre primitivas compartidas; C: híbrido con esquema para lo común y composición para lo específico). Para cada una: API de ejemplo **con código TS real para 3 entidades del catálogo** (una trivial, una documental y la de mayor rigidez), cómo se resuelve cada causa de rigidez de la Fase 1, coste de migración, riesgos y curva de aprendizaje para un agente que da de alta una entidad.
3. **Matriz de decisión** con criterios ponderados: cobertura de requisitos sin escapes, extensibilidad sin tocar el núcleo, seguridad de tipos, coherencia de formato, coste de migración, rendimiento, simplicidad de la API y facilidad de verificación mecánica.
4. Evaluar explícitamente ADR-0078 como alternativa "mejorar en lugar de reemplazar".

Skills: `archify` para diagramas de capas y flujo de datos de cada alternativa · `impeccable` para diseñar los **layouts de card y los templates de superficie** a partir de las necesidades de la Fase 2 (lee `DESIGN.md`, refina sin cambiar la identidad) · subagente `Plan` opcional para contrastar una alternativa de forma independiente.

Entregable: `04-architecture-options.md` + borrador de ADR (siguiente número libre en `docs/10-architecture/adr/`; el último es 0086) en estado *Proposed*.

**→ PUERTA B.** El usuario elige la alternativa.

#### FASE 5 · Prototipo (spike) aislado

Objetivo: demostrar la arquitectura elegida con entidades reales **sin tocar producción**.

1. Implementa el núcleo mínimo en un **namespace nuevo y aislado** (ubicación y nombre propuestos en la Fase 4, p. ej. `components/entity-view/`, con su propio barrel), en una rama `spike/entity-view-system`.
2. Reconstruye con él **3–4 entidades del catálogo**: la trivial, la documental y las **dos de mayor rigidez**. Al menos una debe ejercitar una extensión por entidad (tipo, renderer o layout propio) sin tocar el núcleo.
3. Usa **Storybook** (ya instalado: `@storybook/nextjs-vite` + `addon-a11y` + `addon-vitest`) como banco de trabajo: stories por renderer y por superficie, con estados loading/empty/error/null, light/dark y densidades.
4. Mide frente al sistema actual: líneas de presentación por entidad, nº de escapes necesarios, props del núcleo, errores de tipo detectados en compilación ante configuraciones inválidas.
5. Comparación visual y funcional: `playwright-cli` sobre las pantallas actuales y las stories del prototipo (capturas en 1440 y 390 px, árbol de accesibilidad, teclado). Guarda la evidencia en `docs/50-audit/Tablascards/evidence/`.
6. **Prueba de alta de entidad:** un subagente sin contexto previo, con solo la guía del prototipo, da de alta una entidad nueva ficticia. Registra cuántos archivos tocó, qué dudas tuvo y si necesitó escapes. Es la prueba directa del objetivo de mantenibilidad.

Skills: `frontend-ui-engineering` (implementación) · `impeccable` `critique` y `audit` sobre las capturas · `frontend-design-review` (evaluación por pilares, comparable con la auditoría previa) · `/simplify` sobre el código del spike.

Entregable: `05-prototype-report.md` (métricas, capturas, resultado de la prueba de alta, ajustes a la arquitectura).

**→ PUERTA C.** El usuario valida el prototipo y los ADRs pasan a *Accepted* (marcando los que quedan *Superseded*).

#### FASE 6 · Especificación y contratos

`06-spec.md`, con una sección por capa: API pública con tipos, registro de extensiones, reglas de resolución deterministas (qué renderer y qué formato se aplica dados el campo, la superficie y los overrides), estados, accesibilidad y ejemplos completos para 3 entidades.

Documentación que se crea o actualiza:
- Nuevo contrato de capa 20 que sustituye a `component-fields.md`, `component-card.md` y `component-datatable-views.md` (o los reescribe), y su entrada en `component-decision-tree.md`.
- Playbook nuevo o actualizado: **"dar de alta la presentación de una entidad"** (`add-feature.md`).
- Nueva redacción de la invariante #13 sincronizada en `CLAUDE.md`, `docs/README.md` y `GOVERNANCE.md`.
- **Guardas mecánicas** del nuevo sistema: reglas ESLint o tests de contrato que impidan reintroducir la rigidez o la fragmentación. Por ejemplo: prohibir formatear dinero o fechas fuera de los formatters, prohibir tablas `<table>` ad hoc en features, prohibir importar el sistema antiguo desde código migrado.

### PARTE III · Adopción

#### FASE 7 · Migración incremental (strangler)

- **Coexistencia:** el sistema antiguo sigue funcionando. Decide (y documenta) si hace falta un adaptador `*Fields.ts` → nuevo esquema para migrar en bloque las entidades simples, o si se migra a mano.
- **Orden:** primero las entidades con más escapes (mayor beneficio), en **lotes de ≤5 entidades** agrupadas por causa de rigidez; luego las simples (con adaptador o codemod).
- **Ciclo por lote:** rama propia (sin tocar los cambios sin commitear de otras ramas) → migrar → `npm run type-check` + `npm run lint` + tests del ámbito (en el servidor remoto) → capturas antes/después con `playwright-cli` → `/simplify` y `/code-review` (nivel medium) sobre el diff → actualizar `07-migration-matrix.md` → **Puerta D** para el siguiente lote.
- **Retirada:** el sistema antiguo se elimina solo cuando no queda ningún consumidor (precedente: ADR-0072), adaptando los tests de contrato que fijan rutas (`semantic-ink.test.ts` fija `DataTableCells.tsx`).
- Commits solo cuando el usuario lo pida (convención del repo: `refactor(shared): ...` en español, con `Co-Authored-By`).

Entregable: `07-migration-matrix.md` (entidad · pantalla · antes · después · extensiones usadas · diferencias · tests · resultado · deuda).

#### FASE 8 · Validación

- **Unidad (vitest):** formatters (nulo, 0, `false`, `''`, fechas inválidas, monedas y decimales), resolución determinista de renderers, registro de extensiones, tipado (tests de tipos con `expectTypeOf` para configuraciones inválidas).
- **Contrato:** recorrer todas las definiciones de entidad y verificar que un mismo campo usa el mismo formato en todas sus superficies.
- **E2E (Playwright, `frontend/e2e/`):** nuevo `entity-view-system.spec.ts` sobre las pantallas representativas: cambio de vista lista↔card conservando datos y formato, orden y paginación reflejados en la URL, teclado y árbol de accesibilidad. Generarlo con `playwright-cli`.
- **Storybook:** las stories del prototipo pasan a ser la documentación viva y la matriz de regresión visual y de accesibilidad.

Entregable: `08-validation.md` con salidas reales de comandos.

#### FASE 9 · Informe de cierre

`09-final-report.md`: estado inicial, causas de rigidez, arquitectura adoptada y por qué, métricas antes/después (líneas de presentación por entidad, escapes, props del núcleo, nº de implementaciones de tabla), entidades migradas, pruebas reales, deuda y riesgos pendientes, guía de alta de entidad y guardas que impiden volver a la rigidez.

---

## 5. Antiobjetivos (lo que el nuevo sistema NO debe ser)

- Un mega-componente configurable por props: el problema de los 56 props reaparecería.
- Un esquema "universal" donde cada caso nuevo añade un tipo al núcleo: es la unión cerrada actual con otro nombre.
- Magia de introspección en runtime: los campos no se infieren de los datos.
- Un escape opaco (equivalente a `computed`) como vía principal para resolver lo específico.
- Un sistema que obliga a migrar todo de golpe.
- Un cambio de estética: la identidad visual se hereda.

## 6. Métricas de éxito (medir en la Fase 5 y la Fase 9)

- % de entidades con presentación **sin código a medida** (objetivo a fijar en la Puerta B).
- Escapes no tipados restantes: objetivo ≈ 0.
- Las extensiones por entidad viven en la feature de la entidad, no en shared.
- Nº de implementaciones de tabla distintas en el repo.
- Props del componente núcleo de colección.
- Resultado de la prueba de alta de entidad (archivos tocados, escapes, dudas).
- Configuraciones inválidas detectadas en compilación.

## 7. Skills y herramientas

| Tarea | Herramienta | Fase |
|---|---|---|
| Barridos de consumidores y fichas de entidad | Subagente `Explore` (`effort: lower`) | 0, 1, 2 |
| A11y y semántica | `web-design-guidelines` | 3, 5 |
| Diagramas de arquitectura y alternativas | `archify` | 4 |
| Diseño de layouts de card y templates de superficie | `impeccable` (refinar dentro de `DESIGN.md`) | 4, 5 |
| Contraste independiente de alternativas | Subagente `Plan` (opcional) | 4 |
| Implementación del núcleo y del prototipo | `frontend-ui-engineering` | 5, 7 |
| Banco de trabajo y documentación viva | Storybook (`npm run storybook`) | 5, 8 |
| Verificación en navegador (capturas, teclado, árbol a11y, E2E) | `playwright-cli` (alternativa: `claude-in-chrome`) | 5, 7, 8 |
| Crítica visual y por pilares | `impeccable` (`critique`, `audit`), `frontend-design-review` | 5, 7 |
| Revisión de cada lote | `/simplify`, `/code-review` | 5, 7 |
| Dependencias del serializer (solo registrar) | `django-expert` | si aparece *Pendiente-backend* |
| **No usar** | `design-taste-frontend` (es para landings, no para UI de aplicación) | — |

## 8. Formatos

**`PROGRESS.md`**
```markdown
# Progreso — Nuevo sistema de presentación
- Fase actual: 1 · Subpaso: agrupar escapes por restricción raíz
- Último completado: registro de 43 renderCard (01-rigidity-forensics §2)
- Próximo paso exacto: clasificar columnas computed de features/billing
- Puertas: A ☐ · B ☐ · C ☐ · D (lotes) —
- Preguntas abiertas para el usuario: …
- Entorno: mutagen ✅/❌ · tests remotos ✅/❌ · Node local v18.19.1
- Bitácora: 2026-10-16 F0 iniciada …
```

**`ledger.md`**: un registro por hallazgo o decisión (el ejemplo es ilustrativo; sus datos no están verificados):
```markdown
### TC-012 · Rigidez · Verificado
- Evidencia: `<archivo>:<línea>` renderCard manual + comando que lo demuestra
- Necesidad: <qué quería mostrar la entidad, en términos de producto>
- Restricción raíz: R3 — zonas de card fijas sin slot de contenido estructurado
- Entidades afectadas: <lista>
- Decisión vinculada: ADR-00xx §Layouts de card
- Estado: pendiente | en análisis | aprobado | implementado | validado | bloqueado
```

## 9. Primera ejecución

Ejecuta la **Fase 0** y empieza la **Fase 1** si queda contexto. No modifiques código. Crea `PROGRESS.md`, `ledger.md` y `00-system-map.md`. Termina con: qué del §2 se confirmó o cambió, las pantallas representativas elegidas y una primera lista tentativa de causas de rigidez para validar en la Fase 1.
