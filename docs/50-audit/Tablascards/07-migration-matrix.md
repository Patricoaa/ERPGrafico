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
| 2 | Compras (órdenes + notas), OV, UoM, Productos | — |
| 3 | Líneas de documento + edición por lote P1 | — |
| R6 | ADR de color (contraste warning/success) | aparte |

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

## 3. Matriz por entidad

| Entidad | Pantalla | Antes | Después | Extensiones | Diferencias | Tests | Resultado | Deuda |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

(Se llena desde el lote 2.)
