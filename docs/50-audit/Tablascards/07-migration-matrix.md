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

