# 07 · Matriz de migración (Fase 7)

> Rama del lote 1: `refactor/entity-view-lote-1`, creada desde `master` (61c60515b, tras el merge del spike) · Evidencia: **V** = Verificado · **P** = Probable · **Pd** = Pendiente.
> Ciclo por lote:
> 1. migrar;
> 2. `npm run type-check` + `npm run lint` + tests del ámbito;
> 3. capturas antes/después con `playwright-cli`;
> 4. `/simplify` y `/code-review medium` sobre el diff;
> 5. actualizar esta matriz;
> 6. Puerta D del lote siguiente.

## 1. Estado de los lotes

| Lote | Contenido | Estado |
|---|---|---|
| 1 | Prerrequisitos R1–R5 + R7 + R8 + `EntityViewProvider` en el shell + paridad de URL | **completado (2026-10-17)** |
| 2a | Capacidades + UoM + Productos (+ orden en servidor de productos, TC-041) | **completado (2026-10-17)**, §3.6 |
| 2b | OV (+ orden en servidor, foco del hub, endpoint de analítica de OV) | **completado (2026-10-17)**, §3.8 |
| 2c | Compras (+ TC-043, TC-032) | **completado (2026-10-18)**, §3.10 |
| 3a | Líneas de la ficha + DeliveryDrawer + ReceiptModal | **completado (2026-10-18)**, §5.7 · commit `7ef87d7a7` · TC-059 aplazado |
| 3b | Asistentes Step3, Step4, Step2 + NoteLogisticsModal | **congelado (2026-10-18)** → oleada E, §6 |
| 3c | Step1 + NoteStep_LineItems + líneas de movimientos | **congelado (2026-10-18)**: las líneas de solo lectura pasan a la oleada D y la edición a la oleada E, §6 |
| 0 | Habilitadores de la migración masiva: `fromLegacyFields()`, ratchet de consumidores antiguos, métrica de avance | **aprobado (2026-10-18)**, §6.3 |
| A–E | Oleadas por causa de rigidez (82 contextos → 0 consumidores del sistema antiguo) | **aprobado (2026-10-18)**, §6 · Puerta D por oleada (M4) |
| R6 | ADR de color (contraste warning/success) | aparte |

> **Avance (2026-10-18):** 7 entidades con `defineEntity`, unos 10 de 82 contextos migrados (~12 %). Quedan **84** archivos de pantalla en el sistema antiguo, 60 `*Fields`, 55 `toColumns`, 43 `AutoEntityCard`, 40 `renderCard` y 45 `computed`. Comando en §6.1.

## 2. Lote 1: plan (Puerta D)

El lote 1 **no migra entidades**: corrige en su origen los defectos que el spike esquivaba con parches locales (`05` §7). Así, el lote 2 migra sobre primitivas sanas y se pueden borrar los parches.

| ID | Cambio | Archivos | Impacto medido (V) | Riesgo / decisión | Parche del spike que elimina |
|---|---|---|---|---|---|
| R1 | `DataCell`: prop `align?: "start" \| "center" \| "end"` y render en línea (`as="span"`) | `components/shared/DataTableCells.tsx` (1 003 líneas) | 103 archivos usan `DataCell.*`. **El defecto actual se conserva** (centrado salvo los numéricos), así que no hay cambio visual en el sistema antiguo | Bajo: aditivo | `ALIGN_FLEX` por llamada (`core/align.ts`, `kinds/core-kinds.tsx`); texto plano en la celda principal |
| R2 | Marcador único de vacío "—" en tono secundario | ídem | 8 apariciones de `"-"` en `DataTableCells.tsx`. **Cambio visual global**: todas las tablas antiguas pasan de "-" a "—" | **Decisión 1** | `EmptyCell` en cada kind |
| R3 | Escape de la regla Fitts para superficies densas | `app/globals.css:766-769` (`button:not(.h-7)… { min-height: 2.5rem }`) | Choca con **GOVERNANCE #17** (mínimo `h-10`) | **Decisión 2** | `h-7` y margen negativo en la celda principal y la cabecera |
| R4 | `EntityCard`: `selectionLabel?` en su checkbox (por defecto "Seleccionar") y slot `EntityCard.Meta` | `components/shared/EntityCard.tsx` | 12 archivos usan `EntityCard`; los dos cambios son aditivos | Bajo | checkbox propio en `actions`; `CardMeta` propio |
| R5 | `getHubStatuses` tipado contra una interfaz estructural mínima (todos los campos opcionales y de solo lectura) | `lib/workflow-status.ts:21,102` | Elimina **6 casts**: 3 `as unknown as Parameters<…>` (`orders/utils/lifecycle.ts:20`, `sales/salesOrderFields.tsx:12`, `purchaseOrder.entity.ts:11`) y 3 `as Record<string, unknown>` (`PurchasingOrdersClientView.tsx:823,834,845`) | Bajo. Se borra la entrada de `ENTITY_CAST_ALLOWLIST` del test de contrato | cast de `purchaseOrder.entity.ts` |
| R7 | Contexto de colección por instancia genérica (`createCollectionContext<T>()`) y lookup del registro sin cast correlacionado donde TS lo permita | `components/entity-view/surfaces/Collection.tsx:99`, `core/value-kinds.ts` | 3 casts internos documentados → objetivo ≤ 1 (el del registro, con test de tipos) | Bajo | — |
| R8 | `EntityLabel` = claves de `ENTITY_REGISTRY` (`as const satisfies Record<string, EntityMetadata>`); `label`, `hubStatus.entity` y `EntityOpener` tipados | `lib/entity-registry.ts:222` (71 entradas), `core/define-entity.ts`, `core/value-kinds.ts`, `EntityViewProvider.tsx` | `getEntityMetadata(label: string)` y el resto del sistema antiguo **no cambian de firma** | TY-7: medir `tsc` frente a la línea base de 23,7 s y abortar R8 si sube más de un 10 % | — (cierra A2; test de tipos nº 17) |
| Provider | Montar `EntityViewProvider` dentro de `GlobalModalProvider`, con `open = openEntity` y `labelOf = getEntityMetadata(label)?.title` | `app/layout.tsx:42`, componente puente nuevo en `components/providers/` | Sin consumidores en producción hasta el lote 2 | Bajo | `withEntityView` deja de ser la única vía |
| URL | **Paridad** (corrección TC-038): `Collection.Root` acepta una vista controlada (`view` + `onViewChange`) y la página la conecta a `useViewMode` (`?view=`). Los filtros siguen en `UnifiedSearchBar`, dentro de `Toolbar children`, y `?selected=` con `selectedId` | `surfaces/Collection.tsx` (Root: 8 → 10 props, dentro del techo) | Hoy el orden y la página **no** viven en la URL (`WorkOrdersPageClient.tsx:44`, `EntriesClientView.tsx:31`) | **Decisión 3** | estado local de la vista |

**Verificación prevista:**

- `tsc` (con su tiempo, para R8), lint y test de contrato;
- vitest de `components/shared` (`DataCell`, `EntityCard`, `workflow-status`) y de `components/entity-view`;
- stories de entity-view;
- capturas antes/después con `playwright-cli` en UoM, Productos, OV y Compras (las mismas pantallas de `evidence/legacy/`) para comprobar que R1/R4/R5 no cambian nada y documentar R2/R3;
- tests en el servidor remoto (antes, comprobar `mutagen sync list`).

**Lo que no entra en el lote 1:**

- R6 (contraste, ADR de color aparte);
- orden y página en la URL;
- la issue #176 (TC-034);
- la memoización de filas (PF-6, se mide en el lote 2).

### 2.1 Decisiones de la Puerta D (2026-10-17)

1. **R2 global:** todas las tablas pasan a "—" en tono secundario.
2. **R3:** se exime `[data-density="compact"]` de la regla Fitts solo con `@media (pointer: fine)`, y se añade la excepción a GOVERNANCE #17.
3. **URL:** solo paridad. El orden y la página en la URL quedan como mejora futura.
4. **Lote aprobado** en el orden R5 → R1 → R4 → R2 → R3 → R7 → R8 → provider → URL.

### 2.2 Resultado del lote 1 (2026-10-17)

| ID | Hecho | Evidencia (V) |
|---|---|---|
| R1 | `align` en 9 celdas de `DataCell` (sin `align` se conserva el valor por defecto histórico); `inline` (`span`) en `Text`/`Secondary`/`Code`; `DATA_CELL_ALIGN` como única tabla de alineación. Los kinds pueden declarar un renderer `inline`, y la celda principal lo usa dentro del botón | captura `lote1-uom-table.1440.png`: la celda principal es `<button><span…>` (antes era texto plano) |
| R2 | `EMPTY_VALUE` ("—") e `isMissing` en `@/lib/utils`; `DataCell.Empty` es el único marcador; `MoneyDisplay` también lo usa | `evidence/lote1/entity-view-tipos-de-valor-matriz--table.*.png` |
| R3 | Variable `--fitts-button-min`: `[data-density="compact"]` la baja a 0 solo con `pointer: fine`. Excepción añadida a GOVERNANCE #17 | `getBoundingClientRect`: puntero fino → botón con `min-height: 0`, fila de 40 px **sin** el parche `h-7`/`-my-1.5`; táctil (`--mobile`) → botón de 40 px, fila de 57 px |
| R4 | `EntityCard`: `selectionLabel` y `EntityCard.Meta`. Grid usa el checkbox y el meta del shell (fuera `CardMeta` y el checkbox propio) | `entity-view-compras-la-más-rígida--cards.390.png` |
| R5 | `HubOrderSource` (estructural, sin firma de índice). **6 casts eliminados** (3 `as unknown as`, 3 `as Record`); `ENTITY_CAST_ALLOWLIST` vacía | tsc 0 errores |
| R7 | Registro: lectura sin cast, escritura con 1 puente (TS#30581). Contexto: guardado como `unknown`, 1 cast al leer (antes eran 3). TanStack Table es invariante en `T`, así que no admite un contexto genérico sin puente | — |
| R8 | `EntityLabel` (`satisfies` + `keyof`, sin cambiar el tipo público de `ENTITY_REGISTRY`). Test de tipos nº 17. **Encontró un defecto real:** las líneas declaraban `"sales.saleline"`, que no existe en el registro (con el provider montado, la celda principal habría abierto un drawer inexistente). Ahora la identidad es una unión discriminada `label` \| `title` | `tsc` en frío: 26,3/28,9 s antes y 26,4/25,5 s después (sin regresión) |
| Provider | `EntityViewBridge` renderizado por `GlobalModalProvider` alrededor de `children` **y** del host de drawers (hallazgo de `/code-review`). Contexto en `components/providers/EntityOpenerContext.tsx` (solo React), reexportado por entity-view: sin ciclo `shared` → `GlobalModalProvider` → entity-view → `shared` y sin el barrel en el bundle raíz | tsc + lint + tests |
| URL | `Collection.Root` con `view` + `onViewChange`; `useCollectionViewMode(label)` mapea `?view=list\|card` | — |

**Verificación:**
- `tsc`: 0 errores.
- Lint de los archivos tocados: 0 errores; las 10 advertencias ya existían (comprobado con `git stash`).
- vitest (`components/entity-view`, `components/shared`, contrato): 129/129.
- `lib` + `hooks` + `components/providers`: 91/93. Las 2 fallas son del ratchet `no-unsafe` y **ya fallaban en `master`** (TC-039).
- Stories: 21/21.
- 58 capturas (29 stories × 1440/390) con 0 desbordes, en `evidence/lote1/`.
- `/simplify` aplicado (ver la bitácora).
- `/code-review` medium: 8 hallazgos, todos corregidos:
  1. `useCollectionViewMode` respeta el `viewPolicy.defaultView` del registro.
  2. El checkbox de las cards es siempre visible en modo masivo.
  3. El provider cubre los drawers.
  4. El `text` en línea usa el vacío atenuado.
  5. `createCodeColumn` pasa el valor crudo.
  6. `Code` y `Number` conservan sus props en la rama vacía, y `false` cuenta como vacío en `Code`.
  7. `PrimaryCell` usa `resolveField`.
  8. La tabla de alineación vive en `lib/utils` (`FLEX_ALIGN_CLASS`); entity-view no importa el barrel de `shared` para ella.

  Verificación posterior: tsc 0 errores; vitest 151/151 (`entity-view`, `shared`, `providers`, contratos, `orders`); stories 21/21.

**Pantallas reales** (servidor de desarrollo con el código del lote 1 vía Mutagen, usuario de demo, 2026-10-17). Hay 16 capturas en `evidence/lote1-legacy/` (4 pantallas × lista/card × 1440/390). Se tomaron con un script que espera a que desaparezcan los skeletons: la captura "antes" de OV de la Puerta C (`evidence/legacy/ov--list.1440.png`) era un skeleton y no sirve.

| Pantalla | Fila (lista) antes → después | "-" en celdas | "—" en celdas | Desborde | Observación |
|---|---|---|---|---|---|
| UoM (`/inventory/products/uoms/units`) | 45 → 45 px | 0 | — | no | sin cambios visibles |
| Productos | 45 → 45 px | 0 | — | no | "NaN" en la paginación de cards (TC-032, ya existía) |
| OV | (skeleton) → 57 px | 0 | — | no | 57 px por el resumen en dos líneas y el `ContactLink` (botón `h-auto`, regla Fitts). Las tablas actuales no llevan `data-density`, así que el lote no las afecta |
| Compras | 49 → 49 px | 0 | 51 (cards) | no | lo único que cambia es "-" → "—" en el título vacío de la card (`legacy/compras--card.390.png` frente a `lote1-legacy/compras--card.390.png`). TC-032 sigue presente; se resuelve al migrar Compras (lote 2) |

Conclusión: R1, R3 y R4 no cambian nada en las pantallas actuales, y R2 solo cambia el glifo. Hallazgo nuevo: el `listUrl` de `inventory.uom` en el registro (`/inventory/products/units`) no existe y redirige a Productos (TC-041).

**Deuda registrada:**
- `EntityCard.Meta` y `DocumentFieldGrid` son dos primitivas de etiqueta/valor.
- `CollectionViewMode` (`table`) frente a `useViewMode` (`list`).

## 3. Lote 2: plan (Puerta D, presentada el 2026-10-17)

Rama: `refactor/entity-view-lote-2` (desde `refactor/entity-view-lote-1`, `b3ae3fac3`).

### 3.1 Inventario de las pantallas actuales (Explore; V con `archivo:línea` en el informe del subagente)

| Pantalla | Archivo (líneas) | Paginación | Búsqueda / agrupación | Selección y acciones | Apertura | Analítica | Particularidades |
|---|---|---|---|---|---|---|---|
| UoM | `features/inventory/components/UoMClientView.tsx` (215) | cliente | `UnifiedSearchBar` + `groupBy` | columna de checkbox a mano; masiva "Eliminar" con confirmación; `uomActions` | `?selected` → modal de edición | — | `renderCard` |
| Productos | `features/inventory/components/ProductClientView.tsx` (705) | servidor (50); agrupar → página 1 de 200 sin paginar | búsqueda con filtros de categoría añadidos en ejecución y postproceso de disponibilidad | checkbox a mano; masivas; archivado con diálogos | `?selected` | **sí**, 4 pestañas y 3 hooks | `renderCustomView` (detalle de stock), imagen o icono por card, `defaultPageSize` 500 |
| OV | `features/sales/components/SalesOrdersView.tsx` (435) | servidor (20); agrupar → 200 | por modo (órdenes/notas) | — | `toggleSelection` (ficha) o `onSelectOrder` del padre (POS) | **sí**, calculada sobre la página actual | modos con estado propio; cards atenuadas cuando la ficha está abierta (`isHubOpen`) + `hubTrigger` |
| Compras | `app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx` (1042) | órdenes en servidor, notas en cliente; agrupar → 5000 | 3 columnas ocultas solo para filtrar | — | `useDocumentSheetRoute` | **sí**, embudo y 4 pestañas | 6 modales de workflow, datos iniciales del servidor (SSR) |

Ninguna de las cuatro ordena en servidor: hoy el orden solo reordena la página visible.

### 3.2 Capacidades que faltan en entity-view (todas por composición, sin props nuevas por encima del techo)

| Capacidad | Diseño propuesto | Consumidores |
|---|---|---|
| Búsqueda unificada + reinicio | `UnifiedSearchBar` como hijo de `Collection.Toolbar`; `isFiltered` ya existe en la fuente; reinicio dentro del estado vacío filtrado | 4 |
| Agrupación | opción `groupBy?: Id \| null` en `useEntityCollection` (estado, no prop); `Collection.Table`/`Grid` pintan encabezados de grupo. Paridad: el hook de la página desactiva la paginación en servidor al agrupar, con el tope de cada pantalla | 4 |
| Acciones masivas | `Collection.BulkBar` (hijo nuevo, ≥3 consumidores en el repositorio) que recibe las filas seleccionadas y reutiliza el tipo `BulkAction` existente | UoM, Productos (+ otras pantallas ya inventariadas) |
| Panel de analítica | `Collection.Analytics` (hijo nuevo: el botón de la barra lo muestra u oculta; el contenido es de la feature) | Productos, OV, Compras (3 entidades, 3 features: cumple la regla) |
| Foco del hub | con `selection="panel"` y `selectedId`, las cards no seleccionadas se atenúan solas (sin prop nueva) | OV, Compras |
| Estado vacío completo y botón de crear | el botón va como hijo de `Toolbar`; `emptyAction` en `View` (5 props, dentro del techo) | 4 |
| Vista de detalle que sustituye la lista | composición en la página (condicional), sin cambios en el núcleo | Productos |

### 3.3 Propuesta de partición

- **Lote 2a:** las capacidades de §3.2 + **UoM** y **Productos**. Ejercitan búsqueda, agrupación, acciones masivas, analítica y vista sustituta. Incluye TC-041 (`listUrl` de UoM).
- **Lote 2b:** **OV** y **Compras**, con modos, foco del hub, ficha y modales de workflow. Incluye TC-032.

### 3.4 Decisiones de la Puerta D (2026-10-17)

1. **Partición 2a + 2b.** 2a = capacidades + UoM + Productos (+ TC-041). 2b = OV + Compras (+ TC-032). Cada uno con su Puerta D.
2. **Agrupación:** paridad con un **tope uniforme de 200** y un aviso cuando hay más resultados. Compras baja de 5000 a 200. La agrupación en servidor queda como Pd-backend (PF-5).
3. **Analítica:** `Collection.Analytics` en el núcleo; el contenido sigue en cada feature.
4. **Orden en servidor: se corrige ahora.** Backend: `filters.OrderingFilter` + lista blanca `ordering_fields` en cada viewset (precedente: `contacts/views.py:31-34`, `workflow/views.py:32-35`), con desempate estable por `id`. Frontend: orden controlado en `useEntityCollection` (modo servidor) y opción de campo `orderBy` (clave del servidor). Productos en 2a; OV y OC en 2b.

### 3.5 Plan del lote 2a

1. **Núcleo:**
   - orden controlado/servidor + `orderBy`;
   - `groupBy`;
   - `Collection.BulkBar`;
   - `Collection.Analytics`;
   - `emptyAction`;

   cada pieza con tests unitarios, stories y techo de props.
2. **Backend:**
   - `ProductViewSet`: `OrderingFilter` + `ordering_fields`;
   - pytest del parámetro `ordering`;
   - `api-contracts.md` actualizado.
3. **UoM:**
   - pantalla sobre entity-view (búsqueda, agrupación, acciones masivas y de fila, modal `?selected`);
   - TC-041 (`listUrl`).
4. **Productos:**
   - paginación y orden en servidor, agrupación con tope, acciones masivas y archivado;
   - analítica (4 pestañas) y vista sustituta del detalle de stock;
   - imagen o icono por card.
5. **Ciclo completo:**
   - tsc, lint y tests (también pytest);
   - capturas antes/después de las pantallas reales;
   - `/simplify`, `/code-review` medium;
   - commit;
   - Puerta D del 2b.

### 3.6 Resultado del lote 2a (2026-10-17)

**Núcleo (entity-view):**
- Orden en servidor: `sorting: { mode: "server" }`, campo `orderBy`, `orderingParam` con desempate por `id`.
- `groupBy` con `groupItems` y `GROUP_ROW_LIMIT`, más el aviso `Alert` de truncado.
- `Collection.BulkBar` sobre el `SelectionDock` compartido (también lo usa `DataTable`: quedan fuera dos copias de su marcado).
- `Collection.Analytics` como modo de vista.
- `emptyAction` y `onResetFilters`.
- `actions(row, surface)` + `createEntityActions().forCollection(ctx)`.
- `Root` ocupa la altura de su padre.

**Backend:**
- `ProductViewSet`: `OrderingFilter` + `ordering_fields` (id, name, internal_code, code, category__name, product_type, annotated_current_stock, sale_price).
- pytest 4/4 (incluido el de número de queries); `api-contracts.md` actualizado.

**Defectos encontrados y corregidos:**
- **TC-043 · `initialData` de TanStack Query.** Productos pasaba los datos renderizados en servidor a `useQuery`, y TanStack los usa para *cualquier* clave nueva mientras la caché está vacía, además de darlos por frescos. Al ordenar, filtrar o paginar no se hacía la petición. Lo destapó el orden en servidor, y la vista antigua tenía el mismo problema. Arreglo: `useProducts({ initial: { page, params } })` solo los aplica si `hashKey` coincide. `page.tsx` pide ahora la misma consulta que el cliente (50 filas, sin variantes, total real; antes eran 200 filas con variantes y un `count` falso).
- **TC-044 · Ciclo de imports.** `@/components/shared` → `GlobalModalProvider` → registro de drawers → vista de feature → barrel de entity-view. Al migrar Productos, todos los tests de entity-view fallaban con `registerValueKind is not a function`. Arreglo: el barrel evalúa primero el núcleo, que no tiene dependencias. Un test de contrato fija ese orden (verificado por mutación). La causa de fondo, que el registro de drawers cargue las vistas de forma ansiosa, queda como deuda.
- **TC-041 + TC-042:** `listUrl` de UoM y de categorías de UoM corregidos; ratchet de 23 `listUrl` rotos (#178).
- Defecto del total al agrupar (`rowCount` se ignoraba sin paginación en servidor), atrapado por el test nuevo.

**Pantallas** (app real, servidor de desarrollo, usuario de demo; capturas en `evidence/lote2a/`):

| Pantalla | Antes → después (líneas de vista + `*Fields`) | Verificado en la app |
|---|---|---|
| UoM | 215 + 52 (`uomFields.ts`, borrado) → 149 + 21 (`uom.entity.ts`) | tabla única con `data-density`; barra masiva; `?view=card`; el modal de edición abre con `?selected=` |
| Productos | 705 + 76 (`productFields.tsx`, borrado) → 653 + 64 (`product.entity.tsx`) | orden en servidor (`ordering=name,id` / `-name,-id`, datos reordenados); agrupación por categoría (6 grupos); analítica (4 pestañas; detalle de stock dentro de la vista); cards a 390 px sin desborde; paginación "1 a 34 de 34" |

Las vistas de Productos conservan casi todas sus líneas: la mayor parte es la configuración de la analítica (≈ 280 líneas) y el archivado con sus diálogos, que no son presentación.

**Diferencias aceptadas:**
- UoM ya no muestra la columna "Código interno" (`id`). Pasa a mostrar la abreviación (diseño del spike, Puerta C).
- Las cards de Productos muestran el icono por tipo de producto, no el de la categoría (Puerta C).
- Agrupar más de 200 productos agrupa los primeros 200 y muestra un aviso. Antes la lista quedaba sin agrupar y salía un toast.

**Observación heredada (sin cambios):** en las `StatCard` con gráfico, en anchos estrechos los títulos se parten y la leyenda invade el encabezado. Pasa igual en la analítica de OV, que sigue en el sistema antiguo.

**Deuda registrada:**
- Traducir en cada vista las claves de agrupación de `UnifiedSearchBar` a ids de campo (Productos: `product_type` → `type`, `category_name` → `category`).
- Ordenar por stock calcula la suma sobre todos los productos antes del `LIMIT`. Es barato con volúmenes de PYME; si crece, conviene desnormalizar e indexar el stock.
- El registro de drawers carga las vistas de forma ansiosa (causa de fondo de TC-044).

**Verificación:**
- tsc 0 errores; lint de lo tocado sin errores ni advertencias.
- vitest 220/222: las 2 fallas son del ratchet `no-unsafe`, ya presentes en master (#177), sin archivos nuevos.
- Stories 21/21.
- pytest 4/4.
- `/simplify` aplicado: `SelectionDock`, `groupItems`, `Alert`, `forCollection`, la regla de `initialData` en el hook, memos de orden y selección, y la guarda del orden del barrel.
- `/code-review` medium: 10 hallazgos, 9 corregidos.
  1. La página vuelve a 0 al cambiar filtros, orden o agrupación. Se deriva por "forma" de consulta, sin efectos. Verificado por tipos y revisión, no en la app: con 34 productos solo hay una página.
  2. `useProducts` y `useUoMs` exponen `isError`, y la colección muestra el error con "Reintentar" en vez de "vacío" (invariante #8).
  3. `BulkBar` entrega las filas refrescadas tras un refetch (test de regresión, verificado por mutación).
  4. Con paginación en servidor, la selección se limpia al llegar otras filas (test).
  5. "Total (c/IVA)" no se puede ordenar: se muestra bruto o dinámico y el servidor solo ordena por el `sale_price` neto.
  6. **TC-045:** el stock mostrado se multiplicaba por el número de variantes (defecto previo, ver el ledger). Corregido con una subconsulta; test de regresión.
  7. Consulta por defecto única (`DEFAULT_PRODUCT_LIST_QUERY`) compartida por `page.tsx` y la vista; `group_by` evita la precarga inútil.
  8. Fuera `createEntityActions().cell`, que no tenía uso.
  9. JSDoc de `useCollectionViewMode` en su sitio.

  No se corrige: el orden de imports del barrel. Lo protege un test de contrato, y la alternativa (imports profundos de `shared`) viola la invariante #6. Su causa de fondo es TC-044.
- Verificación final:
  - tsc 0 errores; lint de lo tocado sin errores (las advertencias de `inventoryApi.ts` son previas).
  - vitest 222/224: las 2 fallas son de #177, ya presentes en master.
  - Stories 21/21.
  - pytest de inventario 72/72.

### 3.7 Lote 2b: plan (Puerta D, presentada el 2026-10-17)

Rama: `refactor/entity-view-lote-2` (sigue tras `ff25775da`).

| Pantalla | Archivo (líneas) | Qué hay que conservar | Riesgo |
|---|---|---|---|
| OV | `features/sales/components/SalesOrdersView.tsx` (435) | modos órdenes/notas con hooks y paginación propios; ficha (`toggleSelection`, `useDocumentSheetRoute`) **y** selección controlada por el padre (POS: `onSelectOrder`/`selectedId`); filtro `posSessionId`; analítica (calculada sobre la página actual) | dos fuentes de selección; uso en POS |
| Compras | `app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx` (1042) | modos (órdenes en servidor, notas en cliente); ficha; 6 modales de workflow (registro, completar, checkout, folio, borrar, anular, forzar anulación); analítica (embudo y 4 pestañas); facetas de recepción, facturación y tesorería | tamaño; **mismo defecto que TC-043** (`page.tsx` pide 200 filas; `usePurchasingOrders` aplica `initialData` a cualquier consulta); TC-032 |

**Capacidades nuevas del núcleo:**
- **Foco del hub.** Con `selection="panel"` y `selectedId`, las cards no seleccionadas se atenúan (paridad con `isHubOpen`). Va en el estado de Root, sin props nuevas.
- **Modos con paginación propia.** Ya existe con `CollectionModes`: cada modo monta su colección.

**Backend:** `OrderingFilter` + `ordering_fields` en `SaleOrderViewSet` y `PurchaseOrderViewSet`, solo para las columnas que el servidor puede ordenar tal como se muestran: folio (`number`), contacto (`customer__name` / `supplier__name`), `date`, `total`. Hub, canal y pendiente no se ordenan. Con pytest y `api-contracts.md`.

**Correcciones incluidas:**
- TC-043 en Compras (`initial` por consulta, con la misma constante para `page.tsx` y el cliente).
- TC-032 (card de Compras sin título, métricas cortadas, "Página 1 de NaN"), que desaparece con la migración. Se verifica con capturas a 390 px.

#### Decisiones de la Puerta D (2026-10-17)
1. **Partición:** 2b = OV; 2c = Compras (con TC-043 y TC-032), con su propia Puerta D.
2. **Foco del hub:** solo atenuar las cards no seleccionadas (sin blur).
3. **Analítica de OV: se corrige ahora.** Endpoint de analítica de OV sobre el conjunto filtrado completo (hoy se calcula sobre las 20 órdenes de la página visible), siguiendo el precedente del endpoint de analítica de productos.

### 3.8 Resultado del lote 2b — OV (2026-10-17)

**Núcleo:**
- Foco del hub: con `selection="panel"` y `selectedId`, las cards no seleccionadas se atenúan (opacidad, sin blur).
- `useServerPage(shape, initial)`: la página vuelve al inicio al cambiar filtros, orden o agrupación. Ahora lo usan Productos y OV.
- Orden por defecto derivado: con paginación en servidor y sin `sorting`, ninguna cabecera se puede ordenar, así que nunca se reordena una sola página.
- `bindUnifiedSearch(search)` en `shared`: cablea la barra de búsqueda en las 4 colecciones migradas.

**Backend:**
- `SaleOrderViewSet`:
  - `OrderingFilter` (id, number, date, customer__name, total);
  - **`GET /sales/orders/analytics/`** sobre la lista filtrada completa (mismo `filter_queryset`), con `SaleOrderAnalyticsService` (`sales/analytics.py`).
- Las cifras de pago usan las propiedades del modelo (`PaymentSelector`), para coincidir con la ficha. Las etiquetas salen de los `choices` del modelo.
- Queryset propio con el prefetch justo.
- pytest de `sales` 25/25 (5 nuevos: cubre toda la lista, filtros, granularidad, orden en servidor y número de queries constante).

**Frontend:**
- `SalesOrdersView`, de 435 a 421 líneas: el 55 % es la configuración de la analítica, que ahora es una función pura.
- Dos colecciones, una por modo. Antes **se pedían órdenes y notas a la vez** aunque solo se viera una.
- `useSaleOrderAnalytics` (de 273 a 114 líneas) solo consulta cuando la vista de analítica está abierta.
- Entidades: `saleOrder.entity.ts` (27 líneas, sin el stub de exportación del spike) y `saleNote.entity.ts` (25 líneas, NC con signo).
- `orderStageSummary` pasa a `features/sales/utils/orderStage.ts`.

**Defectos encontrados y corregidos:**
- **TC-047 · analítica de OV sobre la página visible.** Antes: 20 órdenes y $1.419.350. Ahora: las 178 órdenes filtradas y $12.522.850 (app real).
- **TC-048 · el tipo `Invoice` declaraba `partner`, que la API nunca envía** (envía `partner_id`/`partner_name`). En notas, el enlace al cliente no tenía id. Se añade `partner_id`. `PurchaseInvoicesClientView.tsx:286` también lee `partner`: se revisa en el 2c.

**Verificado en la app real** (capturas en `evidence/lote2b/`):
- tabla de 7 columnas y "1 a 20 de 178";
- `ordering=-total,-id`, que reordena los datos ($148.500 primero), sin hub ordenable;
- al abrir una card, `?selected=179` y las otras 19 cards atenuadas;
- analítica de 178 órdenes con el año completo en el gráfico;
- notas: NC con signo y cliente enlazado, sin columnas ordenables.

**Operación:** el backend del servidor de desarrollo corre con `daphne` sin autorrecarga, así que hubo que reiniciar el contenedor para cargar la vista nueva. `remote-dev-server.md` dice que Django recarga solo: discrepancia registrada (TC-049).

**Deuda:**
- analítica con agregados SQL en vez del recorrido en Python (lineal en el tamaño de la lista filtrada);
- buckets diarios para no recalcular al cambiar de granularidad;
- traducción de las claves de agrupación en cada pantalla;
- orden en servidor para notas (endpoint de facturas);
- quitar `partner` del tipo `Invoice` (2c).

**Revisiones:**
- `/simplify`:
  - etiquetas desde los `choices` del modelo (fuera los mapas duplicados del cliente);
  - queryset de analítica con el prefetch justo y sin ordenar;
  - `paid_amount` una vez por orden;
  - `bindUnifiedSearch`;
  - orden por defecto derivado en el núcleo;
  - fuera las props, parámetros y exports sin uso.
- `/code-review` medium: 10 hallazgos, 7 corregidos.
  1. Tendencias con `timezone.localdate()`.
  2. Clientes agrupados por id.
  3. Los 10 primeros clientes más "Otros".
  4. Sumas en `Decimal`.
  5. Analítica con carga (`SkeletonShell`) y error con "Reintentar", en vez de ceros.
  6. Nombre del cliente sin id en notas (texto plano).
  7. `Collection.Analytics` detectado como hijo directo, sin efectos; la vista `analytics` sin él cae a la tabla.

  Además, el cambio del orden por defecto queda registrado en el contrato y en ADR-0087 ("Phase 7 amendments").
  No corregidos: los agregados SQL (deuda ya registrada) y el cambio de `frontend/next.config.ts`, que **no es de este lote** (está sin commitear en la copia de trabajo, ajeno a esta tarea).

**Verificación:**
- tsc 0 errores; lint de lo tocado sin errores ni advertencias (`salesApi.ts` baja de 7 a 6).
- vitest 147/147 (entity-view, shared, contrato, sales, inventory).
- Stories 21/21.
- pytest de `sales` 26/26.
- App real tras reiniciar el backend: las mismas cifras sobre 178 órdenes.

### 3.9 Lote 2c: plan (Puerta D, presentada el 2026-10-17)

Inventario de `app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx` (1042 líneas; Explore, con `archivo:línea` en el informe):

| Hallazgo | Evidencia | Propuesta |
|---|---|---|
| **Código muerto:** los modales de edición, registro, completar y folio, y las acciones de borrar, anular y forzar anulación, nunca se abren desde la lista (los `set*` solo se llaman con `null`; `requestConfirm` nunca se invoca). Las acciones reales van por la ficha (`useDocumentSheetRoute`) | V:76-85, 777-805, 861-1040 | eliminar de la lista (la ficha conserva las acciones); se mantiene el asistente de alta (`?modal=new`) |
| **Modo "notas" inalcanzable:** `PurchasingPageClient` siempre pasa `viewMode="orders"` | V:45 | eliminar el modo y `usePurchasingNotes` de esta pantalla, y la precarga de notas de `page.tsx` |
| **Analítica sobre la página visible** (`usePurchasingAnalyticsData(orders, …)`, igual que pasaba en OV); no hay endpoint | V:89; `hooks/usePurchasingAnalyticsData.ts:84` | **Decisión 1** |
| **Facetas que filtran solo la página:** columnas ocultas `reception/billing/treasury_status` con `filterFn` en el cliente. El backend ya admite `receiving_status`, `billing_status`, `treasury_status` y `origin_status` | V:821-855; `backend/purchasing/views.py:25-45,95-100` | **Decisión 2** |
| **TC-043 en Compras:** `page.tsx` precarga 200 filas y `usePurchasingOrders` aplica `initialData` a cualquier consulta (con `count` = 200) | `page.tsx`; `usePurchasing.ts:30`; V:57 | `initial` por consulta, con la consulta por defecto compartida (como Productos) |
| Agrupación con tope de 5000 | V:56-69 | tope uniforme de 200 (Puerta D lote 2) |
| Sin orden en servidor | `PurchaseOrderViewSet` sin `OrderingFilter` | `OrderingFilter` (number, date, supplier__name, receipt_date, total) + pytest |
| Búsqueda sobre `lines__product__name` sin `distinct` (posibles filas duplicadas) | `views.py` `search_fields` | verificar con un test; si duplica, `DistinctSearchFilter` (como OV) |
| `PurchaseInvoicesClientView.tsx:286` lee `.partner`, que nunca llega (TC-048) | — | usar `partner_id` y quitar `partner` del tipo `Invoice` |
| Entidad del spike: la tabla no tiene la columna "Resumen" (workflow) que se ve hoy; el folio usa `display_id ?? number` | `purchaseOrder.entity.ts` | revisar la paridad de columnas al migrar |

#### Decisiones de la Puerta D 2c (2026-10-17)
1. **Quitar el código muerto:** modales y acciones inalcanzables desde la lista y el modo "notas". Se conserva el asistente de alta (`?modal=new`).
2. **Analítica de Compras sobre la lista filtrada completa** con endpoint propio, siguiendo el patrón de OV.
3. **Facetas de recepción, facturación y tesorería al servidor** (`receiving_status`, `billing_status`, `treasury_status`). Fuera las columnas ocultas.

### 3.10 Resultado del lote 2c — Compras (2026-10-18)

**Backend**
- `GET /api/purchasing/orders/analytics/` (`purchasing/analytics.py`). Reutiliza `filter_queryset`, así que aplica los mismos filtros y la misma búsqueda que la lista. Calcula **solo** las cifras que muestra el panel: volumen, embudo por ejes (ADR-0084), formas de pago, proveedores, periodos, almacenes, productos, tipos, DTE, facturación y desglose por tipo de producto. La versión del cliente calculaba además tendencias, rangos de monto y próximas recepciones, que ninguna pestaña mostraba.
- Las etiquetas de forma de pago vienen de `TreasuryMovement.Method`; se quita el mapa duplicado del cliente, que difería de tesorería en "Terminal de cobro".
- Helpers comunes con OV en `core/analytics.py` (`bucket`, `previous_bucket`, `num`, `to_json`, `ranked`).
- `PurchaseOrderViewSet`: `OrderingFilter` (number, date, supplier__name, receipt_date, total; desempate `,id`) y `DistinctSearchFilter`.
- Prefetch `payments__invoice`: `total_paid` lee el DTE de cada pago y, sin él, consultaba una vez por pago.
- `purchasing/tests/test_order_analytics.py`: lista completa (25 > página), filtros, orden en servidor y consultas constantes.

**Frontend**
- `PurchasingOrdersClientView.tsx` (1042 líneas) se elimina.
  - Lo reemplaza `features/purchasing/components/PurchaseOrdersView.tsx` (~180), que usa `Collection.*`: paginación y orden en servidor, `useServerPage`, agrupación con `GROUP_ROW_LIMIT`, foco del hub en cards y `Collection.Analytics` con estados de carga y error.
  - La configuración del panel pasa a una función pura (`purchaseOrderAnalyticsScreen.ts`).
- **Decisión 1 (código muerto) — corrección:** el modo "notas" **no** era inalcanzable. Lo usa `/purchasing/notes` (pestaña "Notas Crédito/Débito" de `PurchasingHeader`). Se migra como colección propia con `purchaseNoteEntity`, movida del spike de billing a purchasing, y con el `purchaseInvoiceUnifiedSearchDef` de billing (mismo endpoint). Antes la lista de notas ignoraba los filtros y la paginación (TC-051).
- **Decisión 2:** `usePurchaseOrderAnalytics` (consulta habilitada solo en la vista de analítica) sustituye a `usePurchasingAnalyticsData`.
- **Decisión 3:** las facetas viajan como parámetros del buscador (ya existían en `purchaseOrderUnifiedSearchDef`). La entidad pierde `facets` y las 3 columnas ocultas desaparecen.
- **TC-043:** se quita la precarga SSR de 200 filas y de notas (`page.tsx` queda trivial, como OV). No hay `initialData` que contamine otras claves.
- El asistente de alta (`?modal=new`) pasa a `PurchasingPageClient`. Al terminar invalida `PURCHASING_KEYS.orders()` (lista y analítica).
- Se quitan `deleteOrder` y `annulOrder` de la API y sus mutaciones (sin consumidores; las acciones viven en la ficha).
- **TC-048:** `PurchaseInvoicesClientView` usa `partner_id`, y se quita `partner` del tipo `Invoice`.
- **`Collection.Toolbar action`** (enmienda del contrato, ADR-0087 lote 2c): a 390 px el botón de crear tapaba la búsqueda en Compras, Productos y UoM (TC-050).
- `periodPresets(from, to)` en `lib/date-presets.ts` sustituye tres copias expandidas de los presets de fecha en `purchasing/unifiedSearchDef.ts`.

**Verificación**
- `tsc` sin errores.
- `eslint` sin errores en los archivos del lote. Los 21 errores globales están en tesorería, contabilidad, dashboard y auditoría: son cambios del usuario sin commitear, fuera del lote.
- vitest 51/51 (entity-view, purchasing, billing, inventory); stories de Compras 2/2.
- pytest: purchasing + billing 68, y analítica de OV y Compras 28.
- App real (antes de `/simplify`), en `evidence/lote2c/`:
  - lista: 7 columnas, 20/51, sin scroll horizontal;
  - orden: `ordering=-total,-id`;
  - hub: `?selected=2`, 19 cards atenuadas;
  - analítica sobre las 51 OC (volumen $7.333.850; embudo CONFIRMED 51 · RECEIVED 39 · INVOICED 49 · PAID 38);
  - `?modal=new` abre el asistente;
  - notas: estado vacío correcto, porque el servidor tiene 0 notas de compra;
  - 390 px sin desborde.
- **Tras `/simplify` y `/code-review`** (servidor reiniciado tras TC-052):
  - formas de pago con etiqueta del modelo (Transferencia 37 · Crédito 13 · Tarjeta (Manual) 1);
  - top de productos por id;
  - la lista sin `ordering` usa el orden del servidor `-date,-id`;
  - notas con el buscador de billing (`/billing/invoices/?page=1&page_size=20&…`, estado vacío);
  - a 390 px, la acción baja bajo la búsqueda en Compras y Productos, sin desborde;
  - UoM a 390 px sin desborde, pero la página no compila por TC-053 (ajeno al lote).

**`/code-review` medium (10 hallazgos)**

Corregidos (7):
1. `PurchaseOrder` sin orden por defecto: paginación inestable. Ahora `ordering = ["-date", "-id"]` en el ViewSet.
2. El test de consultas no ejercía los prefetches: ahora tiene líneas con productos.
3. La analítica dependía del serializer: ahora usa `order.pending_amount` del modelo.
4. Toda la lista cargaba en memoria de una vez: ahora `iterator(chunk_size=500)`.
5. Los productos se agrupaban por nombre: ahora por id.
6. `Toolbar` reservaba la celda de búsqueda aunque viniera vacía.
7. Import interno de billing en la story.

Sin cambio (paridad con la lista y con la versión del cliente; se registran):
- las OC canceladas cuentan en el volumen;
- una factura primaria anulada cuenta como "facturada", la misma regla que `get_is_invoiced` de la ficha;
- "Pagada" = saldo ≤ 0, la misma regla que `payment_status` del modelo.

Si se cambian, debe ser en el modelo y el serializer, no solo en la analítica.

## 4. Matriz por entidad

| Entidad | Pantalla | Antes | Después | Extensiones | Diferencias | Tests | Resultado | Deuda |
|---|---|---|---|---|---|---|---|---|
| Línea de documento (`orderLineEntity`) | Ficha OV/OC, Resumen | `orderLineFields`/`purchaseOrderLineFields` + `DataTable` (2 `computed`, 7 `placement: 'detail'`, TC-012) | `orderLineViews.sale/purchase` en `Collection` | `docRef` | sin orden por columnas; "Facturado" como progreso; cabe en 705 px (antes se desbordaba) | `orderSheet.test.ts` (vistas) | ✅ app real | `sortable` por campo |
| Línea de documento | Ficha factura, Resumen | `invoiceLineFields` + `DataTable` (1 `computed`) | `orderLineViews.invoice` | `docRef` | — | `orderSheet.test.ts` | ✅ (sin captura propia) | — |
| Línea de documento (editable) | `DeliveryDrawer` | `<Table>` a mano, `useState`, toasts de stock | `deliveryLinesEditable` / `serviceDeliveryLinesEditable` + RHF | `docRef`, `status` | producción avanzada no elegible; stock como error de celda | `orderSheet.test.ts`, `EditableCollection.test.tsx`, story | ✅ app real (envío interceptado) | stock por producto (Pd-backend) |
| Línea de documento (editable) | `ReceiptModal` | `<Table>` a mano, 2 `useState`, sin form | `receiptLinesEditable` / `returnLinesEditable` + RHF | `status` | devolución con tope = recibido; sin `Math.ceil` en cantidad | `orderSheet.test.ts`, `EditableCollection.test.tsx` | ✅ app real (envío interceptado) | cast de `PurchaseOrderAPI` (3b); TC-059 |

(Desde el lote 3a. Los lotes 2a–2c están detallados en §3.6–§3.10.)

## 5. Lote 3: plan (Puerta D, presentada el 2026-10-18)

Inventario: subagente Explore (`archivo:línea` en su informe) y verificación propia de TC-012, TC-055, la allowlist y los consumidores (`grep -rn "export const [a-zA-Z]*LineFields" features`).

### 5.1 Líneas de solo lectura

| Pantalla | Archivo (líneas) | Hoy | Tipo de fila | Notas |
|---|---|---|---|---|
| Ficha OV/OC, pestaña Resumen | `features/orders/components/sheet/OrderSummaryTab.tsx` (97) | `orderLineFields` / `purchaseOrderLineFields.toColumns({ exclude: ["work_order_summary"] })` (:51) + totales | `OrderLine` | **TC-012 sigue vivo** (`entity-fields.tsx:903` filtra por la clave del mapa `work_order`); TC-056 (Facturado, Recibido) |
| Ficha factura, pestaña Resumen | `features/orders/components/sheet/InvoiceSummaryTab.tsx` (99) | `invoiceLineFields.toColumns()` + `DataTable variant="minimal"` + totales | `OrderLine` | 44 líneas de definición |
| Despacho / devolución de venta | `features/sales/components/SaleDeliveryDrawer.tsx` (95), `SaleReturnDrawer.tsx` (98) | `saleDeliveryLineFields`, `saleReturnLineFields` | `DeliveryLine`, `ReturnLine` | simples |
| Recepción / devolución de compra | `features/purchasing/components/PurchaseReceiptDrawer.tsx`, `PurchaseReturnDrawer.tsx` | `purchaseReceiptLineFields`, `purchaseReturnLineFields` | `ReceiptLine`, `ReturnLine` | simples |

### 5.2 Edición por lote P1 (8 superficies; 7 en `ADHOC_TABLE_ALLOWLIST`)

| Superficie (líneas) | Celdas editables | Estado | Elegibilidad | Extra | Salida |
|---|---|---|---|---|---|
| `sales/DeliveryDrawer` (553) | cantidad | RHF solo cabecera; cantidades en `useState` | tipo SERVICE/PRODUCT; stock; producción | stock por bodega, OT, `StatusBadge` por fila | `line_quantities: {[lineId]: qty}` |
| `sales/checkout/Step3_Delivery` (326) | cantidad + **UoM** | estado del wizard | `isEligible` + motivo | **`NumpadModal`** (táctil, POS); TC-055 | `partialQuantities[{lineId, productId, dispatchedQty, uom}]` |
| `purchasing/ReceiptModal` (389) | cantidad + **costo** | 2 `useState` | sin bodega → botón deshabilitado | chip de UoM, estado por fila (Completo/Parcial/Excede) | `line_data[{line_id, quantity, unit_cost}]` (llamada directa a `purchasingApi`, sin hook) |
| `purchasing/checkout/Step4_Receipt` (360) | cantidad + **UoM** | estado del wizard | solo si `type === 'PARTIAL'` | 2.ª subtabla de fecha por fila (:284) | `partialQuantities` |
| `billing/checkout/Step2_Logistics` (354) | cantidad + **UoM** | estado del wizard | "Requiere producción" / "Sin control de stock" | — | `line_data[{line_id, product_id, quantity, uom_id}]` |
| `orders/NoteLogisticsModal` (225) | cantidad | `useState` **por producto** | pendiente ≤ 0 | — | `useProcessLogistics` |
| `billing/checkout/Step1_Items` (235) | **checkbox** + cantidad + precio + **motivo** | estado del wizard | la fila se edita al marcarla | stock, fabricable, badge MAX | `selectedItems[]` |
| `notes/steps/NoteStep_LineItems` (486) | igual que Step1 (modo `select`) + modo `edit` sobre `DataTable` con columnas JSX en línea | props del padre | al marcarla | — | `onLinesChange` |

Ninguna usa `OrderLine`: cada pantalla tiene su tipo local (`SaleOrderLine`, `PurchaseOrderLine`, `CheckoutLine`, `InvoiceLine`, `NoteLineItem` o un cast en línea).

### 5.3 Capacidades que faltan en `EditableCollection` (hoy: `quantity`/`money`, `eligible`, `footer.sum`, `bulk`)

| # | Capacidad | Consumidores | Regla ≥3/≥2 | Diseño propuesto |
|---|---|---|---|---|
| E1 | Input **UoM por fila** | Step3, Step4, Step2 (3 entidades, 3 features) | cumple | registro abierto de **kinds de input**, igual que los value kinds (A1): el núcleo trae `quantity`/`money`/`text`; `features/inventory` registra `uom` con `UoMSelector`. Sin `render` opaco |
| E2 | Input **texto** (motivo) | Step1, NoteStep | no (2) | kind `text` del núcleo: es un tipo básico, no un caso de feature |
| E3 | **Selección que habilita la fila** | Step1, NoteStep | no (2) | opción `select?: { label(row) }` en la definición; fila no marcada = no procesada. Alternativa: dejar Step1/NoteStep para un lote posterior |
| E4 | **Estado por fila derivado del valor** (Completo/Parcial/Excede) | DeliveryDrawer, ReceiptModal | no (2) | `rowStatus?: (row, values) => { label, tone }` pintado con `StatusBadge` (invariante #7). Alternativa: quitar la columna y apoyarse en la pista "Máx. N" + el error por celda |
| E5 | Teclado numérico táctil | Step3 (1) | no | `inputMode="decimal"` ya abre el teclado numérico del móvil; `NumpadModal` sale o queda como acción de la feature |
| E6 | Varias celdas editables por fila (cantidad + costo/precio) | ReceiptModal, Step1, NoteStep | ya existe | `inputs` admite varias; el "al menos una" (ED-3) hoy cuenta cualquier celda > 0 (`EditableCollection.tsx`, `editableSchema`): con un costo inicial > 0 pasaría con todas las cantidades en 0. Hay que declarar qué input es la cantidad que se procesa |
| E7 | Subtabla de fecha por fila | Step4 | no (1) | composición en la feature, fuera del `EditableCollection` |
| E8 | Payload del dominio | 8 | — | función pura por feature `toXxxPayload(def, rows, value)`; nada en el núcleo |
| E9 | Foco en el primer error y primera columna fija a 390 px (ED-5, AX-6) | 8 | — | se cierra en este lote |

Techo de props de `EditableCollection`: 7 de 12. E1–E4 son opciones de la **definición**, no props.

### 5.4 Propuesta de partición (≤5 entidades por lote)

- **3a — Líneas de la ficha + P1 de drawers/modales.** `orderLine` (OV/OC; TC-012, TC-056), `invoiceLine`, y `DeliveryDrawer` + `ReceiptModal` (RHF completo, estado por fila, costo). Entidades: orderLine, invoiceLine, línea de despacho, línea de recepción (4). Capacidades: E4, E6, E8, E9. Sale `orderLineFields`, `invoiceLineFields` y 2 entradas de la allowlist.
- **3b — P1 de wizards.** Step3 (TC-055), Step4, Step2, NoteLogisticsModal. Capacidades: E1 (kinds de input + `uom`), E5. Salen 4 entradas de la allowlist.
- **3c — Selección + motivo y líneas de movimientos.** Step1, NoteStep_LineItems (E2, E3), y las 4 líneas de solo lectura de despacho/devolución/recepción (`fromLegacyFields()` o a mano).

### 5.5 Decisiones para el usuario

1. **Partición** 3a / 3b / 3c (o 3a+3b juntos).
2. **Entidad de fila:** ¿una entidad por pantalla con su tipo local (lo mínimo), o se unifican los tipos locales en `OrderLine` (`SaleOrderLine`/`PurchaseOrderLine`) y se reutiliza `orderLineEntity`?
3. **Estado del wizard (Step2/3/4, Step1):** el estado sigue en el wizard (controlado `value/onChange`) y la validez del paso sale de `editableSchema(...).safeParse`. Convertir los wizards a RHF queda fuera. ¿De acuerdo?
4. **E4 estado por fila:** ¿opción `rowStatus` en la definición, o se retira la columna?
5. **E3/E2 con 2 consumidores:** ¿entran al núcleo ya (excepción a la regla ≥3) o se aplazan a 3c y se decide entonces?
6. **E5 `NumpadModal`** del POS: ¿se conserva como acción de la feature o se reemplaza por el teclado nativo?
7. **TC-056:** añadir "Facturado" y "Recibido" en OC (paridad con hoy).

### 5.6 Decisiones de la Puerta D del lote 3 (2026-10-18)

1. **Partición por separado:** 3a, 3b y 3c, cada uno con su Puerta D. 3c se parte si pasa de 5 entidades.
2. **Tipos unificados:** los tipos locales de línea (`SaleOrderLine`, `PurchaseOrderLine`, `CheckoutLine`, `InvoiceLine`, `NoteLineItem` y los casts en línea) convergen en `OrderLine`, y las superficies reutilizan `orderLineEntity` (con vistas y definiciones editables por contexto).
3. **Los asistentes pasan a react-hook-form + zod dentro del lote** que migra cada uno (invariante #9). La validez del paso sale del resolver.
4. **E4 = opción `rowStatus(row, values)`** en la definición, pintada con `StatusBadge`.
5. **E2 (texto) y E3 (selección que habilita la fila) entran al núcleo** como excepción a la regla ≥3/≥2. Queda registrada en ADR-0087 cuando se implementen.
6. **`NumpadModal` se conserva** como acción de la feature (POS).
7. **TC-056:** se restauran "Facturado" y la etiqueta "Recibido" en la OC.

### 5.7 Resultado del lote 3a — líneas de la ficha + despacho + recepción (2026-10-18)

Rama `refactor/entity-view-lote-3` (desde `refactor/entity-view-lote-2`).

**Núcleo (`components/entity-view`)**
- `core/define-editable.ts` (nuevo): la mitad pura de la superficie editable sale de `surfaces/`.
  - Contiene la definición, los valores iniciales, el schema y el mapeo de errores.
  - Sin dependencia de `@/components/shared`, así una definición evaluada dentro de un ciclo de imports la encuentra inicializada.
- `defineEditable` gana tres opciones:
  - `processed`: el costo unitario ya no cuenta para "al menos una" ni lo borra "Limpiar";
  - `check(row, value)`: regla de dominio dentro del schema;
  - `rowStatus(row, values)`: estado por fila pintado con `StatusBadge`.
- `EditableCollection`:
  - primera columna fija y `focusFirstEditableError()` (ED-5, AX-6);
  - contexto sin cortes de línea y superficie `bg-card`;
  - elegibilidad y campos de contexto memorizados.

**Entidad y extensiones**
- `orderLineEntity` (features/orders) es la entidad única de líneas de OV, OC y factura.
  - Incluye `received`, `invoiced` (progreso), `unitCost`, `receivedQty`, `pending` y `availability` (stock de la bodega elegida, como `status`).
  - Todos sus campos son `sortable: false`: en un documento manda el orden del propio documento.
- Vistas `sale`, `purchase` e `invoice`.
  - **TC-012:** OC sin OT, ahora declarado en `purchase`.
  - **TC-056:** "Recibido" y "Facturado" restaurados.
- `lineEditables.ts`:
  - definiciones `deliveryLinesEditable`, `serviceDeliveryLinesEditable`, `receiptLinesEditable` y `returnLinesEditable`;
  - payloads `toLineQuantities` y `toReceiptLineData`;
  - helpers `hasPartialLines` y `matchesLineType`.
  - Viven junto a la entidad (TDZ en ciclos) y se exportan por el barrel de `orders`.
- `docRef`:
  - el constructor está en `docRef.ts`, sin imports en tiempo de ejecución, y es la primera exportación de `@/features/documents`. Una guarda de contrato lo verifica;
  - el kind se registra al evaluarse el barrel;
  - `fallback` es por fila: una línea sin producto muestra su nombre.

**Pantallas**
- Fichas OV/OC y factura: `DocumentLinesTable` sobre `Collection` (sale `DataTable` + `*LineFields`). Se borran `orderLineFields.tsx`, `invoiceLineFields.tsx` y `OrderLineLinks.tsx`.
- `DeliveryDrawer`:
  - RHF + zod también para las líneas, con el schema en `features/sales/schema.ts`;
  - `EditableCollection` con stock (`useDeliveryStock`, cacheado por producto y bodega);
  - estado por fila;
  - error "Stock insuficiente (n disponibles)" junto a la celda en vez de un toast.
- `ReceiptModal`:
  - RHF + zod, con el schema en `features/purchasing/schema.ts`;
  - modo devolución con tope = recibido, cuando antes usaba el pendiente;
  - sin tope en la recepción: el servidor acepta recibir más de lo pedido y "Excede pendiente" queda como estado.
- Las bodegas vienen de `useWarehouses()` de inventory: se quitan la consulta duplicada y un `as unknown as`.
- `ADHOC_TABLE_ALLOWLIST`: −2 (`DeliveryDrawer`, `ReceiptModal`).

**Defectos del sistema actual encontrados y corregidos**
- **TC-057:** las acciones de la ficha que abren un drawer o modal cerraban la ficha y no abrían nada. Reproducido también con la versión anterior.
  - Corrección de fondo en `components/shared/Drawer.tsx`: un diálogo de un portal hermano no es "fuera".
  - Verificado que el clic fuera sigue cerrando la ficha.
- **TC-058:** las bodegas del despacho leían `.results` de un endpoint sin paginar, así que el selector quedaba vacío y no había stock.
- Pendiente para el usuario: **TC-059** (`BaseModal` crece hasta el ancho del contenido a 390 px).

**Diferencias intencionales frente a la versión anterior**
- La producción avanzada sin OT terminada queda **no elegible** (antes: propuesta y bloqueada por un toast al enviar).
- El despacho total (`dispatch`) se usa solo con `filterType = ALL` y sin líneas parciales. Antes un filtro de servicios podía terminar en despacho total.
- Ni la cantidad recibida ni el costo inicial se redondean hacia arriba (`Math.ceil`): el paso de la cantidad sale de la UoM y el costo parte del valor exacto de la OC.
- "Facturado" se muestra como progreso `n/total`, igual que "Entregado".

**Verificación**
- `tsc` sin errores; `eslint` sin errores en los archivos del lote; vitest 18 archivos y 121 tests (entity-view, contrato, orders, sales, purchasing, documents, billing, inventory), con las stories incluidas.
- App real (servidor de desarrollo; envíos interceptados con `page.route`, sin tocar datos), evidencias en `evidence/lote3a/`:
  - ficha OV-174: antes, "OT" y "Subtotal" quedaban fuera del panel de 705 px; ahora la tabla mide 705/705, sin botones de orden y con el producto como enlace;
  - ficha OCS-10: "Recibido 8/20", "Facturado 8/20", sin OT;
  - despacho:
    - bodega y stock reales; con 5 aparece el error "Máx. 3,00" y el foco pasa a la celda;
    - con 2, "Despacho parcial" y su aviso;
    - payload `{"warehouse_id":2,"delivery_date":"2026-10-18","line_quantities":{"176":2}}`, la misma forma que antes;
  - recepción:
    - costo inicial 900; "Limpiar" conserva el costo y el envío pide "Ingresa al menos una cantidad";
    - con 15, "Excede pendiente";
    - payload `{… "line_data":[{"line_id":11,"quantity":5,"unit_cost":900}]}`;
  - 390 px: el modal de recepción no desborda la página, pero se recorta por dentro (TC-059, previo).

**`/simplify` (4 revisores)**
- Corregido:
  - TC-057 movido al `Drawer` compartido, en vez de un guarda por ficha;
  - `useWarehouses()` compartido;
  - `matchesLineType` y `hasPartialLines` comunes;
  - `nameOf`, `amount` y `unit` compartidos;
  - props muertas (`onCancel`, `filterType` redeclarado);
  - resolver memorizado;
  - elegibilidad y campos de contexto memorizados;
  - tipos sin consumidores fuera del barrel;
  - guarda de contrato del orden de `docRef`.
- Omitido, registrado como deuda:
  - endpoint de stock por lotes (`?product_ids=`) y `quantity_pending` siempre emitido por el serializer (Pd-backend);
  - `sortable` a nivel de entidad (cambio de contrato; hoy es `...fixed` por campo);
  - conversión de fecha con `toISOString` (patrón preexistente en 63 sitios; sin efecto con husos negativos);
  - el cast restante `orderData as unknown as PurchaseOrder` (se va con la unificación de `PurchaseOrderLineAPI` en 3b).

**`/code-review` medium (10 hallazgos)**

Corregidos (8):
1. El stock desconocido (cargando) contaba como 0 y bloqueaba líneas con stock.
   - Ahora el stock desconocido no se valida.
   - El envío espera a que termine la consulta de stock.
   - Tras el primer envío, las líneas se revalidan cuando llega el stock o cambia la bodega.
2. La producción avanzada con `track_inventory` pasaba por el control de stock; antes solo regía la OT terminada. Restaurado.
3. `ReceiptForm` se montaba con la orden cargada pero las bodegas aún no: la bodega por defecto quedaba vacía. Ahora espera a ambas.
4. `Drawer`: la regla de TC-057 bloqueaba también los clics en diálogos que quedan **debajo**. Ahora solo cuentan los montados después (encima).
   - En la app, `openEntity` reemplaza el contenido ("Volver a OV"), así que no hay dos diálogos apilados.
5. Un costo 0 explícito se reemplazaba por el de la OC (`||`). Ahora usa `??` y el test lo fija.
6. El costo inicial se redondeaba hacia arriba (`Math.ceil`, heredado) y se enviaba sin tocar. Ahora parte del costo exacto.
7. El stock se consultaba para todas las líneas visibles. Ahora solo para las que llevan inventario, sin repetir producto.
8. `...fixed` se había colado en los valores `DocRefValue` (reemplazo por regex), y un JSDoc había quedado huérfano. Corregidos.

Sin cambio (registrados):
- `useWarehouses()` sin `enabled`: los dos consumidores solo montan el modal o drawer al abrirlo.
- Dependencia del orden del barrel de `documents`: es deliberada y la fija una guarda de contrato. Romper el ciclo de barrels es trabajo aparte (TC-044).

Verificación posterior:
- `tsc` sin errores; `eslint` sin errores en los archivos del lote.
- vitest 24 archivos y 205 tests (entity-view, contrato, orders, sales, purchasing, documents, billing, inventory, shared).
- App real: despacho y recepción con los mismos resultados y payloads de arriba (costo 900 exacto); el clic fuera sigue cerrando la ficha.

## 6. Replanificación de la Fase 7 (2026-10-18)

### 6.0 Por qué se replanifica

Revisión pedida por el usuario: el objetivo de `AUDIT-PROMPT.md` es **reemplazar** el sistema antiguo y llegar a ≥85 % de colecciones sin código a medida (Puerta B). Tras los lotes 1–3a la medición (V, §6.1) da unos 10 de 82 contextos migrados (~12 %), y el sistema antiguo casi no ha retrocedido (`toColumns` 57 → 55, `renderCard` 43 → 40). Causas (registradas como TC-060):

1. **El lote 3 derivó a asistentes y formularios.** `AUDIT-PROMPT.md` §3 deja fuera formularios y asistentes. La Puerta A los admitió como "caso de uso específico", pero 3b/3c terminaron incluyendo la conversión de asistentes a RHF, la unificación de 8 tipos de línea y capacidades nuevas del núcleo (E1–E4, kinds de input) con excepciones a la regla ≥3/≥2. Ninguna de esas 12 superficies es una lista de entidad.
2. **Trabajo de backend dentro de los lotes** (endpoints de analítica, orden en servidor, `core/analytics.py`). Tiene valor, pero el prompt lo dejaba como *Pendiente-backend* y fue la razón de partir el lote 2 en tres.
3. **Proceso uniforme y pesado**: Puerta D, capturas antes/después, `/simplify` con 4 revisores y `/code-review` por cada lote de ≤5 entidades. Proporcionado para OV/Compras, no para ~25 maestros simples.
4. **El "lote 4+" de la spec (§13.2) nunca se planificó**, y su herramienta principal, `fromLegacyFields()` (`06` §13.1), no se construyó (V: `grep -rn fromLegacyFields frontend` vacío).

### 6.1 Métrica de avance (se reporta al cerrar cada sub-lote, primera línea de `PROGRESS.md`)

```bash
cd frontend && bash scripts/entity-view-progress.sh
```

Línea base del script (2026-10-18, tras la limpieza de la oleada 0): 7 entidades `defineEntity` · **87 pantallas** en el sistema antiguo · 59 `*Fields` · 45 `computed` · 54 `toColumns()` · 43 `AutoEntityCard` · 41 `renderCard` · **146 consumidores** en `LEGACY_CONSUMERS`. El script cuenta también `DataTableView` y `components/`, por eso da 87 pantallas y no las 84 del barrido manual de §6.0.

### 6.2 Reglas de la migración masiva (aprobadas el 2026-10-18)

| # | Regla | Motivo |
|---|---|---|
| M1 | **Paridad primero.** Una pantalla se migra con el comportamiento que tiene hoy. Mejoras de producto, endpoints nuevos y defectos no bloqueantes se registran (TC o issue) y se hacen después. | §6.0 punto 2 |
| M2 | **Nada nuevo en el núcleo** salvo que bloquee ≥3 pantallas de la oleada en curso (regla ≥3/≥2 sin excepciones). Lo demás es kind o sección de la feature. | §6.0 punto 1 |
| M3 | **Backend solo si la paridad lo exige** (p. ej. un campo que falta para la columna que ya existe). El resto, *Pendiente-backend*. | `AUDIT-PROMPT.md` §3 |
| M4 | **Una Puerta D por oleada**, no por sub-lote. Dentro de la oleada, los sub-lotes avanzan sin parar salvo que aparezca una decisión de contrato, de producto o un cambio compartido. | §6.0 punto 3 |
| M5 | **Proceso proporcional.** Oleada A: `type-check` + `lint` + tests del ámbito + una captura por pantalla (1440, y 390 si tiene card); `/code-review` una vez por sub-lote; sin `/simplify` salvo diff grande. Oleadas B–C: el ciclo completo (§ cabecera). | §6.0 punto 3 |
| M6 | **Formularios y asistentes al final** (oleada E), y solo su tabla: convertir un asistente a RHF es trabajo de formularios, fuera de esta migración salvo que la tabla no se pueda migrar sin ello. | `AUDIT-PROMPT.md` §3 |
| M7 | **Al migrar se borra.** El `*Fields` y la entrada de `ADHOC_TABLE_ALLOWLIST` salen en el mismo sub-lote; el ratchet de M8 baja. | `06` §13.2 |
| M8 | **Ratchet de consumidores antiguos** en `entity-view.contract.test.ts`: el número de archivos de §6.1 solo puede bajar. | evita repetir la deriva sin que se note |

### 6.3 Oleada 0 — habilitadores (1 sub-lote corto)

**Estado (2026-10-18):** completada. `fromLegacyFields()` se descartó (§6.12) y se sustituye por la receta de `component-entity-view.md` §10.2; lo ya migrado se alineó con ella (§6.14).
- 3a cerrado (`7ef87d7a7`); TC-059 aplazado.
- Ratchet M8: `lib/__tests__/entity-view.legacy-consumers.ts` (146 archivos) + dos aserciones en `entity-view.contract.test.ts` (ningún consumidor nuevo; cada entrada sigue usando el sistema antiguo). Verificado por mutación: quitar una entrada y añadir una pantalla ya migrada hacen fallar el test.
- Script `frontend/scripts/entity-view-progress.sh`.
- Borrados `features/inventory/inventoryCountLineFields.ts` y `features/accounting/journalEntryFields.ts` (sin importadores; TC-016).
- Verificación: `tsc` sin errores, `eslint` sin errores, test de contrato 17/17.

Plan original:

- Cerrar el 3a: commit del usuario y decisión sobre TC-059.
- Implementar `fromLegacyFields()` (`06` §13.1) con sus tests de tipos; vive en `components/entity-view/core/` y se borra con el último `*Fields`.
- Ratchet M8 y la métrica §6.1 en un script (`frontend/scripts/entity-view-progress.sh`).
- Limpieza sin riesgo (V):
  - `inventoryCountLineFields.ts`: 0 consumidores;
  - `journalEntryFields.ts` duplicado en `app/(dashboard)/accounting/entries/` y `features/accounting/`;
  - `salesOrderFields` y `purchaseOrderFields` solo los usa `ContactDrawer` (las listas ya migraron): se resuelven en la oleada D con `saleOrderEntity`/`purchaseOrderEntity`.

### 6.4 Oleada A — maestros simples (0–1 `computed`, sin hub ni flujo)

Candidatas naturales a `fromLegacyFields()` + revisión a mano. Patrón común: `*ClientView` con `toColumns` + `AutoEntityCard` + `renderCard`.

| Sub-lote | Pantallas (`frontend/features/…`) | `*Fields` (computed) |
|---|---|---|
| **A1 · Inventario y configuración** | `inventory/components/UoMCategoryClientView.tsx`, `WarehouseClientView.tsx`, `CategoryClientView.tsx`, `AttributesClientView.tsx`, `PricingRuleClientView.tsx`, `settings/components/GroupsClientView.tsx`, `UsersSettingsClientView.tsx` | uomCategory (0), warehouse (0), category (1), attribute (1), pricingRule (0), group (0), user (1) |
| **A2 · RR. HH. y POS** | `hr/components/EmployeeClientView.tsx`, `AbsenceClientView.tsx`, `SalaryAdvanceClientView.tsx`, `sales/components/PosTerminalClientView.tsx`, `POSSessionsClientView.tsx`, `purchasing/components/SubscriptionsClientView.tsx` | employee (0), absence (0), salaryAdvance (1), posTerminal (0), posSession (0), subscription (0) |
| **A3 · Maestros de tesorería y contabilidad** | `treasury/components/PaymentHardwareClientView.tsx` (2 vistas), `PaymentMethodClientView.tsx`, `BankCenterClientView.tsx` + `BankCheckingSection`/`BankCreditSection`/`BankLoanSection`, `treasury/credit-lines/CreditLinesClientView.tsx`, `treasury/loans/LoansClientView.tsx`, `accounting/components/AccountsClientView.tsx`, `closures/AccountingClosuresClientView.tsx` | terminalProvider (0), terminalDevice (0), paymentMethod (1), bankCenter (0), creditLine (0), loan (0), account (0), fiscalYear (0) |
| **A4 · Contactos y producción** | `contacts/components/ContactsClientView.tsx`, `production/components/BOMClientView.tsx` | contact (1), bom (1) |

Resultado esperado: −25 archivos de pantalla del sistema antiguo (84 → 59) y −23 `*Fields`. Con la oleada A el avance pasa de ~12 % a ~40 % de los contextos.

### 6.5 Oleada B — documentos con estado/hub (RC1, RC4, RC5)

Reutilizan lo construido en 2b/2c (`docRef`, hub con etiqueta, modos, analítica). Ciclo completo.

| Sub-lote | Pantallas | Nota |
|---|---|---|
| **B1 · Facturación** | `billing/components/SalesInvoicesClientView.tsx`, `PurchaseInvoicesClientView.tsx` | prefijo DTE; NC sin signo de flujo (`02` #3) |
| **B2 · Contabilidad e impuestos** | `app/(dashboard)/accounting/entries/EntriesClientView.tsx`, `tax/components/TaxDeclarationsClientView.tsx` | TC-016 (`journalEntryFields`) |
| **B3 · Inventario documental** | `inventory/components/DocumentsClientView.tsx`, `InventoryDocumentDrawer.tsx`, `InventoryCountClientView.tsx` (lista; la celda editable va a E) | |
| **B4 · Órdenes de trabajo (imprenta)** | `app/(dashboard)/production/orders/WorkOrdersPageClient.tsx` + `WorkOrderKanban`/`WorkOrderTimeline` | kanban y timeline como superficies; la pantalla específica de imprenta (`02` #22). Puerta D propia por tamaño |
| **B5 · Nómina, presupuestos y socios** | `hr/components/PayrollClientView.tsx`, `finance/components/BudgetsClientView.tsx` + `BudgetDetailView.tsx`, `settings/components/partners/PartnersClientView.tsx` | |

### 6.6 Oleada C — tesorería, crédito y stock con flujo/saldo (RC1, RC8)

| Sub-lote | Pantallas |
|---|---|
| **C1 · Movimientos y cuentas** | `treasury/components/TreasuryMovementsClientView.tsx`, `BankMovementsClientView.tsx`, `TreasuryAccountsClientView.tsx`, `TerminalBatchesClientView.tsx`, `treasury/checks/ChecksClientView.tsx` |
| **C2 · Tarjetas** | `treasury/card-statements/StatementsClientView.tsx`, `StatementDetailModal.tsx`, `UnbilledChargesClientView.tsx` |
| **C3 · Crédito y libros** | `credits/components/CreditPortfolioClientView.tsx`, `PortfolioTable.tsx`, `BlacklistClientView.tsx`, `accounting/components/LedgerDrawer.tsx`, `app/(dashboard)/accounting/accounts/[id]/ledger/page.tsx`, `settings/components/partners/PartnerLedgerDrawer.tsx` |
| **C4 · Stock** | `inventory/components/MovementClientView.tsx`, `StockReport.tsx`, `ProductInsightsPanel.tsx`, `ProductInsightsModal.tsx` |
| **C5 · Conciliación (lista)** | `finance/bank-reconciliation/components/StatementsClientView.tsx`, `StatementDetailPanel.tsx` |

### 6.7 Oleada D — listas embebidas de solo lectura

`contacts/components/ContactDrawer.tsx` (4 sublistas; borra `salesOrderFields`/`purchaseOrderFields`), `sales/components/SaleDeliveryDrawer.tsx`, `SaleReturnDrawer.tsx`, `purchasing/components/PurchaseReceiptDrawer.tsx`, `PurchaseReturnDrawer.tsx` (la parte de solo lectura del antiguo 3c), `settings/components/ProfitDistributionDrawer.tsx`, `partners/ProfitDistributionsTab.tsx`, `treasury/loans/LoanRegisterDrawer.tsx`, `LoanDetailModal.tsx`, `orders/components/PaymentHistoryModal.tsx`, `purchasing/components/SubscriptionHistoryModal.tsx`, `app/(dashboard)/settings/audit/AuditPageClient.tsx`, `app/(dashboard)/settings/jobs/JobsView.tsx`, `profile/components/ProfileView.tsx`, `PartnerProfileTab.tsx`, `settings/components/HRSettingsView.tsx`, `pos/components/DraftCartsClientView.tsx`, `components/selectors/AccountSelector.tsx`. Se parte en sub-lotes de ~6 en su Puerta D.

### 6.8 Oleada E — edición dentro de formularios y asistentes (al final)

El antiguo 3b + la parte editable del 3c, y el resto de tablas de edición: `sales/checkout/Step3_Delivery.tsx` (TC-055), `purchasing/checkout/Step4_Receipt.tsx`, `billing/checkout/Step2_Logistics.tsx`, `orders/NoteLogisticsModal.tsx`, `billing/checkout/Step1_Items.tsx`, `notes/steps/NoteStep_LineItems.tsx`, `sales/checkout/Step2_ManufacturingDetails.tsx`, `production/steps/MaterialAssignmentStep.tsx`, `RectificationStep.tsx`, `production/components/BOMManager.tsx`, `finance/bank-reconciliation/*` (`ReconciliationPanel`, `ImportPreviewStep`, `SimulationResults`, `StatementImportModal`, `SplitAllocationDialog`), `finance/components/MappingConfigDrawer.tsx`, `settings/InitialCapitalModal.tsx`, `partners/AddPartnerModal.tsx`, `InventoryCountClientView` (celdas editables). Las decisiones 2–6 de §5.6 siguen vigentes para estas pantallas, pero se reevalúan en su Puerta D a la luz de M2 y M6 (p. ej. convertir el asistente a RHF solo si su tabla lo exige). TC-055 es un defecto vivo: si urge, se corrige como arreglo puntual sin esperar a la oleada.

### 6.9 Fin de la migración

Cuando §6.1 dé 0 pantallas: se borran `entity-fields.tsx`, `AutoEntityCard`, `DataTable` y su familia, `DataCell` y las columnas `createXColumn` que no tengan consumidores, `fromLegacyFields()` y la congelación del sistema antiguo en la invariante #13 (ADR de cierre, invariante #12).

### 6.10 Decisiones para el usuario (Puerta D de la oleada 0/A)

1. ¿Se aprueban la congelación del 3b/3c y el orden 0 → A → B → C → D → E?
2. ¿Se aprueban las reglas M1–M8, en especial la Puerta D por oleada (M4) y el proceso ligero de la oleada A (M5)?
3. ¿TC-055 (UoM en el despacho parcial del POS) se corrige ya como arreglo puntual, o espera a la oleada E?

### 6.11 Decisiones del usuario (2026-10-18)

1. Se aprueban la congelación del 3b/3c y el orden de oleadas 0 → A → B → C → D → E.
2. Se aprueban las reglas M1–M8, incluidas la Puerta D por oleada (M4) y el proceso ligero de la oleada A (M5).
3. TC-055 espera a la oleada E (no se corrige como arreglo puntual).

### 6.12 `fromLegacyFields()`: descartado (decisión del usuario, 2026-10-18)

Al preparar la oleada 0 se midió dónde está el coste real de migrar un maestro (V):

- La **definición** es lo de menos: `uomCategoryFields.ts` tiene 10 líneas y `uom.entity.ts`, 23. Se convierte a mano en minutos con la tabla de `06` §13.1.
- El coste está en la **pantalla**: `UoMCategoryClientView.tsx` tiene 216 líneas (columna de selección a mano, `renderCard`, `DataTableView` con 15 props). `UoMClientView.tsx` migrado tiene 135. El adaptador no toca esa parte.
- Un adaptador en tiempo de ejecución **pierde el tipado** que justifica el sistema nuevo. Las claves antiguas son `string`, así que el resultado sería un `FieldMap<T>` con ids sin comprobar: `views()` y `without()` volverían a aceptar claves inexistentes (la clase de defecto de TC-012, RC8).
- Además mantendría vivo el tipo `FieldDef` antiguo dentro de `components/entity-view/core/`, acoplando el núcleo nuevo al sistema congelado.

**Recomendación:** no construirlo. En su lugar, una **receta de migración de maestro** (tabla de `06` §13.1 para los campos + el patrón de `UoMClientView.tsx` para la pantalla) en el contrato `component-entity-view.md`. Hay que corregir la mención en ADR-0087 (línea 68) y en el contrato (línea 250): es una nota sobre la herramienta de migración, no un cambio de API.

### 6.13 Puerta D de la oleada A · sub-lote A1 (presentada el 2026-10-18)

Barrido propio (`grep` de capacidades por archivo). Todas usan `DataTableView` + acciones `*.auto()` → `*.forCollection()` (ya existe en `components/shared/entity-actions.tsx:136`).

| Pantalla (líneas) | Qué tiene hoy | Qué necesita en entity-view | Riesgo |
|---|---|---|---|
| `inventory/UoMCategoryClientView` (216) | selección + borrado masivo, `renderCard`, búsqueda unificada | igual que `UoMClientView` | bajo |
| `inventory/WarehouseClientView` (230) | selección + masivo, card sin `toColumns` | igual | bajo |
| `inventory/CategoryClientView` (163) | 1 `computed` | un kind existente o `text` con accessor; revisar el `computed` | bajo |
| `inventory/AttributesClientView` (237) | selección + masivo, 1 `computed` | igual que Category | bajo |
| `inventory/PricingRuleClientView` (263) | **5 columnas en línea** (`applies_to`, `condition`, `uom`, `validity`, `value`) | `dateRange` (vigencia), `quantity`/`money`, `text` con accessor; si alguna no cabe, kind de `inventory` | medio |
| `settings/GroupsClientView` (131) | lista simple | trivial | bajo |
| `settings/UsersSettingsClientView` (175) | **paginación en servidor**, columna `contact` en línea, 1 `computed` | `useServerPage` (lote 2) + kind `contact` | medio |

Proceso (M5): `type-check` + `lint` + tests del ámbito + una captura por pantalla (1440, y 390 en las que tienen card) + `/code-review` al cierre. Cada pantalla sale de `LEGACY_CONSUMERS` junto con su `*Fields`.

#### Decisiones de la Puerta D del A1 (2026-10-18)

1. `fromLegacyFields()` se descarta; la receta va en el contrato (§10.2), y **se evalúa si lo ya migrado debe ajustarse a ella** (§6.14).
2. Se aprueba el A1.
3. Se commitea la oleada 0 antes de empezar el A1.

### 6.14 Alineación de lo ya migrado con la receta (2026-10-18)

Revisión de las 7 entidades y las 6 pantallas migradas en los lotes 2a–3a contra la receta.

| Pantalla / pieza | Desvío | Acción |
|---|---|---|
| `inventory/ProductClientView` | **Las 3 consultas de analítica (`useProductAnalytics`) se pedían en cada carga de la lista**, con el panel cerrado. OV y OC ya las condicionaban a la vista (V: `SalesOrdersView.tsx:83`, `PurchaseOrdersView.tsx`) | `useProductAnalytics(params, enabled)`; la pantalla pasa `activeView === "analytics"`. **Corregido** |
| `inventory/ProductClientView` | armado de la analítica dentro de la pantalla (~285 líneas, con JSX) | movido a `productAnalyticsScreen.ts` sin JSX (el `StockReport` llega por `ui.stockReport`). La pantalla pasa de 639 a 376 líneas. **Corregido** |
| `inventory/ProductClientView` | agrupación con un ternario | mapa `PRODUCT_GROUPS`. **Corregido** |
| `sales/SalesOrdersView` | armado de la analítica dentro de la pantalla (~240 líneas) | movido a `saleOrderAnalyticsScreen.ts` (435 → 194 líneas). **Corregido** |
| `purchasing/PurchaseOrdersView` | — | es la referencia del patrón "documento con servidor" |
| `inventory/UoMClientView` | — | es la referencia del patrón "maestro" |
| Entidades `saleOrder`, `saleNote`, `purchaseOrder`, `purchaseNote`, `uom`, `orderLine` | — | conformes |
| `product.entity.tsx` (`productPrice` registrado en el archivo de la entidad) | distinto de `docRef` (builder + archivo del kind) | **sin cambio**: un kind de una sola entidad vive en su `.entity.tsx`; el patrón de `docRef` es para kinds usados desde otras features. La receta recoge las dos formas |
| `ProductClientView`: archivado con 6 `useState` en vez de `useConfirmAction` | no es de entity-view | sin cambio (M1); registrado como deuda de la pantalla |

Verificación:
- `tsc` sin errores; `eslint` sin errores ni avisos en los archivos tocados.
- vitest: contrato + entity-view 71, inventory 10, sales 7, purchasing 3.
- **Sin verificar en la app real:** el servidor de desarrollo estaba fuera de la red (`ssh: No route to host`, ping 100 % perdido). Pendiente: comprobar con el panel cerrado que la lista de Productos no pide `/inventory/products/analytics/`, que su analítica (Resumen, Ventas, Compras, Existencias) se ve igual, y que la de OV también.

### 6.15 Resultado del sub-lote A1 — inventario y configuración (2026-10-18)

Migradas con la receta (§10.2 del contrato). 7 pantallas, 7 entidades, 7 `*Fields` borrados.

| Pantalla | Entidad | Extensiones | Diferencias intencionales frente a la versión anterior |
|---|---|---|---|
| `inventory/UoMCategoryClientView` | `uomCategory.entity.ts` | — | título de la card = nombre (antes la heurística ponía el id); orden inicial por nombre |
| `inventory/WarehouseClientView` | `warehouse.entity.ts` | — | orden inicial por nombre |
| `inventory/CategoryClientView` | `category.entity.tsx` | kind `categoryIcon` (local) + avatar en la card | icono con `DynamicIcon` (antes importaba todo `lucide-react` y casteaba con `as unknown as`); orden por nombre |
| `inventory/AttributesClientView` | `attribute.entity.tsx` | kind `attributeValues` (local, reutiliza `AttributeValuesSummary` con su provider) | orden por nombre |
| `inventory/PricingRuleClientView` | `pricingRule.entity.tsx` | kind `pricingRuleTarget` (local) | 6 columnas en línea → campos; condición, valor y vigencia como texto (pierden negrita/mono); vigencia con fechas formateadas (antes ISO crudo) y "—" si no tiene límites (antes "... a ..."); se mantiene el orden del servidor (`-id`) |
| `settings/GroupsClientView` | `group.entity.ts` (feature `settings`, carpeta nueva) | — | orden por nombre |
| `settings/UsersSettingsClientView` | `user.entity.ts` | dominio `user_role` en `badge-resolvers` (datos, no kind) | rol con etiqueta legible (Admin, Gerente…; antes `ADMIN`); grupos funcionales como chips (2 + "+N"); "Contacto" = "—" sin contacto (antes repetía el nombre); etiqueta única `core.user` (antes `core.user` en la tabla y `settings.user` en la card) |

**Defectos del sistema actual encontrados (corregidos al migrar)**
- **TC-061:** `Category` no declaraba `prefix`, que la API sí envía (`ProductCategorySerializer`); el campo "Siglas" solo funcionaba porque el sistema antiguo aceptaba claves sin comprobar. Añadido al tipo.
- **TC-062:** usuarios: la página no volvía a la primera al cambiar un filtro (`useState` en vez de `useServerPage`), y el cambio de página necesitaba `setPageState as unknown as …`. Corregido con `useServerPage`.
- **TC-063:** categorías de UdM: tras guardar se refrescaba la lista de **UdM**, no la de categorías (`refetch` de `useUoMs` es el de las UdM). Ahora `refetchCategories`; los hooks ganan `isError` (UdM-categorías, almacenes, categorías, atributos, reglas, grupos, usuarios) para el estado de error con "Reintentar".

**Deuda registrada (M1, sin cambio)**
- Almacenes y categorías muestran dos toasts al borrar (el hook y la pantalla).

**Verificación**
- `tsc` sin errores; `eslint` sin errores en los archivos tocados.
- vitest: `lib/__tests__` + `components/entity-view` 130/132; `features/inventory`, `features/settings`, `features/users` 10/10. Los 2 fallos son del ratchet `no-unsafe` (TC-039, issue #177) y están en archivos ajenos al A1 (`salesApi`, `ProfitDistributionDrawer`, `CashMovementDrawer`, `TerminalBatchDrawer`); además se quitan de su baseline `DeliveryDrawer` y `useDeliveryData`, que el 3a dejó sin avisos.
- Avance (`scripts/entity-view-progress.sh`): 14 entidades · 80 pantallas · 52 `*Fields` · 42 `computed` · 48 `toColumns` · 36 `AutoEntityCard` · 132 consumidores.
- **Sin verificar en la app real:** servidor de desarrollo fuera de la red. Pendiente: una captura por pantalla (1440, y 390 con card).

**`/code-review` medium del A1 (8 hallazgos)**

Corregidos (6):
1. **Bucle de reinicio de página** (núcleo): `useEntityCollection` dejaba `autoResetPageIndex` de TanStack activo; con `rows: search.filterFn(...)` (un array nuevo por render) cambiar de página reiniciaba y volvía a renderizar sin fin. Ahora `autoResetPageIndex: false` + página acotada a la última existente (derivado, sin efecto). Test de regresión verificado por mutación.
2. **Error con datos en caché** (núcleo): el estado miraba `error` antes que las filas, así que un refresco en segundo plano fallido tapaba la lista. Ahora las filas ganan. Cambio de contrato → enmienda de ADR-0087 y `component-entity-view.md` §8. Tests de regresión.
3. Categorías de UdM esperaban también a la consulta de UdM (`isLoading` combinado): ahora `isCategoriesLoading`.
4. "Añadir valor" de atributos abría el atributo dos veces (el clic burbujeaba a la fila): `stopPropagation`.
5. Regla de descuento sin porcentaje mostraba "NaN%": ahora "—".
6. Filtro en cliente recalculado en cada render: `useMemo` con `filterFn` (estable) en las 4 vistas.

Sin cambio (registrados como diferencias intencionales):
- "Contacto" sin contacto muestra "—" (antes repetía el nombre, ya visible en "Nombre").
- Categorías de UdM pierden `pageSizeOptions={[10, 20]}`: entity-view no tiene esa opción y añadirla para una pantalla va contra M2.

Verificación posterior: `tsc` y `eslint` limpios en los archivos tocados; vitest `components/entity-view` + contrato 75/75; `features/{inventory,settings,users,sales,purchasing,orders}` 38/38.


### 6.16 Resultado del sub-lote A2 — RR. HH., POS y suscripciones (2026-10-18)

6 pantallas, 6 entidades, 6 `*Fields` borrados (más el export `subscriptionFields` del barrel de purchasing).

| Pantalla | Entidad | Diferencias intencionales frente a la versión anterior |
|---|---|---|
| `hr/EmployeeClientView` | `hr/entity-view/employee.entity.ts` | el banner de error propio se sustituye por el estado de error de la colección; agrupación por estado, tipo de contrato (campo oculto `contractType`) y departamento sobre la lista completa |
| `hr/AbsenceClientView` | `absence.entity.ts` | orden inicial por inicio descendente; se mantiene el `confirm()` nativo al borrar (M1, deuda) |
| `hr/SalaryAdvanceClientView` | `salaryAdvance.entity.ts` | el `computed` de dos líneas (nombre + código) pasa a dos columnas; **las cards ya no se agrupan por fecha** (`cardGroupBy`, 1 solo consumidor → no entra al núcleo, M2); orden por fecha descendente; el monto pierde el tono `warning` |
| `sales/PosTerminalClientView` | `sales/entity-view/posTerminal.entity.ts` | etiqueta única `treasury.terminal` (antes `sales.posterminal` en la card); la card inactiva usa tono `muted` en vez de `grayscale` |
| `sales/POSSessionsClientView` | `posSession.entity.ts` | folio con `formatEntityDisplay("pos.session", { id })` sin `as unknown as`; abrir la fila abre el informe X/Z según el estado (igual que antes) |
| `purchasing/SubscriptionsClientView` | `purchasing/entity-view/subscription.entity.ts` | las 4 tarjetas KPI se componen encima de la colección con `StatCard` (2 consumidores de `kpiCards` → composición, no núcleo); el monto usa la moneda de la suscripción; agrupación por estado y período (campo oculto `period`) |

Hooks con `isError`: `useAbsences`, `useSalaryAdvances`, `usePosTerminals`, `usePOSSessions`, `useSubscriptions` (`useEmployees` ya exponía `error`).

**Incidente (TC-064):** durante el A2 reaparecieron como no rastreados los 9 `*Fields` borrados en los commits de la oleada 0 y del A1, todos con la misma marca de tiempo (18:59:50) y permisos `-rw-------`. Probable origen: una sincronización (mutagen reconfigurado a 192.168.1.86 por el usuario, o el cliente de Nextcloud) que no conocía los borrados. El ratchet `LEGACY_CONSUMERS` lo detectó ("no new file consumes the legacy system"). Se verificó que los 9 eran idénticos a su versión previa en git y se borraron. Hay que revisar la sincronización antes de volver a conectarla.

**Verificación**
- `tsc` sin errores; `eslint` sin errores ni avisos en los archivos tocados.
- vitest: `components/entity-view` + contrato 75/75; `features/{hr,sales,pos,purchasing,inventory}` 31/31.
- Avance: 20 entidades · 74 pantallas · 46 `*Fields` · 41 `computed` · 42 `toColumns` · 30 `AutoEntityCard` · 120 consumidores.
- **Sin verificar en la app real** (servidor sin sincronizar).

**`/code-review` medium del A2 (10 hallazgos)**

Corregidos (3):
1. **TC-065 · Ventas de la sesión POS:** `total_cash_sales + total_card_sales` concatenaba texto (DRF serializa `DecimalField` como string y no hay `COERCE_DECIMAL_TO_STRING`). El sistema antiguo hacía lo mismo y `parseFloat("1000.00500.00")` mostraba solo el efectivo. Ahora suma con `toNumber`; test de regresión.
2. Agrupar inasistencias por tipo mostraba el código (`PERMISO_SIN_GOCE`) en la cabecera del grupo: campo oculto `absenceTypeLabel` sobre `absence_type_display`.
3. El monto de suscripciones con moneda por fila redondeaba USD sin decimales: se vuelve a la paridad (sin `currency`, M1).

Sin cambio (registrados):
- `cardGroupBy` y el estilo del monto/empleado en anticipos: diferencias intencionales ya listadas arriba.
- Sueldo base vacío muestra "—" en vez de $0: regla global R2 del lote 1.
- **TC-066:** la búsqueda "N° Anticipo" filtra en cliente por `display_id`, que `SalaryAdvance` no tiene. Ya pasaba con el sistema antiguo (mismo `filterFn` y misma definición de búsqueda): defecto previo, fuera de la migración (M1).
- `POSSession` se tipa desde el archivo del componente (igual que antes); el tipo de `types/pos.ts` difiere (sin `CLOSING` ni `id_display`), unificarlo es trabajo aparte.
- `forCollection(ctx)` sin memorizar: es el patrón de la referencia (`UoMClientView`); sin medición de coste no se cambia.
- Rejilla de KPI duplicada respecto de `DataTable`: 2 consumidores; se extraerá a `@/components/shared` si aparece un tercero (M2).

Verificación posterior: `tsc` y `eslint` limpios; vitest `components/entity-view` + contrato 75/75; `features/{hr,sales,pos,purchasing}` 22/22.


### 6.17 Resultado del sub-lote A3 — maestros de tesorería (2026-10-18)

8 archivos de pantalla, 9 entidades, 6 `*Fields` borrados. **Dos pantallas de contabilidad salen del A3 como casos específicos** (ver abajo).

| Pantalla | Entidad | Diferencias intencionales frente a la versión anterior |
|---|---|---|
| `treasury/PaymentHardwareClientView` (proveedores y dispositivos) | `terminalProvider.entity.ts`, `terminalDevice.entity.ts` | etiquetas únicas `treasury.terminalprovider` / `treasury.terminaldevice` (antes `treasury.paymentterminal*` en la card, que no existían en el registro) |
| `treasury/PaymentMethodClientView` | `paymentMethod.entity.ts` | icono y tono por tipo con `media.iconFor` / `media.tone`; el `computed` "cuenta + chips Ventas/Compras" pasa a dos campos (`treasuryAccount`, `usage` con chips neutros); ahora muestra el skeleton de carga (antes no pasaba `isLoading`) |
| `treasury/BankCenterClientView` | `bank.entity.ts` | las métricas del resumen (cuentas, tarjetas, cheques, préstamos), que eran hijos opacos de la card, son campos tipados sobre una fila `BankRow` (banco + `summary`) que arma la pantalla; la tabla gana la columna de acciones |
| `treasury/BankCheckingSection`, `BankCreditSection`, `BankLoanSection` | `bankCheckingAccount`, `bankCreditCard`, `bankLoanOverview` (identidad `title`) | colecciones solo de cards (`defaultView="card"`, sin barra) con sección `metrics`; las sumas usan `toNumber` (lección de TC-065); la tarjeta de crédito ya no muestra el nombre de la empresa como subtítulo (viene del contexto, no de la fila) |
| `treasury/credit-lines/CreditLinesClientView` | `creditLine.entity.ts` + `creditLineActions.ts` (nuevo) | los botones "Editar"/"Archivar" en línea (tabla y card) pasan a `createEntityActions` (`ROW_ACTIONS`); el estado lleva su etiqueta (`status_display`); "Uso %" con formato local (`12,5 %`); el skeleton y el error los da la colección y `StaleDataBanner` queda solo con filas en caché |
| `treasury/loans/LoansClientView` | `bankLoan.entity.ts` | igual criterio de carga/error; la fecha de vencimiento usa el formateador común; el saldo insoluto pierde el énfasis en negrita |

**Casos específicos (fuera del A3, decisión del usuario)**
- `accounting/AccountsClientView` (plan de cuentas): **árbol** con subfilas, expandir/plegar y autoexpansión (`getSubRows`, único consumidor). entity-view no tiene filas jerárquicas y la regla M2 impide añadirlas por una pantalla. Aplanarlo con sangría perdería el plegado.
- `accounting/closures/AccountingClosuresClientView`: `DataTableView` solo aporta barra + paginación; cada ejercicio se dibuja con `FiscalYearCard`, un panel interactivo propio (`renderCustomView`). No es una colección de entidad: es una superficie de la feature.

**Verificación**
- `tsc` sin errores; `eslint` sin errores (avisos solo en dependencias de hooks preexistentes).
- vitest: `components/entity-view` + contrato 75/75; `features/{treasury,accounting}` 4/4.
- El ratchet volvió a detectar algo: tres comentarios nuevos mencionaban `createEntityFields` / `AutoEntityCard` (falso positivo); se reescribieron.
- Avance: 29 entidades · 69 pantallas · 40 `*Fields` · 40 `computed` · 37 `toColumns` · 25 `AutoEntityCard` · 106 consumidores.

**`/code-review` medium del A3 (10 hallazgos)**

Corregidos (7 hallazgos en 6 cambios; los dos primeros eran el mismo defecto):
1. **Error con filtro en cliente** (credit lines, préstamos, y el mismo patrón en las 12 vistas de A1–A3 que filtran en cliente): un refresco fallido + un filtro sin coincidencias mostraba "error" en vez de "sin resultados", porque el núcleo ve 0 filas con `error`. Ahora `error: isError && datos.length === 0` con los datos sin filtrar; regla añadida a la receta (`component-entity-view.md` §10.2). `StaleDataBanner` mira los datos sin filtrar.
2. Tasa de préstamo vacía mostraba "—% anual": ahora "—".
3. Métricas de banco sin resumen (bancos archivados, o mientras carga) mostraban 0 como dato real: ahora "—".
4. "Cuotas Rest." mostraba pagadas/total (etiqueta heredada errónea): ahora "Cuotas pagadas".
5. Centro de bancos: el resumen por banco se buscaba con `find` en cada render sobre un `[]` nuevo: `Map` + vacío estable en `useAllBanksOverview`.
6. Archivar una línea de crédito no pedía confirmación (heredado) y ahora queda en el menú junto a "Editar": `useConfirmAction` + `ActionConfirmModal`, como el resto de maestros de tesorería.

Sin cambio (registrados):
- Subtítulo con el nombre de la empresa en las tarjetas de crédito: ya listado como diferencia (viene del contexto, no de la fila).
- Chips "Ventas"/"Compras" sin color: no hay dominio; Productos usa el mismo par neutro. Se decide junto con el resto de chips de disponibilidad.
- **TC-067:** los métodos soportados por un dispositivo se traducen con ids de base de datos fijos (1 → crédito, 2 → débito), heredado de `terminalDeviceFields`. Requiere que el serializer exponga `method_type` (Pd-backend).

Verificación posterior: `tsc` y `eslint` sin errores; vitest `components/entity-view` + contrato y `features/{treasury,accounting,hr,inventory,sales,settings}` en verde.


### 6.18 Filas jerárquicas en el núcleo + plan de cuentas (2026-10-18)

**Decisión del usuario (Puerta D, tras el A3):** añadir filas jerárquicas al núcleo como excepción a la regla ≥3/≥2. Consumidores anunciados: plan de cuentas, cierres contables, estados financieros y otras vistas plegables.

**Núcleo**
- `EntitySpec.tree = { children(row), defaultExpanded? }` (`core/define-entity.ts`, tipo `TreeSpec`).
- `useEntityCollection`: `getSubRows` + `getExpandedRowModel`, estado de expansión (todo abierto por defecto), `paginateExpandedRows: false` solo con paginación en cliente (TanStack expande dentro de su modelo de paginación: con `none`/`server` no habría expansión). `groupBy` se ignora con árbol.
- Tabla: sangría por nivel y botón de plegar (`aria-expanded`, `aria-label` "Expandir/Contraer {valor}") en la primera columna, sin abrir la fila; "Expandir/Contraer todo" en la cabecera de esa columna.
- Contrato `component-entity-view.md` §4 y §10.1; ADR-0087, enmienda "hierarchical rows (tree)".
- Tests (5): árbol abierto con los hijos bajo su padre; plegar una rama sin abrir la fila; contraer/expandir todo; `defaultExpanded: false`; paginación por ramas completas.

**Plan de cuentas** (`accounting/AccountsClientView` → `accounting/entity-view/account.entity.ts`)
- La columna de código escrita a mano (sangría + `IconButton` + `DataTableExpandHeader`) desaparece: la da `tree`.
- Diferencias: el código no es ordenable (el árbol ya viene en orden de código y un orden de texto pondría "1.10" antes de "1.2"); todo el plan en una página (antes `defaultPageSize={500}`); la fila abre la edición (antes solo el menú).
- `useAccounts` expone `isError`. Borrado `features/accounting/accountFields.ts`.

**`/code-review` medium del árbol (10 hallazgos, todos corregidos)**
1. El pie sumaba padres e hijos (subtotales dobles, y cambiaba al plegar): ahora suma solo raíces.
2. La barra masiva buscaba la selección entre las raíces (`rows`): un hijo marcado no llegaba a las acciones. Ahora `flatRows`.
3. Marcar un padre seleccionaba todo su subárbol (`enableSubRowSelection` de TanStack): desactivado.
4. "Expandir/Contraer todo" se quedaba en "Expandir todo" tras reabrir ramas a mano (TanStack exige también las hojas en el mapa): el estado se calcula sobre las filas expandibles.
5. ARIA: `aria-rowcount`/`aria-rowindex` mezclaban raíces y filas planas: se omiten en árbol.
6. `total` contaba solo raíces: ahora todas las filas.
7. La búsqueda del plan de cuentas ofrecía "Agrupar por tipo", que no hace nada en un árbol: quitado de `accountUnifiedSearchDef`.
8. `DataTableExpandHeader` quedó sin consumidores (duplicado por el control del árbol): borrado con su test y su export.
9. El botón de expandir todo se solapaba con el botón de orden de la cabecera: van en una fila flex con separación.
10. Acciones del plan de cuentas recreadas en cada render: `useMemo`.

Tests nuevos: estado del control tras reabrir a mano, suma de raíces con ramas plegadas, selección masiva de hijos sin arrastrar subárboles (verificado por mutación). vitest: entity-view + contrato 83/83, `components/shared` 80/80, `features/{accounting,inventory,treasury}` 14/14.

**Cierres contables: propuesta de diseño pendiente** (ver §6.19). No se migran sin aprobación: pasar de cards a árbol es un rediseño del flujo de cierre, no paridad (M1).

### 6.19 Cierres contables como árbol (aprobado por el usuario el 2026-10-18)

Hoy: una card por ejercicio (estado, progreso "F29 n/12 · Contable n/12", botón "Cerrar Ejercicio") con una cuadrícula de 12 `CombinedPeriodCard` (cada mes: estado contable + estado F29 y hasta 7 acciones en iconos con tooltip).

Propuesta (árbol de una entidad con fila unión `ejercicio | mes`):

```
 ▾ Ejercicio 2026   Abierto   Contable 9/12   F29 8/12              [Cerrar ejercicio] ⋮
     Enero          Cerrado   F29 Cerrado                                              ⋮
     …
     Octubre        Abierto   F29 Declarado   (pagar antes de cerrar)                  ⋮
     Noviembre      —         —                                     [Abrir periodo]
 ▸ Ejercicio 2025   Cerrado   Contable 12/12  F29 12/12                                ⋮
```

- Columnas: Periodo · Estado contable · Estado F29 · Avance (solo años) · acciones.
- Acciones del mes en el menú de fila (`ROW_ACTIONS`): abrir periodo, cerrar/reabrir contable (con la confirmación actual de `useReopenConfirm`), declarar F29, pagar F29, cerrar/reabrir F29, ver comprobante. Las reglas de habilitación de `CombinedPeriodCard` se conservan tal cual (bloqueado por F29, contable cerrado, etc.).
- Acciones del año: las de `fiscalYearActions` (ejecutar cierre / reabrir).
- Se pierde la vista de cuadrícula de 12 meses de un vistazo; se gana orden, teclado, y el mismo patrón que el plan de cuentas y los futuros estados financieros.

### 6.20 Resultado: cierres contables migrados a árbol (2026-10-18)

- **Fila unión** `ClosureRow = ClosureYearRow | ClosureMonthRow` (`accounting/utils/closureTree.ts`): cada ejercicio con sus 12 meses, cada mes con su periodo contable y su periodo F29. `monthState` / `yearState` concentran las reglas que antes vivían en `CombinedPeriodCard` / `FiscalYearCard`.
- **Entidad** `accounting/entity-view/closure.entity.ts` (identidad `title`, `rowId`, `tree`): Periodo · Contable (estado del ejercicio o del mes) · F29 · Cierres contables (n/total) · Cierres F29 (n/total) · Cierre del ejercicio (fecha y usuario).
- **Acciones** `closures/closureActions.ts`: `closureActionList` (función pura, testeada) + `createEntityActions`. Mes: abrir periodo, cerrar/reabrir contable, declarar F29 (deshabilitado con el motivo en la etiqueta), pagar, cerrar/reabrir F29, ver comprobante. Ejercicio: cerrar (deshabilitado hasta que todo esté cerrado) / reabrir.
- Las confirmaciones de reapertura (`useReopenConfirm`) pasan de una por card a una por tipo de periodo en la pantalla. El checklist de cierre contable, el asistente de cierre de ejercicio, el F29 y el pago no cambian.
- **Diferencias:** se pierde la cuadrícula de 12 meses y el botón destacado "Cerrar Ejercicio" (ahora en el menú de la fila); los tooltips de motivo pasan a la etiqueta de la acción deshabilitada.
- Borrados: `FiscalYearCard.tsx`, `CombinedPeriodCard.tsx`, `fiscalYearActions.tsx`, `fiscalYearFields.tsx`.
- Tests: `accounting/utils/__tests__/closureTree.test.ts` (7): 12 meses por ejercicio; reglas de acciones por estado (sin periodo, F29 declarado impago/pagado, F29 cerrado congela el contable, reabrir F29, cierre del ejercicio).

**`/code-review` medium de cierres (10 hallazgos)**

Corregidos (8):
1. **Acción única deshabilitada pero clicable** (compartido, `components/shared/entity-actions.tsx`): con una sola acción visible `createEntityActions` pintaba `DataCell.ActionSingle`, que no tiene estado deshabilitado. "Cerrar ejercicio" se podía pulsar sin estar listo. Ahora una acción única deshabilitada va al menú (que sí respeta `disabled`). Afecta a todas las pantallas; test de regresión verificado por mutación.
2. y 3. La acción única se titulaba "Abrir" en la tabla (el `tableCell` no pasaba el título) y no tenía nombre accesible: ahora usa su etiqueta (o la de `ROW_ACTIONS`) y `ActionSingle` lleva `aria-label`.
4. El motivo de bloqueo ("Bloqueado por cierre F29") había desaparecido: vuelve como acción deshabilitada.
5. Sin indicio de trabajo en curso: la colección recibe `isRefetching` mientras corre una acción.
6. Reabrir ejercicio dejaba una promesa sin manejar: capturada (el error lo informa la mutación).
7. La columna "Contable" mostraba el estado del ejercicio en los años: se llama "Estado".
8. "Declarar F29" usaba la clave `report` (lectura): ahora `post`.

Sin cambio: el doble filtro de estado de `filteredGrouped` (heredado; sin efecto) y las claves de acción repetidas en un menú (las `key` del menú son por índice).

**TC-068:** 3 tests de `WorkOrderWizard` fallan (no encuentran "Crear Orden de Trabajo" / "Gestión de Orden de Trabajo"). Verificado en un worktree en `b04d3927e` (inicio de la sesión): ya fallaban; ajeno a la migración.

Verificación: `tsc` sin errores; vitest por partes de toda la suite: todo en verde salvo `no-unsafe` (TC-039/#177) y `WorkOrderWizard` (TC-068), ambos previos.

### 6.21 Resultado del sub-lote A4 — contactos y listas de materiales (2026-10-18)

2 pantallas, 2 entidades, 2 `*Fields` borrados. Cierra la oleada A.

| Pantalla | Entidad | Extensiones | Diferencias intencionales frente a la versión anterior |
|---|---|---|---|
| `contacts/ContactsClientView` | `contacts/entity-view/contact.entity.tsx` | kind `contactName` (local): nombre + insignias de cliente/proveedor por defecto, con tooltip | RUT formateado en un campo de texto (antes `get` del `*Fields`); "Riesgo" como dimensión de agrupación (campo oculto `riskLevel`); **TC-069**: `credit_risk_level` no estaba en el tipo `Contact` aunque la API lo envía (mismo patrón que TC-061) |
| `production/BOMClientView` | `production/entity-view/bom.entity.tsx` | kind `bomProduct` (local, mismo patrón que `pricingRuleTarget` de inventario) | agrupación por estado sobre la lista completa; `bomActions` pasa de tiparse sobre `BOMListItem` (un alias local) a `BOM`, que ya trae `lines_count`/`total_cost`/`product_code` de la API; **TC-070**: esos 3 campos no estaban en el tipo `BOM` |

Hooks con `isError`/`isCategoriesError` añadidos: `useContacts`, `useAllBOMs` (vía `useBOMs.ts`).

**`/code-review` medium del A4 (1 hallazgo, corregido):** `BOMListItem` (alias local de `BOMClientView.tsx`) quedó redundante con `BOM`, que esta migración ya amplió con `product_code`/`lines_count`/`total_cost`. Se borra el alias y los 2 `as unknown as BOMListItem`; `editingBomData` (tipo `any` del API, preexistente) se castea una sola vez a `BOM | undefined`. Verificación: sin errores nuevos de `/code-review` (confirmó paridad campo por campo contra `contactFields.tsx`/`bomFields.tsx` vía `git show HEAD`).

**Verificación**
- `tsc` sin errores; `eslint` sin errores nuevos (2 avisos preexistentes en `useBOMs.ts`/`BOMClientView.tsx`, confirmados comparando con el stash previo a esta sesión).
- vitest: `components/entity-view` + contrato 83/83; `features/{contacts,production,accounting}` en verde salvo `WorkOrderWizard` (TC-068, previo).
- Avance (`scripts/entity-view-progress.sh`): 33 entidades · 62 pantallas · 36 `*Fields` · 38 `computed` · 33 `toColumns` · 20 `AutoEntityCard` · 98 consumidores.

Oleada A cerrada (A1–A4). Commiteado por el usuario junto con cierres (§6.20) en `d919808b4`.

### 6.22 TC-071/TC-072 — migración `Labeled*` rota por un commit del usuario, corregida (2026-10-18)

El commit `d919808b4` (directo del usuario, en la punta de la rama) barrió la oleada A + cierres junto con una migración propia de antipatrones de formulario (`Form`/`FormField`/`FormLabel`/`FormControl` → `LabeledInput`/`LabeledSelect`/`LabeledCheckbox`/`LabeledContainer`, per [component-input.md](../../20-contracts/component-input.md)) que dejó `CreditLineDrawer.tsx` sin compilar (TC-071). El commit siguiente, `3e1114377` (también directo), rompió además `JournalEntryDrawer.tsx` (TC-072) con el mismo tipo de migración incompleta. El usuario pidió terminarlas yo mismo.

- **TC-071 — `CreditLineDrawer.tsx`:** el cuerpo seguía usando `<FormField>` (ya no importado) en el campo `treasury_account`; además `currency`, `rate_basis` y `auto_renewal` recibían `{...form.register(...)}`, válido solo para `LabeledInput` (input nativo) — `LabeledSelect`/`LabeledCheckbox` envuelven Radix `Select`/`Checkbox` y esperan `onChange(value)`/`onCheckedChange(checked)`, no un `ChangeEvent`; `tsc` no lo marcaba (el tipo `any` de `ChangeHandler` de RHF lo hacía estructuralmente compatible) pero habría roto la selección en runtime. Corregido con `Controller` de `react-hook-form` (mismo patrón que `DeviceDrawer.tsx`) en los 4 campos; quitado el `as const` de las opciones (`readonly [...]` no asignable a `LabeledSelectOption[]`); quitado el import sin uso de `LabeledContainer`.
- **TC-072 — `JournalEntryDrawer.tsx`:** los campos de solo lectura "Estado", "Origen" y "Documento Origen" (×2) pasaban un `<StatusBadge>`/`<Chip>`/`<DocumentRefLink>`/`<span>` como `value` de `LabeledInput`, cuyo `value` es el nativo de `<input>` (no `ReactNode`). Corregido reemplazándolos por `LabeledContainer` (el primitivo del contrato para contenido no-input dentro del notched field) con el JSX como `children`.

Verificación: `tsc --noEmit` limpio en todo el frontend (antes: 10 errores, 6 en `CreditLineDrawer.tsx` + 4 en `JournalEntryDrawer.tsx`); `eslint` limpio en ambos archivos; vitest por partes de la suite relacionada (cierres, contactos, BOM, tesorería, núcleo, `entity-actions`) 60/63 en verde, los 3 restantes son `WorkOrderWizard` (TC-068, previo). Ninguno de los dos drawers tenía test dedicado antes de este cambio.

### 6.23 Puerta D de la oleada B (presentada el 2026-10-18)

Forense por archivo (`*Fields`, patrón de hub/estado, paginación/agrupación, analítica). M5: oleadas B–C usan el ciclo completo (capturas antes/después + `/simplify` + `/code-review` por sub-lote).

| Sub-lote | Pantalla | `*Fields` (computed) | Qué tiene hoy | Qué necesita en entity-view | Riesgo |
|---|---|---|---|---|---|
| **B1 · Facturación** | `billing/SalesInvoicesClientView` | `salesInvoiceFields` (1) | hub (`DomainHubStatus label="billing.invoice"`), `renderCard`, agrupación | `f.hubStatus(entity: "billing.invoice")` — **ya registrado y en producción** en `saleNoteEntity`/`purchaseNoteEntity` (mismo label, dentro de `SalesOrdersView`/`PurchaseOrdersView`); mismo patrón, sin signo de flujo (a diferencia de las notas) | bajo |
| | `billing/PurchaseInvoicesClientView` | `purchaseInvoiceFields` (1) | igual + `DocumentCompletionModal` | igual que arriba | bajo |
| **B2 · Contabilidad e impuestos** | `accounting/entries/EntriesClientView` | `journalEntryFields` (0, con 2 `get()`) | `status` simple (no hub); `origin` = chip con intent derivado de `is_manual`/`reversal_of` (misma lógica que `JournalEntryDrawer` §6.22); `totalDebit` sumariza `items[]` | `f.status` ya soporta intent por fila — no hace falta kind nuevo; cierra TC-016 (duplicado de `journalEntryFields` en `features/accounting/`, ya borrado en la oleada 0) | bajo |
| | `tax/TaxDeclarationsClientView` | `taxPeriodFields` (2) | visual propio "año/mes en caja" con `sortingFn` custom (año, luego mes); `vat_to_pay` con `accessorFn` anidado (`declaration_summary.vat_to_pay`); `payment_status` derivado de `declaration_summary` | kind local `taxPeriod` (un solo consumidor, vive en `tax/entity-view/`); `sortValue` del kind reemplaza el `sortingFn` a mano | medio |
| **B3 · Inventario documental** | `inventory/DocumentsClientView` + `InventoryDocumentDrawer` | `inventoryDocumentFields` (1) | `reference` con 3 ramas: `DocumentRefLink` (hay `source_document`) → `DataCell.Entity` (solo `source_document_type`+`id`) → texto plano | `docRef` — **ya existe** (`features/documents/entity-view/docRef.ts`), cubre la 1ª y 3ª rama (`fallback`); falta confirmar con el tipo/API si la 2ª rama (sin `source_document` completo) todavía ocurre, o es redundante | bajo-medio |
| | `inventory/InventoryCountClientView` (solo la lista; celda editable → oleada E) | — | 595 líneas, agrupación, `renderCard` | separar la lista (esta oleada) de la edición de líneas (E); mismo patrón que `DeliveryDrawer`/`ReceiptModal` (3a) para no migrar la tabla editable dos veces | medio (por tamaño, no por tipo) |
| **B5 · Nómina, presupuestos y socios** | `hr/PayrollClientView` | `payrollFields` (0, con 9 `get()`) | los 9 `get()` son casi todos `parseFloat()` sobre decimales-string de DRF (mismo patrón TC-065) + 3 `status`; panel de analítica propio (`usePayrollAnalyticsData`) | `f.money` con `toNumber()` reemplaza los `parseFloat`; candidato a TC "campo sin tipo" (los `as Record<string,unknown>` sugieren que `Payroll` no tiene `employee_name`/`legal_deductions_worker`/etc., igual que TC-069/070); analítica se extrae a `payrollAnalyticsScreen.ts` (patrón §6.14) | medio |
| | `finance/BudgetsClientView` + `BudgetDetailView` | `budgetFields` (1) | `name` con `<Link>` interno a `/finances/budgets/{id}` (navegación de página, no drawer); `BudgetDetailView` usa `<DataTable>` crudo con columnas en línea (no `createEntityFields`/`toColumns` — no es el mismo patrón que el resto) | `BudgetsClientView`: `f.text` con accessor + `onOpen` seguramente deba seguir navegando a la página (no abrir un drawer), a diferencia del resto de la oleada; `BudgetDetailView`: es una tabla de líneas presupuestarias, más parecida a "lista embebida" (oleada D) que a "documento con hub" — moverla no es obligatorio pero es más consistente con M1 si se trata aparte | medio |
| | `settings/partners/PartnersClientView` | `partnerFields` (0) | columnas de capital/equity con **tono condicional por signo** (positivo=alerta/éxito según el campo, cero=atenuado) vía `className` a mano; panel de analítica propio (`usePartnerAnalyticsData`); 612 líneas | kind local (`settings`/`contacts`) para el tono condicional, o `money` con función de tono — un solo consumidor, no activa M2; analítica se extrae igual que Payroll | medio-alto (tamaño + analítica) |
| **B4 · Órdenes de trabajo** | `production/orders/WorkOrdersPageClient` + `WorkOrderKanban`/`WorkOrderTimeline` | `workOrderFields` (0) | `DataTableView` con columnas en línea (no `toColumns`) + **3 superficies** (tabla, kanban, timeline) | **Puerta D propia, por tamaño** (ya anotado en §6.5) — no entra en esta ronda | — |

**Decisiones de la Puerta D de la oleada B — pendientes de confirmación:**

1. **Orden sugerido:** B1 → B2 → B3 → B5, de menor a mayor riesgo; B4 queda fuera, con su propia Puerta D más adelante.
2. **Proceso M5 (ciclo completo):** para B1–B3 (riesgo bajo/medio, patrones ya probados) propongo mantener el proceso ligero de la oleada A (type-check + lint + tests + una captura por pantalla + `/code-review` al cierre del sub-lote) en vez de capturas antes/después + `/simplify` en cada uno, reservando el ciclo completo de M5 para B5 (más grande, con analítica propia). ¿Se aprueba, o se aplica el ciclo completo a toda la oleada B tal como dice M5?
3. **`BudgetDetailView.tsx`:** ¿se migra junto a `BudgetsClientView` en B5 (como dice el plan original), o se trata como "lista embebida" y se mueve a la oleada D, ya que no comparte el patrón `createEntityFields`/hub del resto de la oleada?
4. Lo demás (kinds locales `taxPeriod` y el de tono condicional de socios, `salesInvoice`/`purchaseInvoice` como entidades separadas pese a compartir el tipo `Invoice`, extracción de analítica de Payroll/Partners) son decisiones técnicas dentro de la receta — se documentan al cerrar cada sub-lote, no requieren aprobación previa.

**Decisiones de la Puerta D de la oleada B (2026-10-18):**

1. Proceso ligero (tipo oleada A) para B1-B3; ciclo completo de M5 (capturas antes/después + `/simplify`) para B5.
2. `BudgetDetailView.tsx` se mueve a la oleada D (lista embebida), no entra en B5.
3. Orden: B1 → B2 → B3 → B5. B4 queda con Puerta D propia.

**Nota (hallada al empezar B1):** fuera de esta migración, `features/accounting/components/JournalEntryDrawer.tsx` está siendo reescrito en paralelo hacia el patrón de ficha documental (`component-document-sheet.md`), delegando a dos archivos nuevos (`JournalEntrySheet.tsx`, `JournalEntryFormDrawer.tsx`). Es trabajo en curso ajeno a esta sesión (imports/hooks faltantes, 22 errores de `tsc` aislados a esos 3 archivos) — no se toca. Esto hace que el baseline de `tsc --noEmit` no esté limpio por una causa ajena a B1; se verifica por archivo/ámbito como con TC-068. Si para B2 (asientos) ese refactor sigue incompleto, se evalúa entonces si bloquea la migración de `EntriesClientView` o si son independientes (la lista no depende de los internos del drawer).

### 6.24 Resultado del sub-lote B1 — facturación (2026-10-18)

2 pantallas, 2 entidades nuevas, 3 archivos borrados (`salesInvoiceFields.tsx`, `salesInvoiceActions.tsx`, `purchaseInvoiceFields.tsx`). `purchaseInvoiceActions.tsx` se conserva (menú de acciones real, no se toca).

| Pantalla | Entidad | Hub | Diferencias intencionales frente a la versión anterior |
|---|---|---|---|
| `billing/SalesInvoicesClientView` | `billing/entity-view/salesInvoice.entity.ts` | `f.hubStatus(entity: "billing.invoice")` — mismo hub ya en producción en `saleNoteEntity` (modo "notas" de `SalesOrdersView`) | **Se borra código muerto**: `notingInvoice`/`payingInv`, `UnifiedNoteWizard`, `PaymentModal`, `annulConfirm`/`forceAnnulConfirm`, `handlePayment` — ninguno era alcanzable (la única acción de fila era "hub"; verificado por `/code-review`, que rastreó el archivo legacy y confirmó que esos *setters* nunca se invocaban). `selection="panel"` + `onOpen` reemplaza el `className` a mano para atenuar filas no seleccionadas. El total pierde el tinte verde fijo (`intent: "success"`) — no existe esa opción en el kind `money`; igual que `saleOrderEntity`/`saleNoteEntity`. Paginación cliente (20), igual que hoy: `/billing/invoices` no pagina en servidor. |
| `billing/PurchaseInvoicesClientView` | `billing/entity-view/purchaseInvoice.entity.ts` | igual | Se conserva el menú completo (detalle/pagar/recibir/completar folio/nota/historial/eliminar/anular) vía `purchaseInvoiceActions.forCollection(actionsCtx)` — solo la lista pasa a `entity-view`, no la lógica de acciones ni los modales/asistentes que abre. Campo `supplier` (contacto, antes texto plano): `/code-review` verificó en `backend/billing/serializers.py` que `partner_id` y `partner_name` comparten la misma cadena de resolución (OV→OC→contacto), por lo que el *fallback* `?? inv.supplier ?? 0` es inalcanzable hoy (no es un riesgo; sigue el mismo patrón ya usado en el archivo para `completingDoc.partner_id ?? completingDoc.supplier`). |

**`/code-review` medium del B1:** 0 hallazgos. Verificó expresamente las dos afirmaciones señaladas (código muerto de Sales, *fallback* de `supplier` en Purchase) contra el código legacy y el serializer del backend; ambas confirmadas seguras.

**Verificación:** `tsc --noEmit` limpio en los archivos de `billing/*` (el baseline general tiene 1 error ajeno — refactor en curso de `JournalEntrySheet.tsx`, nota de arriba); `eslint` sin errores ni avisos en los 7 archivos tocados; vitest `features/billing` + `components/entity-view` 68/68. El ratchet de `LEGACY_CONSUMERS` baja en 4 (las 2 pantallas + los 2 `*Fields.tsx` borrados). **Sin verificar en la app real**: el servidor de desarrollo no respondió (timeout por `curl`, tanto directo como desde el propio host vía `nginx`/`localhost`) y no hay credenciales de demo guardadas (pregunta abierta de `PROGRESS.md`); mutagen sí está conectado y sincronizando.

### 6.25 Resultado del sub-lote B2 — asientos e impuestos (2026-10-18)

2 pantallas, 2 entidades nuevas (una con kind local), 2 archivos borrados (`entries/journalEntryFields.ts`, `tax/taxPeriodFields.tsx`).

| Pantalla | Entidad | Extensiones | Diferencias intencionales frente a la versión anterior |
|---|---|---|---|
| `app/(dashboard)/accounting/entries/EntriesClientView` | `accounting/entity-view/journalEntry.entity.ts` | ninguna (reusa `f.status` para "Origen" en vez de kind nuevo) | Campo "Origen" (Manual/Reversión/Automático con intent propio) pasa de `DataCell.Chip` a `StatusBadge` vía `f.status` con `intent` por fila — cumple la invariante #7 (único renderer de estado autorizado), que el `type:"chip"` legacy no cumplía. Agrupación con tope de `GROUP_ROW_LIMIT` (200, el estándar del núcleo) en vez del tope a mano de 5000 con `toast` propio — mismo tipo de aviso ("demasiados datos"), umbral distinto. Paginación servidor con `useServerPage` (resetea a la página 0 al cambiar filtro/agrupación; el `useState` a mano anterior no lo hacía). |
| `tax/TaxDeclarationsClientView` | `tax/entity-view/taxPeriod.entity.tsx` | kind local `taxPeriod` (un solo consumidor): la caja "año + mes" con orden cronológico propio (`year*100+month`, no alfabético) | La pantalla ahora sí ofrece alternar tabla/card (antes solo renderizaba cards a mano con `renderCustomView`, ignorando el `availableViews:['list','card']` ya declarado para `tax.taxperiod` en `entity-registry.ts`); en card, la caja visual compacta solo se ve en la vista de tabla — el título de card es el período en texto plano. `taxDeclarationActions` pasa de `createEntityActions<unknown, …>` (con casts a mano) a `createEntityActions<TaxPeriod, …>`, tipado real. Sin paginación (como hoy: son pocos períodos). |

**`/code-review` medium del B2:** 0 hallazgos. Verificó expresamente las 4 afirmaciones señaladas: el `intent` por fila de "Origen" lo respeta `StatusBadge`; `useServerPage` resetea por `hashKey` estructural (no por referencia, el `search.filters` sin memoizar no causa resets espurios); `useCollectionViewMode("accounting.journalentry")` sin `defaultView` cae al `viewPolicy.defaultView` del registro ("card"); `vatToPay`/`paymentStatus`/el guard `onOpen` de impuestos son equivalentes byte a byte a la lógica borrada de `taxPeriodFields.tsx`.

**Verificación:** `tsc --noEmit` limpio en los 7 archivos de `accounting`/`tax` tocados (el baseline general tiene errores ajenos — ver nota de §6.23, ahora también en `AccountingPeriodSheet.tsx`/`F29DeclarationSheet.tsx`/`BankStatementSheet.tsx`, mismo refactor de fichas documentales en curso, verificado por archivo); `eslint` sin errores (2 avisos preexistentes sin cambios en `TaxDeclarationsClientView.tsx`, confirmados contra la versión en `c03a9f556`). vitest: `features/billing` 2/2, `features/accounting` + `app/(dashboard)/accounting` 11/11, `components/entity-view` 66/66 (ejecutados por partes — el lote combinado agotó memoria, *exit 137*); `features/tax` no tiene tests dedicados (tampoco los tenía antes). Ratchet `LEGACY_CONSUMERS` baja en 4. Contrato 16/17 — el único rojo es TC-073 (`JournalEntrySheet.tsx`, ajeno). **Sin verificar en la app real** (mismo motivo que B1).

### 6.26 Resultado del sub-lote B3 — documental de inventario (2026-10-18)

3 pantallas, 3 entidades nuevas, 5 archivos borrados (`inventoryDocumentFields.tsx`, `inventoryDocumentDetailFields.tsx`, `inventoryCountFields.ts`).

**Hallazgo de gobernanza (aplica a toda oleada futura con pantallas grandes):** la regla de ESLint `entity-view/no-legacy-presentation` (`eslint-rules/entity-view-guards.mjs`) prohíbe que un mismo ARCHIVO importe `@/components/entity-view` y a la vez `DataTableView`/`AutoEntityCard`/`toColumns`/etc. — no permite migración "parcial" dentro de un archivo, aunque la parte legacy esté deliberadamente diferida (como la celda editable de `InventoryCountClientView`, que va a la oleada E). La regla no estaba documentada en `component-entity-view.md` ni en el plan de oleadas; se descubrió al correr `eslint` sobre B3.

| Pantalla | Entidad | Extensiones | Diferencias intencionales frente a la versión anterior |
|---|---|---|---|
| `inventory/DocumentsClientView` | `inventory/entity-view/inventoryDocument.entity.tsx` | kind local `inventoryDocRef` (un solo consumidor): replica las 3 ramas de `reference` (`DocumentRef` completo → entidad+id sin ref completo → texto) con la forma "objeto crudo" de `DocumentRefLink`, distinta del kind genérico `docRef` (que construye un `{label,id,display}` sintético, no un `DocumentRef` de ADR-0080 con `accessible`/`url`) | `selection="panel"` + `onOpen` reemplaza el `onRowClick` a mano; agrupación con `GROUP_ROW_LIMIT` (200) en vez del tope a mano de 200 con mensaje propio (mismo valor, mecanismo estándar) |
| `inventory/InventoryDocumentDrawer` | `inventory/entity-view/inventoryDocumentDetail.entity.ts` | usa `docRef` (de `@/features/documents`) para el producto de cada línea — aquí sí calza, porque `inventoryDocumentDetailFields.tsx` ya construía un `{label,id,display}` sintético, no un `DocumentRef` crudo | Tabla de líneas (dentro de la ficha ADR-0083, ya migrada) pasa de `<DataTable columns={...toColumns()}>` a `Collection.Root`/`Collection.View` sin selección ni acciones (mismo patrón que `DocumentLinesTable.tsx` de `features/orders`) |
| `inventory/InventoryCountClientView` (solo la lista) | `inventory/entity-view/inventoryCount.entity.ts` | ninguna | **Se separa en dos archivos** por la regla de gobernanza de arriba: `InventoryCountClientView.tsx` (lista, migrada) e `InventoryCountDetailDrawer.tsx` (nuevo — la ficha con la tabla editable de "stock real" por línea, se queda en el sistema legacy hasta la oleada E). El padre pasa `countId`/`open`/`onOpenChange`/`onApplied` al hijo; el estado de edición (`editedLines`) vive en el hijo y se reinicia con un `key` en el padre (no un `useEffect` con `setState` — lo prohíbe `react-hooks/set-state-in-effect`; el `key` cambia solo al abrir un conteo *distinto*, no al cerrar, para no cortar la animación de cierre). Se deduplican dos columnas "Progreso"/"Diferencias" que existían dos veces en la tabla original (una de `inventoryCountFields.toColumns()`, otra añadida a mano con la misma información) y se quita la columna "→" decorativa (el propio sistema ya da la pista visual de fila clicable). |

**`/code-review` medium del B3:** 0 hallazgos. Verificó las 4 afirmaciones señaladas: la lógica del `drawerKey` solo remonta al abrir un conteo *distinto* (nunca al cerrar); las dos convenciones de `DocumentRefLink` son reales y justifican el kind local `inventoryDocRef` (no reusar `docRef`); `inventoryDocumentDetail.entity.ts` sí calza con `docRef` (forma sintética, no un `DocumentRef` crudo); la deduplicación de columnas en `inventoryCountEntity` no pierde funcionalidad (el click-to-open ya lo da `Collection.Root`).

**Verificación:** `tsc --noEmit` y `eslint` limpios en los 11 archivos de `inventory` tocados (0 errores, 0 avisos). vitest: `features/inventory` 10/10, `components/entity-view` 66/66, contrato 16/17 (TC-073, ajeno). Ratchet `LEGACY_CONSUMERS`: −5 (`DocumentsClientView.tsx`, `InventoryDocumentDrawer.tsx`, `inventoryDocumentFields.tsx`, `inventoryDocumentDetailFields.tsx`, `inventoryCountFields.ts`) +1 (`InventoryCountDetailDrawer.tsx`, archivo nuevo que hereda la tabla editable) = −4 neto. **Sin verificar en la app real** (mismo motivo que B1/B2).

### 6.27 Resultado del sub-lote B5 — nómina, presupuestos y socios (2026-10-19)

Cierra la oleada B. 3 pantallas, 3 entidades nuevas, 3 `*Fields` borrados. Ciclo completo (M5, decisión de la Puerta D de la oleada B): `/simplify` (4 revisores) + `/code-review`, sin capturas (servidor de desarrollo inalcanzable toda la sesión).

**Incidente de concurrencia:** un barrido paralelo del usuario de "armonización de componentes reutilizables" (`d95749aa8 refactor: consolidate UI components across settings views`) hizo `git add -A` sobre el working tree en un momento en que mis archivos nuevos (`payroll.entity.ts`, `budget.entity.ts`, `partner.entity.tsx`, `payrollAnalyticsScreen.ts`) estaban sin trackear — ese commit los absorbió (se conservan intactos) — pero mis ediciones a archivos ya trackeados (`PayrollClientView.tsx`, `BudgetsClientView.tsx`, sus hooks, `types/hr.ts`, el ratchet) habían vuelto a su estado previo a mi edición en ese momento, y el commit capturó esa reversión como definitiva. Ese mismo commit corrigió, de forma convergente e independiente, 5 de los 8 campos que yo había agregado a `Payroll` (mismo hallazgo de tipo incompleto). Se rehicieron las 2 pantallas y se completaron los 3 campos restantes de `Payroll`; verificado y commiteado de nuevo en `bd857b5ec` antes de continuar con Partners.

| Pantalla | Entidad | Extensiones | Diferencias intencionales frente a la versión anterior |
|---|---|---|---|
| `hr/PayrollClientView` | `hr/entity-view/payroll.entity.ts` | ninguna | Los 9 `get()` del `*Fields` borrado eran casi todos `parseFloat()` sobre decimales-string; `f.money` ya acepta el string crudo (`Numeric` admite `DecimalString`), sin `parseFloat` a mano. Confirmado contra `backend/hr/serializers.py`: 6 de los campos que usaban esos `get()` (`legal_deductions_worker`, `employer_contribution`, `other_deductions`, `advances_total`, `previred_paid_status`, `total_previred`) no estaban en el tipo `Payroll` — se agregan. El armado de analítica (375 líneas, sin JSX) se extrae a `payrollAnalyticsScreen.ts` (mismo patrón que `saleOrderAnalyticsScreen.ts`). |
| `finance/BudgetsClientView` | `finance/entity-view/budget.entity.ts` | ninguna (corregido en `/simplify`: `period` pasa de interpolar un string a mano a `f.dateRange`, el kind del núcleo para exactamente este caso) | `onOpen` ahora navega toda la fila a `/finances/budgets/{id}` (antes solo el `<Link>` del nombre lo hacía) — mismo destino que la acción "Ver Ejecución" ya existente; no es una capacidad nueva, solo hace clicable toda la fila. |
| `settings/partners/PartnersClientView` | `settings/entity-view/partner.entity.tsx` | kinds locales `partnerName` (contacto + insignia de "exceso de capital") y `partnerBalance` (dinero con tono condicional por signo y "guion si cero" — parametriza exactamente lo que varía entre sus 4 usos: `pendingCapital`, `provisionalWithdrawals`, `earningsBalance`, `dividendsPayable`) | Se borra la duplicación real que tenía `partnerFields.ts` (el mismo `className`/`showZeroAsDash` repetido 4 veces); `/code-review` verificó que `partnerBalance` no sea una reinvención de `money`/`flow` del núcleo (ninguno cubre tono condicional por signo). El banner de error manual (`{error && <div>...</div>}`, con la tabla igual renderizada) se reemplaza por el estado de error estándar de `Collection` — el núcleo ya prioriza las filas en caché sobre un refresco fallido (ADR-0087), igual que toda otra pantalla migrada; no es un workaround nuevo de esta pantalla. |

**`/simplify` (4 revisores en paralelo):** 3 hallazgos reales corregidos — `budget.entity.ts` usaba interpolación de string en vez de `f.dateRange`; 2 campos especulativos sin consumidor en `types/hr.ts` (`previred_paid_amount`, `remuneration_paid_amount`) se borran; un fragmento JSX duplicado en `PartnersClientView.tsx` se iza a una variable; `PartnerBalanceCell`/`PartnerNameCell` reparseaban el mismo string a número dos veces (ahora reusan el valor ya parseado). 2 hallazgos de eficiencia menores (deps más anchas del `useMemo` del analytics screen; botonera de toolbar sin memoizar) se descartan: coinciden con el patrón ya establecido (`saleOrderAnalyticsScreen.ts` hace exactamente lo mismo) y el costo es insignificante (24 puntos de datos; un botón).

**`/code-review` medium del B5:** 0 bugs de corrección (verificó expresamente el destino de `onOpen` en Budgets, la compuerta de `error` de Partners con un primer-load real, la paridad de las 4 columnas `partnerBalance` contra `partnerFields.ts`, y el tipado de las 3 `.forCollection(ctx)`). 2 hallazgos no bloqueantes: TC-074 (mensaje de error genérico, defecto sistémico de `Collection`, no de este sub-lote) y TC-075 (falso positivo descartado: `partnerBalance` no reinventa nada — los 5 archivos citados usan `media.tone`, una opción de card distinta, no una opción de un kind de dinero).

**Verificación:** `tsc --noEmit` 0 errores en todo el proyecto; `eslint` 0 errores/avisos en los 15 archivos de `hr`/`finance`/`settings`/ratchet tocados. vitest: `components/entity-view` 82/83 (TC-073, ajeno). **Sin verificar en la app real** (servidor de desarrollo inalcanzable toda la sesión — ver nota de B1).

Cierra la oleada B (B1-B3, B5; B4 queda con Puerta D propia por tamaño, §6.5).

### 6.28 Puerta D de la oleada C (presentada el 2026-10-19)

Forense por archivo (`*Fields`, hooks, patrones ya en uso). Oleada más grande hasta ahora: 20 archivos, ~6000 líneas. M5 dice ciclo completo para B-C, pero dado el tamaño propongo ajustar el proceso por sub-lote (ver decisiones).

| Sub-lote | Pantalla (líneas) | `*Fields` (computed) | Qué tiene hoy | Riesgo |
|---|---|---|---|---|
| **C1 · Movimientos y cuentas** | `treasury/TreasuryMovementsClientView` (471) | `movementFields.ts` (0) | Analítica propia (dirección IN/OUT); comparte el hook `useTreasuryMovements` con `BankMovementsClientView` (145, mismo `movementFields`) — una sola entidad, dos pantallas (la de banco es un recorte por `bankId`, igual que `documentTypeFilter` en B3) | medio |
| | `treasury/TreasuryAccountsClientView` (260) | `accountFields.tsx` (1) | — | bajo |
| | `treasury/TerminalBatchesClientView` (170) | `terminalBatchFields.tsx` (2) | — | bajo |
| | `treasury/checks/ChecksClientView` (190) | `checkFields.tsx` (1) | — | bajo |
| **C2 · Tarjetas** | `treasury/card-statements/StatementsClientView` (544) | `cardStatementFields.tsx` (0) | la más grande de C2 | medio |
| | `treasury/card-statements/StatementDetailModal` (156) | `statementChargeFields` (`toColumns` + `DataTableView`, sin `Collection`) | tabla embebida de cargos dentro de un modal — mismo patrón "líneas de documento" de B3 | bajo |
| | `treasury/card-statements/UnbilledChargesClientView` (610) | `unbilledChargeFields.tsx` (0) | la más grande de la oleada entera | medio-alto (tamaño) |
| **C3 · Crédito y libros** | `credits/CreditPortfolioClientView` (209) | `creditContactFields.tsx` (0) + `creditHistoryEntryFields.tsx` (0) | lista + historial embebido | medio |
| | `credits/PortfolioTable` (164) | `creditLedgerEntryFields.tsx` (0, `toColumns`+`<DataTable>`) | tabla de libro auxiliar embebida | bajo |
| | `credits/BlacklistClientView` (270) | `blacklistFields.ts` (0) + `creditLedgerEntryFields.tsx` (**el mismo que `PortfolioTable`**) | — | bajo |
| | `accounting/LedgerDrawer` (313) | `ledgerMovementFields.tsx` (1, `toColumns`+`<DataTable>`) | libro auxiliar de una cuenta contable | bajo |
| | `app/.../accounts/[id]/ledger/page.tsx` (121) | sin `*Fields` propio (`<DataTable>` con columnas en línea) | página de libro auxiliar (¿duplica `LedgerDrawer`?) | medio (a confirmar) |
| | `settings/partners/PartnerLedgerDrawer` (172) | `partnerLedgerFields` (`toColumns`+`<DataTable>`) | libro auxiliar de un socio | bajo |
| **C4 · Stock** | `inventory/MovementClientView` (375) | `stockMoveFields.tsx` (0) | — | medio |
| | `inventory/StockReport` (228) | `stockReportFields.ts` (2) | orquesta `ProductInsightsPanel` y `ProductInsightsModal` | medio |
| | `inventory/ProductInsightsPanel` (697) | sin `*Fields` (4-5 `DataTableView`/`DataTable` embebidas: historial de precio, de costo, uso en producción, ventas) | la pieza más fragmentada de la oleada; consumida por `ProductClientView` y `StockReport` | alto (tamaño + fragmentación) |
| | `inventory/ProductInsightsModal` (514) | sin `*Fields` (3 `<DataTable>` embebidas) | implementación independiente de `ProductInsightsPanel` (no es un envoltorio), consumida por `StockReport` | alto (tamaño + ¿solapa con el Panel?) |
| **C5 · Conciliación (lista)** | `finance/bank-reconciliation/StatementsClientView` (379) | `statementFields.tsx` (2) | — | bajo |
| | `finance/bank-reconciliation/StatementDetailPanel` (373) | sin `*Fields` (`<DataTable>` con columnas en línea) | panel de detalle, probablemente embebido | medio |

**Patrón repetido en C3 — 4 "libros auxiliares" casi idénticos** (`PortfolioTable`, `LedgerDrawer`, `app/.../ledger/page.tsx`, `PartnerLedgerDrawer`), cada uno con su propia tabla embebida (`toColumns`+`<DataTable>` o columnas en línea) para mostrar movimientos de una cuenta/socio/cliente. `PortfolioTable` y `BlacklistClientView` ya comparten literalmente el mismo `creditLedgerEntryFields.tsx`. Candidato claro a un componente compartido único (tipo `DocumentLinesTable.tsx` de `features/orders`, que ya resolvió el mismo problema para líneas de documento) en vez de migrar 4 tablas casi iguales por separado.

**Decisiones pendientes de la Puerta D de la oleada C:**

1. **Proceso por sub-lote:** propongo ligero (tipo oleada A) para C1, C3 y C5 — patrones ya probados, `*Fields` simples o inexistentes; ciclo completo (M5, capturas + `/simplify` + `/code-review`) para C2 (`UnbilledChargesClientView`, 610 líneas, la pantalla más grande) y C4 (`ProductInsightsPanel`/`Modal`, fragmentación alta). ¿Se aprueba, o se aplica el mismo criterio a toda la oleada C?
2. **Libro auxiliar compartido (C3):** ¿se construye un componente único de "tabla de libro auxiliar" (reemplazando las 4 implementaciones casi idénticas) antes de migrar C3, o se migra cada pantalla por separado primero y se consolida después?
3. **`app/.../accounts/[id]/ledger/page.tsx` vs. `LedgerDrawer.tsx`:** a confirmar si la página es una ruta antigua que debería redirigir a la ficha documental (como pasó con otras páginas-duplicadas de esta migración) o si sirve un propósito distinto (ej. acceso directo por URL/impresión).
4. **`ProductInsightsPanel` vs. `ProductInsightsModal` (C4):** ambos están en uso real (no es código muerto) pero implementan la misma idea por separado. ¿Se migra cada uno tal cual (duplicando el trabajo), o esto amerita su propia Puerta D más chica — como B4 — para decidir si se consolida en un solo componente antes de migrar?
5. **Orden:** propongo C1 → C3 → C5 → C2 → C4 (de menor a mayor riesgo/tamaño, dejando C4 al final dado que puede necesitar su propia Puerta D).

**Decisiones de la Puerta D de la oleada C (2026-10-19):**

1. Ciclo completo (M5) en toda la oleada C, no solo en C2/C4 — capturas antes/después + `/simplify` + `/code-review` por sub-lote.
2. C3: se construye un componente único de tabla de libro auxiliar (tipo `DocumentLinesTable.tsx`) antes de migrar las 4 pantallas que lo necesitan, en vez de migrar cada una por separado y consolidar después.
3. C4 (`ProductInsightsPanel`/`ProductInsightsModal`): Puerta D propia, como B4 — no entra en esta ronda.
4. Orden: C1 → C3 → C5 → C2 (C4 aparte, con su propia Puerta D).

