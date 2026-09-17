---
layer: 50-audit
doc: design-system-ui-audit
status: active
owner: frontend-team
last_review: 2026-09-16
---

# Auditoría UI del Design System — ERPGrafico

> Ejecutada con `/design-consultation` (2026-09-16). Documenta la deuda estructural de la capa de UI: sobreingeniería, reimplementaciones ad-hoc, oportunidades de centralización y simplificación. **No modifica contratos** — es la base para decidir qué refactors (con sus ADR) se ejecutan. Lee antes: [DESIGN.md](../../DESIGN.md), [component-decision-tree.md](../20-contracts/component-decision-tree.md).

## 1. Resumen ejecutivo

El design system es sólido y consistente: DESIGN.md + contratos Capa-20 vivos, invariantes claves cumpliéndose. La deuda está en **peso estructural** y **duplicación**, no en desorden ni en violaciones masivas de gobernanza.

**Qué se cumple (verificado, cero violaciones):**

- 0 `useQuery` / `useMutation` directos en componentes de features (todos vía `features/*/hooks`).
- 0 imports de `@/lib/api` en componentes/páginas.
- 0 colores raw de la escala de Tailwind (`bg-red-500`, `text-blue-600`, …).
- KPI cards y page headers: todos usan `StatCard` / `PageHeader` / `PageSectionHeader`.

**Deuda estimada:**

- ~5,000 líneas de UI duplicada entre features (pares de componentes casi idénticos).
- ~3,000 líneas de mecanismo sobre-ingenierizado en `components/shared` (DataTable family, GenericWizard, ActionDock).
- Usos de tintas CMYK (censo verificado 2026-09-16: `Cart.tsx`=6, `LedgerDrawer.tsx`=15, `POSApprovalCard.tsx`=1 —botón de acción—, `BankAccountsSection.tsx`=4, + emisores en shared `Badge`/`TabBar`/`DataTableCells`): la mayoría es **superficie de marca Layer-1** (botones de `Cart.tsx`, texto sobre gradiente de tesorería, chips categóricos) — legítima, se documenta; los estados de `POSApprovalCard` ya usan intents (`text-success`/`text-warning`); solo `LedgerDrawer` (Debe/Haber/Saldo) vive bajo **metáfora de sabor** mantenida explícitamente (§8.2, resuelto en eng review 2026-09-16; nunca `destructive`).
- 91 archivos (censo 2026-09-17) que reimplementan `animate-in fade-in` inline en vez de usar el `FadeIn` compartido.

**Prioridad por ROI (detalle en §8):** limpieza segura → violaciones shared→feature → fusión de duplicados de features → refactors grandes de shared.

## 2. Metodología

- **Alcance:** `frontend/components/shared` (~129 archivos), `frontend/components/{ui,layout,selectors}`, `frontend/features/**` (406 TSX / 394 TS), `frontend/hooks`, `frontend/lib`.
- **Criterios de sobreingeniería:** componentes >400 líneas o >15 props; múltiples pipelines de render en un archivo; abstracciones con cero consumo; mecanismos excesivos para el tamaño del componente.
- **Criterios ad-hoc:** reimplementaciones de `BaseModal`/`Drawer`/`ActionConfirmModal`/`StatusBadge`/`EmptyState`/`SkeletonShell`/`DataTable`; respuestas de gobernanza (invariantes 2, 5, 7).
- **Detección de código muerto:** grep de consumos fuera del barrel y del propio archivo.

## 3. Sobreingeniería (peso estructural)

| Componente | Líneas | Props | Problema | Simplificación propuesta |
|---|---|---|---|---|
| `components/shared/DataTable.tsx` | 996 | ~56 | 5 pipelines de render (loading, minimal, compact CSS-grid, embedded, classic) en un componente; toolbar duplicado x4; filas `<TableHeader>/<colgroup>/<TableBody>/<EmptyState>` copia-pega entre ramas | Extraer `DataTableCompact` (~90 líneas), `DataTableLoading`/`DataTableEmpty` como hojas; split `DataTableCoreProps` (≤15) + `DataTableFeaturesProps`; un solo slot `renderToolbar` |
| `components/shared/DataTableCells.tsx` | 1021 | 23 células | `textTransform` y `letterSpacing` con **0 usos** en todo el repo (`TEXT_TRANSFORM_MAP`/`LETTER_SPACING_MAP` muertos); 23 pipelines de estilo casi idénticos | Borrar props/maps muertos; helper único `resolveCellClasses(variant, {size, intent, weight})`; split por dominio (dates, currency, status, actions) |
| `components/shared/DataTableToolbar.tsx` | 299 | 11 | Bloque "Acciones" (dropdown + create + reset + column toggle) implementado **dos veces** (rama unified-search L122–160 y rama default L257–289); column toggle existe en 2 UIs (inline + `DisplaySection` de UnifiedSearchBar) | Extraer `ToolbarActionsCluster` y renderizarlo en ambas ramas; eliminar la rama legacy si UnifiedSearchBar ya es el estándar |
| `components/shared/ActionDock.tsx` | 166 | 3 | `MutationObserver` (L24–40) que escucha atributos `data-hub-open`/`data-inbox-open` en `body` + offsets mágicos `left-[calc(50%-340px)]` etc. para recentrar un dock de 3 props; ~2 consumidores reales | Posicionar por layout (el layout ya conoce los anchos de los paneles) o renderizar dentro del árbol que conoce los paneles; eliminar observer y offsets. DataTable lo consume vía `dockNode` |
| `components/shared/GenericWizard.tsx` | 321 | 16 + heredados | Doble superficie `surface: "modal" \| "drawer"` (2 pipelines completos + 2 del éxito); `touchMode` (L41) como flag booleano con "CSS salad" (`h-12`, iconos grandes, `gap-4`) para POS; `sizeMap` propio duplicando Dialog/Drawer; orquestación de estado de pasos (3 effects) dentro del shell "genérico" | Default `surface="modal"` + `WizardDrawer` delgado; reemplazar `touchMode` por `variant: "desktop" \| "touch"` o wrapper `PosWizard`; mover estado de pasos a hook `useWizardState` |
| `components/shared/DataTableView.tsx` | 268 | ~50 heredados + 12 propios | Extiende `Omit<DataTableProps, 6>` (enreda todo el surface de 56 props) y añade view/card/group/analytics; trae `AnalyticsPanelContent` a la grafo de dependencias; `cardGroupBy` está `@deprecated` (L42) y sigue en la API pública | Componer en vez de heredar: DataTableView consume DataTable con lista curada de props; mover card-view a `lib/view-helpers.ts`; borrar `cardGroupBy` |
| `components/shared/EntityCard.tsx` + `AutoEntityCard.tsx` | 725 + 465 | ~15 subcomponentes | `EntityCard.Hero` **muerto (0 consumidores)**; `actions` deprecated (L218) aún activo; subcomponentes especulativos (Dashboard, Metrics, WorkflowBody, HubTrigger) fuera de su único consumo (AutoEntityCard); `Badge` re-importado del barrel (L7) contribuyendo a circularidad | Borrar `.Hero` y el prop `actions`; mover `.Metrics`/`.Dashboard`/`.WorkflowBody`/`.HubTrigger` a sus 1–2 consumidores; simplificar el config de 4 callbacks de AutoEntityCard |
| `components/shared/ProductSelector/` (carpeta) | ~840 en 6 files | 13 | **No es un duplicado**: es una grid controlada multi-producto (props `products`/`categories`/`searchTerm`/`onProductClick`/`priceRenderer`/`selectedProductIds`), distinta e incompatible con `components/selectors/ProductSelector.tsx` (413L, picker popover de valor único `value`/`onChange`/`productTypes`/`excludeIds`, con test suite). Colisiona en nombre, vive en shared e importa internos de features (ver §3.1); 2 consumidores vs 12 del otro | Renombrar `shared/ProductSelector` → `ProductGridPicker` y reubicarlo en `components/selectors` (único destino válido: la "feature dueña" rompería imports cross-feature, invariante 3 — verificado en eng review 2026-09-16); `selectors/ProductSelector` queda como el único `ProductSelector`. La reubicación renombra 2 imports de consumidores (`CostCalculatorDrawer`, `ProductSelectionStep`) |
| `components/shared/index.ts` (barrel) | 173 | — | Re-exporta ~140 módulos; **40 archivos shared importan de su propio barrel** (`DataTable.tsx:32` importa 9 nombres de sí mismo; conteo verificado 2026-09-16) — red circular que el barrel esconde | Codemod a imports relativos dentro de `components/shared`; no publicar en barrel componentes con <3 consumidores (ergonomía sobre completitud) |
| Sistema de variantes (BaseModal/Drawer/PanelHeader) | 163/333/133 | — | Cada caso nuevo crea una dimensión nueva (`touchMode`, `surface`, `density`) en `PanelBaseProps` en vez de componer sobre el base | Congelar la matriz de variantes; superficies nuevas = componentes delgados compuestos sobre `PanelBase` |
| `components/shared/FormLineItemsTable.tsx` + `AccountingLinesTable.tsx` | 235 + 193 | 12 | Shell delgado (~13 líneas de JSX reales) con ~40 líneas de doc block; segunda capa de wrapper (`AccountingLinesTable`) para ~5 consumidores | Recortar doc a <30 líneas; colapsar wrapper en los 3 call sites que difieren o como variante opcional |

### 3.1 Violaciones shared→feature (capa compartida importando features)

| Archivo shared | Importa | Impacto |
|---|---|---|
| `components/shared/FolioValidationInput.tsx:9` | `@/features/pos/components/NumpadModal` | La capa compartida depende del módulo POS; `NumpadModal` (81L: Numpad+BaseModal, 4 consumidores) debe promoverse a `components/shared/NumpadModal.tsx` |
| `components/shared/ReportTable.tsx:17` | `LedgerDrawer` de `@/features/accounting` | Compartir un componente que arrastra el ledger contable a su grafo de dependencias |
| `components/shared/ProductSelector/CategoryFilter.tsx` | `@/features/inventory` (x2), y `VariantSelectorModal`, `ProductGrid`, `ProductSelector` internos importan `@/features/pos` | Carpetas shared que dependen del dominio. **Resuelto por reubicación** del grid (rename `ProductGridPicker` → `components/selectors`); los 2 imports de consumidores se renombran (eng review 2026-09-16) |

## 4. Reimplementaciones ad-hoc (componentes que ya existen en shared)

### 4.1 Modales crudos / overlays hand-rolled

| Archivo | Líneas | Reimplementa | Fix |
|---|---|---|---|
| `features/tax/components/F29CloseModal.tsx` | 39–62 | `BaseModal` | `<BaseModal open title>` + `FormFooter` |
| `features/treasury/credit-lines/CreditLineDrawer.tsx` | 145–323 | `Drawer` | `Sheet`/`SheetContent` → `Drawer` compartido |
| `features/accounting/hooks/useReopenConfirm.tsx` | 53–81 | `ActionConfirmModal` | Reemplazar todo el bloque `AlertDialog` |
| `features/production/components/steps/ManufacturingConfigStep.tsx` | 556–572 | `ActionConfirmModal` | ídem |
| `features/production/components/steps/ManufacturingConfigSummary.tsx` | 521–539, 544–560 | `ActionConfirmModal` (x2) | ídem |
| `features/inventory/components/InventoryCountClientView.tsx` | 522–547 | `BaseModal` | guard de `onPointerDownOutside` → BaseModal |
| `features/pos/components/CartItem.tsx` | 345–370 | `BaseModal` | UoM picker en `BaseModal` o reusar `VariantSelectorModal` |

### 4.2 Overlays de POS hand-rolled (a mano)

| Archivo | Líneas | Problema |
|---|---|---|
| `features/pos/components/SessionControl.tsx` | 265–297 | `fixed inset-0 bg-overlay/50` + `animate-in zoom-in-95` para el reporte X/Z |
| `features/sales/components/POSSessionsClientView.tsx` | 151–171 | Mismo overlay X/Z duplicado (tercera copia del scaffolding) |
| `features/pos/components/POSClientView.tsx` | 554–571 | `fixed inset-0 bg-background/60` + Card para el lock "Sesión Cerrada" |

### 4.3 Duplicados de alto costo (pares casi idénticos)

| Par | Líneas | Evidencia | Fix |
|---|---|---|---|
| `features/settings/components/TerminalDrawer.tsx` vs `features/sales/components/PosTerminalDrawer.tsx` | 419 + 400 | Mismas props (`terminal`, `mode`, `onSuccess`), mismos hooks (`useDrawerIdentity`, `usePrintableDrawer`), mismo shell `Drawer` | Promover UNO (p. ej. `PosTerminalDrawer`) a drawer de entidad y re-exportar desde el otro barrel |
| `features/inventory/components/product/VariantQuickEditForm.tsx` vs `BulkVariantEditForm.tsx` | 531 + 432 | Ambos `createPortal`, mismas opciones de herencia de precio (`ALL_PRICE_INHERITANCE_OPTIONS`/`INHERIT_ONLY_OPTION`), mismo layout `TabBar` | Extraer `VariantPriceFields` + portal shell; wrapper delgado por caso |
| `features/pos/components/SessionOpenModal.tsx` vs `SessionCloseModal.tsx` | 636 + 543 | Misma máquina de estados de justificación de fondos (`justifyReason`/`justifyTargetId`/`justifySearchTerm`/`justifyOpen`), `TreasuryAccountSelector` de búsqueda, `Numpad`, mismas listas de razones de `utils/reasons.ts` | Extraer `FundJustificationStep` + `SearchAccountPopover` |
| `features/sales/components/SaleOrderDrawer.tsx` vs `features/purchasing/components/PurchaseOrderDrawer.tsx` | 115 + 117 | Mismo `Drawer` + `usePrintableDrawer` + `StatusBadge` + `SkeletonShell`; difieren solo en el hook de datos | `OrderDetailDrawer` parametrizado (o registry de entity-drawers) |

Otros candidatos: tríos de summary sidebars/cards de checkout (sales/purchasing/billing — `ProcessSummarySidebar`/`PurchaseProcessSummarySidebar`/`NoteProcessSidebar`, y sus `*SummaryCard`).

### 4.4 Respuestas de gobernanza

- **`StatusBadge` lookalikes:** `features/pos/components/SessionControl.tsx:243` (pill `border-success/30 text-success bg-success/5` + dot pulsante) y `features/orders/components/OrderHeaderDashboard.tsx:92` (string "PAGADO"/"PENDIENTE" inline). → `StatusBadge`.
- **Skeletons manuales:** `FinancialStatementsReport.tsx:17` (importa `SkeletonShell` sin usarlo), `pos/DetailPanel.tsx:39`, `pos/skeletons/POSLayoutSkeleton.tsx` (parte cart). → `SkeletonShell`/`CardSkeleton`.
- **Empty states inline:** `pos/SessionOpenModal.tsx:331,496`, `SessionCloseModal.tsx:364`, `finance/BIAnalyticsDashboard.tsx:273,307`, `production/.../SaleOrderProductStep.tsx:240`. → `EmptyState`.
- **Tablas crudas:** `credits/BlacklistClientView.tsx:125` (`<table>` al lado de un `DataTable`); `finance/BudgetVarianceTable.tsx` → `ReportTable`.
- **`animate-in fade-in` inline (91 archivos, censo 2026-09-17; la cifra "63 archivos vs 12" no reproducía):** top offenders: `pos/SessionOpenModal.tsx` (7), `SessionCloseModal.tsx` (5), `pos/POSClientView.tsx` (5), `finance/bank-reconciliation/StatementImportModal.tsx` (4), wizard de partners (3 c/u). → `<FadeIn>` en reveal top-level; ratchet con allowlist hasta que `FadeIn` admita props (ver T2).
- **Tintas CMYK — clasificar por princípio 1 de DESIGN.md (tinta L1 vs intención L2), no mapear a ciegas (censo verificado 2026-09-16):**
  - **Marca (L1, legítima → documentar, NO reemplazar):** `pos/Cart.tsx` (6: botones `bg-cyan`/`bg-magenta`/`bg-yellow` con `text-white`/`text-black` bien contrastados — identidad imprenta) y `treasury/BankAccountsSection.tsx` (4: `text-white` sobre gradiente de marca = texto-sobre-tinta, legal).
  - **Categórico L1 en shared (legítimo → documentar, entrar al scan):** `components/shared/Badge.tsx`, `TabBar.tsx` y `DataTableCells.tsx` emiten tintas como chips/categorías — el contrato las restringe a "chips categóricos" (color-system.contract.test.ts:40-42). Forman el allowlist L1 del scan `semantic-ink.test.ts`.
  - **Metáfora deliberada (decisión de sabor, §8.2):** `accounting/LedgerDrawer.tsx` (15: Cargos/Debe=Cyan, Abonos/Haber=Magenta, Saldo Final=Yellow; **Saldo Inicial es neutro adaptativo `text-foreground/80`, NO tinta K — la "K" no existe en el código**). Mantener la metáfora (resuelto); en ningún caso `destructive` para saldos.
  - **Semántico ya migrado:** estados de `POSApprovalCard` ya usan intents (`text-success`/`text-warning`, L38/60); su único uso de tinta es el botón de acción magenta (L87) — botón de acción L1 de marca, documentado.
  - Los hex de `settings/CompanySettingsView.tsx` son valores de marca editables: aceptables.

### 4.5 Contratos de estado por componente consolidado

Para cada par fusionado (`§4.3`) y cada refactor de shared (Fase 4), lo que el operador VE en cada estado (no comportamiento interno). Contratos de skeleton según [component-skeleton.md](../../20-contracts/component-skeleton.md).

| Componente consolidado | LOADING | EMPTY | ERROR | SUCCESS | PARCIAL |
|---|---|---|---|---|---|
| `PosTerminalDrawer` (ganador) | `SkeletonShell` en header + filas | — | toast de error; el Drawer permanece abierto | cierra vía `onSuccess` de identidad | importes con `tabular-nums` durante ediciones |
| `VariantPriceFields` (común) | 2 filas skeleton de herencia | grid de opciones colapsado (sin mensaje) | fallo de carga → `retry` inline | submit con confirmación parseable | badges "heredado/override" por variante |
| `FundJustificationStep` (común) | spinner en cuenta seleccionada | popover de búsqueda vacío → `EmptyState` con CTA | toast + retry en búsqueda | badge "justificado" aplicado | fondos parciales visibles en el flujo de caja |
| `OrderDetailDrawer` (común) | `SkeletonShell` del drawer | — | bloque `EmptyState` + retry del fetch | sellado correcto | — |
| Familia `DataTable` (F4) | hoja `DataTableLoading` | hoja `DataTableEmpty` con CTA primario | barra de error con retry por contexto | — | badges de estado por documento en celdas |
| Receipts/print/search consolidados (F3·11) | spinner del print pipeline común | `EmptyState` en búsqueda sin resultados | toast + retry | impresión usa el hook único | tesorería con key unificada (sin stale) |

## 5. Centralización (patrones repetidos no promovidos)

| Patrón | Estado | Acción |
|---|---|---|
| `NumpadModal` | Vive en `features/pos` (4 consumidores, incluido shared) | Promover a `components/shared/NumpadModal.tsx` (§3.1) |
| Receipts imprimibles | `components/shared/PrintableReceipt.tsx` (2 refs) vs `features/_shared/transaction-drawer/PrintableLayout.tsx` (33L, 38 consumidores) — casi idénticos | Fusionar en uno (el de 38 consumidores) |
| Hooks de impresión | `usePrintableDrawer` (11L, 36 consumidores) vs `usePrintTransaction` (19L, 1) vs 4 `useReactToPrint` raw (POSReport, POSClientView, InventoryDocumentDrawer, DocumentsClientView) | Un hook único |
| `useTreasuryAccounts` x3 | `hooks/useTreasuryAccounts.ts` (83L, POS/GENERAL, key `treasury_accounts`), `features/settings/hooks/useTreasuryAccounts.ts` (16L, settingsApi, key `["treasuryAccounts"]`), `features/treasury/hooks/useTreasuryAccounts.ts` (CRUD completo + useProvisionAccount). Distintas shapes y keys | Unificar; revisar la key compartida entre universos |
| Comentarios | `useSaleOrderComments.ts` (53) vs `useWorkOrderComments.ts` (52) — mismo esqueleto (queryKey, mutation, invalidation, toast); difieren solo en KEY y endpoint | Parametrizar en una fábrica |
| Formatting de dinero | `MoneyDisplay` en 49 archivos PERO 59 aún importan `formatCurrency` de `@/lib/money`; 4 archivos hand-roll `Intl.NumberFormat` (CreditUtilizationRing, UpcomingCalendar, LoanDetailModal, LoanViewDrawer); copia local en `lib/utils/export-report.ts:22` | Consolidar en `MoneyDisplay`/`formatCurrency` |
| Familia de search hooks | `useAccountSearch`, `useContactSearch`, `useProductSearch`, `useUserSearch`, `useGroupSearch` (esqueleto: `keys.search`, URLSearchParams, limit 50, staleTime 5min, retorno `{data, loading, isFetching}`); `useSaleOrderSearch`/`useWorkOrderSearch` hand-roll useState+globalCache | Fábrica config-driven (`createSearchHook`) |
| Flavores de selector | 9/13 selectors envuelven `SearchablePopover`+`LabeledContainer`; ProductSelector, ProductTypeSelector, UoMSelector, AdvancedContactSelector NO | Unificar el wrapper |

## 6. Simplificación: muertos y fusionables en shared

**Código muerto verificado (0 consumidores fuera del barrel)** — eliminado en T1 (ADR-0072):

- `components/shared/EntityHeader.tsx` (153L)
- `components/shared/CardActions.tsx` (73L)
- `components/shared/EntityCard.tsx` → subcomponente `Hero`
- `DataTableCells.tsx` → props `textTransform` y `letterSpacing` + sus maps

**Consumidor único (fusionar / fundir):**

- `ActionFoldButton` (48L) → fundir en `PageHeader.tsx:128`
- `MultiTagInput` (195L, solo AttributeDrawer) vs `MultiSelectTagInput` (269L, 6 consumidores) → fusionar, mantener uno
- `LabeledCheckbox`, `AttachmentList`, `DangerButton`, `useInitializeForm` (1 c/u)

**Tríadas superpuestas (completar el análisis antes de fusionar):**

- `StatCard` (384L, 20 consumidores) / `KPIComponents` (`KPIWrapper` 6, `KPIValue` 6, `DeltaBadge` 3) / `AnalyticsPanel` (7) — `AnalyticsLayout` compone los tres; considerar un módulo KPI único.
- `DataTable` (996) / `ReportTable` (335L, 2 consumidores) — `ReportTable` no usa el mecanismo de 56 props; validar si puede fundirse o si justifica su propia existencia.

**Bien factorizado (verificar, no tocar):** familia `Labeled*` (Input/Select/Switch/Container), `ActionSlideButton`/`SubmitButton`/`CancelButton`, `GenericWizard` (tras split), `HubStatus`, `FormSection`/`FormSplitLayout`.

## 7. Gobierno del cambio

| Cambio | ¿Requiere ADR? | Referencia |
|---|---|---|
| Borrar código muerto (EntityHeader, CardActions, EntityCard.Hero, props muertas) | **Sí** — `EntityHeader`/`CardActions` están exportados por el barrel público y documentados en contratos Capa-20 (invariante 12); corregido el 2026-09-17 (la fila decía "No") | ADR-0072 + deprecate-feature playbook |
| Promover `NumpadModal` / extraer bridge de `ReportTable` | No (cambios locales de archivo; sin nuevo API público) | add-shared-component playbook |
| Desambiguar `ProductSelector` duplicado (rename grid + reubicar fuera de shared) | **No es un winner-ADR**: las superficies son incompatibles (grid controlada vs picker de valor único). ADR solo si el barrel shared pierde/renombra un export público (se decide en T5) | rename + reubicación |
| Fusionar duplicados de features (TerminalDrawer, Variant forms, Session modals, Order drawers) | **No** — son internos de features; pero documentar en `component-decision-tree.md` si nace un componente compartido | add-shared-component |
| Refactor `DataTable` family / `GenericWizard` / `ActionDock` / barrel | **Sí** — tocan API pública de Capa-20 e invariante 6 (imports via barrel) | ADR (10-architecture/adr) |
| Clasificar tintas CMYK (L1 marca → documentar; L2 semántico → intents) | No | color-system contract |
| Carve-out `LedgerDrawer` (metáfora CMYK codifica datos contables) | **Sí** — excepción al contrato Capa-20 de color ("tintas solo para chips categóricos") y a DESIGN.md principio 1; GOVERNANCE §12 | ADR en F1 PR1 (T3) |
| Unificar `useTreasuryAccounts` x3 (colisión de cache-key `treasury_accounts` vs `[\"treasuryAccounts\"]`) | **Sí** — cambio de contrato de cache | ADR previo a T9 |
| Cambiar contratos de Capa-20 (component-fields, component-decision-tree) | **Sí** | GOVERNANCE §12 |

Todo cambio debe mantener verdes `npm run type-check`, `npm run lint` y el test `frontend/lib/__tests__/color-system.contract.test.ts`.

## 8. Oleadas de ejecución recomendadas

**§8.0 — Estado objetivo del sistema (calibrar contra [DESIGN.md](../../DESIGN.md), no degradar).**

Ningún refactor de estas fases reduce la jerarquía actual. Toda fase converge a esto:

- **Jerarquía visual preservada:** `primary` = K100, `accent` = cyan (énfasis de marca, no "información genérica"), radios 8/12/16/20, densidad compacta por defecto; `tabular-nums` en el `MoneyDisplay`/`formatCurrency` consolidados. Los duplicados fusionados (§4.3) heredan el *shell* del ganador sin cambiar su jerarquía de acciones.
- **Tinta vs intención (L1/L2 de DESIGN.md):** la limpieza de los 45 tokens CMYK (§4.4) clasifica entre *superficie de marca* (intencional: `Cart.tsx`, `POSApprovalCard` — se documenta su uso legítimo, no se reemplaza) y *decisión de sabor*: `LedgerDrawer` Debe/Haber/Saldo **mantiene la metáfora CMYK** como decisión explícita (resuelto 2026-09-16, §8.2); se documenta esa intención en el componente y en `color-system.md`, se audita el contraste en modo oscuro y se añade un cue no cromático (icono/flecha en Saldo). Solo las piezas que codifican `approved`/`waiting`/`required` de `POSApprovalCard` pasan a intents. Nunca `destructive` para saldos.
- **Criterio de aceptación del operador (mantra speed + density)** — cada fase termina con un check medible: F1: 0 tokens raw *semánticos* (usos de marca documentados; `LedgerDrawer` en allowlist §8.2) y sin `animate-in` inline nuevos fuera de la allowlist (ratchet); F2: `components/shared` sin imports de `features/*` ni conflicto de barrels; F3: 1 componente por par duplicado con las mismas props/hooks documentados en §4.3; F4: core de `DataTable` ≤15 props, wizard en 1 sola superficie, `ActionDock` sin `MutationObserver`. "Menos mecanismo, misma densidad".
- **Gobernanza:** todo cambio de API pública pasa por la tabla ADR (§7); el barrel solo publica componentes con ≥3 consumidores.
- **Guardas anti-genericidad (F3/F4):** (1) cada fusión hereda la *identidad* del ganador — radio, densidad, jerarquía de acciones — nunca un híbrido promedio; (2) si un refactor necesita una dimensión nueva (`variant`, `touchMode`, `surface`) para acomodar divergencias, la fusión es falsa → partir en 2 componentes, no en 1; (3) `OrderDetailDrawer` es un shell delgado parametrizado por hook de datos, no un megacomponente.

**§8.1 — Journey checkpoints por oleada (no-regresión del operador).**

Cada oleada debe preservar el arco emocional actual de la persona; se mide en pasos/taps no regresivos, no en líneas de código:

| Oleada | Journey (paso clave) | Persona | No-regresión |
|---|---|---|---|
| F1 (tokens) | Cart → cobro → cierre | Cajera POS | 0 cambios de flujo; solo apariencia |
| F2 (NumpadModal/bridge) | Validar folio en documento | Usuario de documentos | 0 taps extra al validar |
| F3.7 `TerminalDrawer` | Terminal → ticket | Cajera POS | mismo número de pasos; éxito → cierre inmediato |
| F3.8 `VariantPriceFields` | Editar variante → heredar precio | Inventarista | 1 sola superficie, sin diálogo extra |
| F3.9 `FundJustificationStep` | Abrir/cerrar sesión → justificar | Cajera / admin POS | misma secuencia; búsqueda sin fricción |
| F3.10 `OrderDetailDrawer` | Lista → detalle → imprimir | Vendedor | detalle legible en ≤1 clic |
| F3·11 receipts/hooks | Imprimir ticket / justificar caja → buscar | Cajera / admin POS | mismo número de pasos; 0 stale por colisión de cache-key |
| F4 `DataTable` family | Buscar → filtrar → leer | Analista | densidad preservada; 0 re-renders percibidos |

**Baselines (H6, eng review 2026-09-16):** la columna "No-regresión" es cualitativa hasta que **T10 fija la cifra base de pasos/taps por journey** (medida en F1, antes de cualquier refactor). A partir de ahí cada oleada verifica contra ese número, no contra "misma secuencia".

**§8.2 — Decisión de sabor: `LedgerDrawer` (resuelto 2026-09-16).**

Se mantiene la metáfora CMYK (Cargos/Debe=Cyan, Abonos/Haber=Magenta, Saldo Final=Yellow, Saldo Inicial=neutro adaptativo `foreground/80`), coherente con la identidad imprenta y los charts. Verificado 2026-09-16: los cues no cromáticos **ya existen** (`ArrowUpRight`/`ArrowDownRight`/`Scale`, LedgerDrawer.tsx:257/271/285) y los estados de `POSApprovalCard` **ya usan intents**. Acciones:

- Documentar la intención en el componente y en [color-system.md](../../20-contracts/color-system.md) (allowlist del carve-out).
- Auditar contraste en modo oscuro (las tintas no se adaptan como intents) y el amarillo sobre `border-yellow/40` en claro (Saldo Final, LedgerDrawer.tsx:283-288).
- Fijar el carve-out con el scan CI `semantic-ink.test.ts` (T3) — no "añadir" cues que ya existen.
- Nunca usar `destructive` para saldos.

**§8.3 — Accesibilidad y responsive por oleada (no-regresión).**

- **Focus:** `Drawer`/`BaseModal`/wizard consolidados conservan focus trap, return focus y mapeos `aria-` actuales; verificar con axe en cada PR de F3/F4.
- **Touch (POS):** targets ≥44px en superficies táctiles consolidadas (`PosTerminalDrawer`, `FundJustificationStep`, `Numpad`); el `variant` táctil no rompe la tabulación.
- **Movimiento:** `FadeIn` respeta `prefers-reduced-motion` ([component-animation.md](../../20-contracts/component-animation.md)); el swap desde `animate-in` inline no reintroduce movimiento sin respetar la preferencia.
- **Contraste:** intents/tintas verificados en claro y oscuro (contrato [color-system.md](../../20-contracts/color-system.md)); incluye el audit de la metáfora del §8.2.
- **Tablas (F4):** `caption`, `aria-sort` y estado de fila se conservan tras el split de `DataTable`.

**§8.4 — Decisiones de diseño diferidas (visibles, con puerta ADR).**

| Decisión | Si se difiere, ¿qué pasa? | Puerta |
|---|---|---|
| Ganador de `ProductSelector` (shared vs selectors) | ~~Coexisten 2 superficies~~ → **resuelto**: no hay ganador; el grid se renombra `ProductGridPicker` y `selectors/ProductSelector` queda como el único con ese nombre (eng review 2026-09-16) | reubicación en T5 |
| `ReportTable` vs `DataTable`: ¿fundir o mantener 2? | `ReportTable` (335L, 2 consumidores) mantiene shell propio; deriva lenta y contenida | ADR en F4 |
| Unificar `StatCard`/`KPIComponents`/`AnalyticsPanel` | 3 módulos superpuestos; cada KPI nuevo decide localmente | ADR en F4 |
| Veredicto del toolbar legacy vs `UnifiedSearchBar` | Ambas ramas viven; `ToolbarActionsCluster` (T8) de-duplica sin decidir y la rama legacy puede sobrevivir | Trigger medible: todos los DataTable con toolbar usan `unifiedSearch`; owner: eng F4 (ADR decide el borrado) |

**Fase 1 — Limpieza inmediata (sin ADR, bajo riesgo):**
1. Borrar `EntityHeader`, `CardActions`, `EntityCard.Hero`, props `textTransform`/`letterSpacing`.
2. `FadeIn` en vez de `animate-in` inline en los 5 top offenders.
3. Clasificar los usos CMYK por L1/L2 (marca → documentar, semántico → intents; censo verificado: Cart=6, LedgerDrawer=15, POSApprovalCard=1, BankAccounts=4, + emisores shared) y fijar la metáfora del `LedgerDrawer` (§8.2, con ADR del carve-out).

**Fase 2 — Violaciones shared→feature:**
4. Promover `NumpadModal` a shared (desengancha `FolioValidationInput` de POS).
5. Extraer el bridge `LedgerDrawer` de `ReportTable`.
6. Decidir `ProductSelector` único (ADR si aplica) y borrar los imports de features en la carpeta shared.

**Fase 3 — Duplicados de features (ADR para los que cambien API pública):**
7. `TerminalDrawer`/`PosTerminalDrawer` → uno.
8. `VariantQuickEditForm`/`BulkVariantEditForm` → `VariantPriceFields` compartido.
9. `SessionOpenModal`/`SessionCloseModal` → `FundJustificationStep` compartido.
10. `SaleOrderDrawer`/`PurchaseOrderDrawer` → `OrderDetailDrawer`.
11. Fusionar receipts imprimibles + hooks de print + hooks de treasury + familia de search hooks → **T9** (con ADR de cache-key).

**Fase 4 — Refactors grandes (ADR):**
12. `DataTable` family: extraer `DataTableCompact`/`DataTableLoading`/`DataTableEmpty`, split de prop surface, `ToolbarActionsCluster`.
13. `GenericWizard`: split Drawer, token `variant`, hook `useWizardState`.
14. `ActionDock`: posicionamiento por layout, sin MutationObserver.
15. Barrel: codemod de los 24 self-imports a rutas relativas.

**Orden de valor sugerido:** 3 → 1 → 2 (borrados rápidos y deuda de tokens), luego 4–6, después 7–11, y por último 12–15.

## 9. Checklist para futuras auditorías

- [ ] Re-verificar consumidores de `ProductSelector` (objetivo: 1 única fuente).
- [x] Contar `animate-in` inline (objetivo: allowlist ratchet; sin usos nuevos fuera de ella).
- [ ] Renumerar usos de tinta: 0 usos *semánticos* con tintas; usos de marca documentados; `LedgerDrawer` resuelto (§8.2); conteo automatizado por `semantic-ink.test.ts` (CI).
- [ ] Verificar que `components/shared` no importa de `features/*`.
- [ ] Actualizar este documento si un refactor cambia el estado de un hallazgo (marca `done` y fecha).

## Implementation Tasks

- [x] **T1 (P1, human: ~1h / CC: ~10min)** — Borrar código muerto (`EntityHeader`, `CardActions`, `EntityCard.Hero`, props `textTransform`/`letterSpacing`)
  - Surfaced by: §8 F1·1, §6
  - Files: `components/shared/{EntityHeader,CardActions,EntityCard,DataTableCells}.tsx` + barrel
  - Verify: `npm run type-check` + `npm run lint`; 0 usos fuera del barrel
  - **Done 2026-09-17 (branch `refactor/f1-dead-code`)**: verificado por grep que los 4 artefactos tienen 0 consumidores fuera del barrel → borrados `EntityHeader.tsx` (153L) y `CardActions.tsx` (73L), `EntityCard.Hero` + `EntityCardHeroProps`, y las props `textTransform`/`letterSpacing` + `TEXT_TRANSFORM_MAP`/`LETTER_SPACING_MAP` de `DataTableCells.tsx`; exports quitados del barrel. Gobernanza corregida: al estar documentados en contratos Capa-20 y exportados públicamente, el borrado requiere ADR (invariante 12) → **ADR-0072** + fila §7 actualizada de "No" a "Sí". Contratos actualizados sin refs muertas: `entity-identity.md` §6 → puntero histórico "eliminado" (patrón §7/T-95), ejemplos y listas de §9/§11 y fuentes; `component-row-actions.md` §1/§3/§5.2 → `DataCell.ActionGroup`; `component-contracts.md` fila `CardActions` eliminada. `type-check` limpio; `lint` 0 errores (sin warnings nuevos).
- [x] **T2 (P1, human: ~1h / CC: ~15min)** — Reemplazar `animate-in` inline por `<FadeIn>` en los 5 top offenders
  - Surfaced by: §8 F1·2, §4.4
  - Files: `pos/SessionOpenModal.tsx`, `SessionCloseModal.tsx`, `pos/POSClientView.tsx`, `bank-reconciliation/StatementImportModal.tsx`, wizard de partners + Nuevo: `lib/__tests__/animate-in.contract.test.ts`
  - Verify: type-check + lint + **guard CI `animate-in.contract.test.ts`** (0 `animate-in` inline fuera de `FadeIn`; sustituye el conteo manual reversible) (eng review 2026-09-16)
  - **Done 2026-09-17 (branch `refactor/f1-animate-in`)**: censo real = **152 usos en 91 archivos** (no 63); el verify "0 inline" es inalcanzable → decisión D3.1: **ratchet con allowlist** (mismo patrón que `semantic-ink`). Migrados a `<FadeIn>`: `PartnerContributionWizard` (3), `PartnerWithdrawalWizard` (3), `StatementImportModal` (4), `SessionOpenModal` (7), `SessionCloseModal` (5, uno envuelto para preservar el `grid`). **Hallazgo D3.2:** `FadeIn` NO es drop-in — hardcodea `w-full flex-1 flex flex-col min-h-0` y no reenvía props → `CardSkeleton` (5, con `role="status"`/`aria-label` y variantes `grid`) y `POSClientView` (1, `animate-in` dentro de `cn()` sobre un `Button`) quedan en la allowlist; no se toca `FadeIn` (informe §9 "no tocar"). Guard `animate-in.contract.test.ts` (5 tests): allowlist de 91 archivos, falla ante archivos nuevos, verifica que los 5 migrados no vuelvan a animar inline y que `FadeIn` conserve el guard `motion-reduce`. `type-check` limpio; `lint` 0 errores (5 warnings preexistentes).
- [x] **T3 (P1, human: ~2h / CC: ~20min)** — Clasificar los usos CMYK por L1/L2 (censo verificado: Cart=6, LedgerDrawer=15, POSApprovalCard=1, BankAccounts=4, + shared) y fijar el `LedgerDrawer` (§8.2), **con guard de regresión (eng review 2026-09-16)**
  - Surfaced by: §8 F1·3, §4.4, §8.2; censo actualizado en eng review (la cifra "45 usos / 4 archivos" no reproducía en el árbol)
  - Files: `pos/Cart.tsx`, `accounting/LedgerDrawer.tsx`, `pos/POSApprovalCard.tsx`, `treasury/BankAccountsSection.tsx`, `components/shared/{Badge,TabBar,DataTableCells}.tsx`, `color-system.md`, ADR del carve-out en `10-architecture/adr` + Nuevos: `semantic-ink.test.ts` (scan de **todos** los emisores) y Vitest+RTL de `LedgerDrawer`
  - Verify: 0 usos *semánticos* con tintas; ADR del carve-out `LedgerDrawer` aceptado (eng review 2026-09-16); `color-system.contract.test.ts` verde; **scan `semantic-ink.test.ts` en CI**: `LedgerDrawer`=carve-out allowlist (metáfora documentada; cues `ArrowUpRight`/`ArrowDownRight`/`Scale` presentes, pre-existentes) y `POSApprovalCard`=estados solo con intents; emisores shared en allowlist L1; smoke Vitest+RTL de Debe/Haber/Saldo
  - **Done 2026-09-17 (branch `refactor/f1-design-tokens`)**: censo global re-verificado con grep → **solo 6 archivos** emiten utilidades `cyan|magenta|yellow` (Badge/TabBar/DataTableCells L1, `LedgerSummaryPanel` carve-out, `Cart` marca, `POSApprovalCard` solo botón de acción); cementado como allowlist explícita en `lib/__tests__/semantic-ink.test.ts` (falla ante cualquier archivo nuevo). Contraste medido (OKLCH→WCAG): las tintas fijas **fallan SC 1.4.3 como texto en claro** (cyan 2.5:1, yellow 1.2:1, magenta 4.2:1; magenta también 3.1:1 sobre su tint en oscuro) → se extrae `LedgerSummaryPanel` con tinta en borde/fondo/icono y etiquetas en `text-foreground`; cues `ArrowUpRight`/`ArrowDownRight`/`Scale`/`Calculator` obligatorios. `ADR-0071` (carve-out) + `color-system.md` §4.6, fila en §8 Exceptions, bullet en §11 y cross-ref §10. Tests nuevos: `semantic-ink.test.ts` (5) + `LedgerSummaryPanel.test.tsx` (4) → 9/9 junto a `color-system.contract.test.ts`; `type-check` limpio; `lint` 0 errores (839 warnings preexistentes, sin nuevos).
- [ ] **T4 (P2, human: ~2h / CC: ~20min)** — Promover `NumpadModal` a shared y extraer el bridge `LedgerDrawer` de `ReportTable`
  - Surfaced by: §8 F2·4–5, §3.1
  - Files: `features/pos/components/NumpadModal.tsx` → `components/shared/NumpadModal.tsx`; `ReportTable.tsx`, `FolioValidationInput.tsx` + Nuevo: `lib/__tests__/shared-imports.contract.test.ts`
  - Verify: shared no importa de `features/*`; guard CI `shared-imports.contract.test.ts` (fija el objetivo F2); type-check + lint (eng review 2026-09-16)
- [ ] **T5 (P2, human: ~1.5h / CC: ~15min)** — Desambiguar `ProductSelector`: renombrar `shared/ProductSelector` → `ProductGridPicker` y reubicarlo fuera de `components/shared` (a su feature dueña o `components/selectors`); borrar sus imports de `features/*`; el ADR aplica solo si el barrel shared pierde/renombra un export
  - Surfaced by: §8 F2·6, §3.1, §8.4; reorientado en eng review 2026-09-16 (las superficies son incompatibles, no duplicadas)
  - Files: `components/shared/ProductSelector/*` (rename/move), sus 2 consumidores (`tools/CostCalculatorDrawer`, `production/.../ProductSelectionStep`), `components/selectors/ProductSelector.tsx` (sin cambios de API)
  - Verify: 1 única superficie llamada `ProductSelector`; 0 imports del grid desde `@/components/shared`; los 2 call sites renombrados a `ProductGridPicker`; shared sin imports de `features/*`; `components/selectors/__tests__/ProductSelector.test.tsx` verde; type-check + lint
- [ ] **T6 (P3, human: ~0.5d / CC: ~45min)** — Fusionar `TerminalDrawer`/`PosTerminalDrawer` y `SaleOrderDrawer`/`PurchaseOrderDrawer`
  - Surfaced by: §8 F3·7 y F3·10, §4.3
  - Files: settings + sales + purchasing duplicados; `OrderDetailDrawer`
  - Verify: journey no-regresión (§8.1); type-check + lint
- [ ] **T7 (P3, human: ~0.5d / CC: ~45min)** — Extraer `VariantPriceFields` y `FundJustificationStep` (+ contracts de estado §4.5)
  - Surfaced by: §8 F3·8–9, §4.3, §4.5
  - Files: `VariantQuickEditForm`/`BulkVariantEditForm`, `SessionOpenModal`/`SessionCloseModal`
  - Verify: contrato de estados §4.5; axe en PR; type-check + lint
- [ ] **T8 (P4, human: ~1d / CC: ~1h)** — Refactor `DataTable` family, `GenericWizard`, `ActionDock` y codemod del barrel (ADR), **con guard de regresión (eng review 2026-09-16)**
  - Surfaced by: §8 F4·12–15, §3
  - Files: `DataTable.tsx`, `DataTableCells.tsx`, `DataTableToolbar.tsx`, `GenericWizard.tsx`, `ActionDock.tsx`, `index.ts` + Tests: `DataTableExpandHeader.test.tsx` (base), `DataTableLoading/Empty/Compact` (hojas), test de compat de la superficie de 56 props pre/post split
  - Verify: core ≤15 props; 1 sola superficie de wizard; sin `MutationObserver`; codemod self-imports (40 archivos, no 24 — verificado 2026-09-16); ADR en `10-architecture/adr`; hoja nueva con test; compat de superficie verde; `e2e/pos-flow.spec.ts` + `sales-flow.spec.ts` verdes
- [ ] **T9 (P3, human: ~0.5d+ / CC: ~1h)** — Fusionar receipts imprimibles + hooks de print + hooks de treasury + familia de search hooks (F3·11), **con ADR de cache-key (eng review 2026-09-16)**
  - Surfaced by: §8 F3·11, §5 (colisión de cache-key), §4.5; oleada que estaba huérfana (sin T) hasta eng review
  - Files: `components/shared/PrintableReceipt.tsx` vs `features/_shared/transaction-drawer/PrintableLayout.tsx` (ganador = el de 38 consumidores); `usePrintableDrawer`/`usePrintTransaction`/4 `useReactToPrint` raw → hook único; los 3 `useTreasuryAccounts`; familia `use*Search` → `createSearchHook`
  - Verify: **ADR de cache-key aprobado ANTES del merge** (`treasury_accounts` vs `["treasuryAccounts"]`); journey §8.1 F3·11 sin regresión vs baseline (T10); contrato de estados §4.5; type-check + lint
- [ ] **T10 (P1, human: ~1h / CC: ~10min)** — Instrumentar baselines numéricos de journey (§8.1) antes de cualquier refactor
  - Surfaced by: eng review 2026-09-16 (H6: los verify de T6/T7 no eran falsables)
  - Files: `docs/50-audit/design-system-ui-audit.md` (§8.1, columna de cifras base) + captura de los flujos de §8.1
  - Verify: cada journey de §8.1 tiene pasos/taps base anotados; T6/T7/T9 verifican contra esa cifra

## NOT in scope (eng review 2026-09-16)

- **No evaluado (fuera del alcance de esta revisión):** tríada KPI (`StatCard`/`KPIComponents`/`AnalyticsPanel`), fusión `ReportTable` vs `DataTable`, composición de `DataView`, los 12 tokens ad-hoc — quedan en §8.4 con puerta ADR en F4.
- **Estabilizado ahora (no tocar):** los contratos CI (`color-system.contract.test.ts` existente) + los 3 guards nuevos a crear (`semantic-ink.test.ts`, `animate-in.contract.test.ts`, `shared-imports.contract.test.ts`); los e2e de journey (`pos-flow`, `sales-flow`, `purchase-flow`, `fiscal-closing-flow`, `universal-search`); `FadeIn` (ya respeta `prefers-reduced-motion`, FadeIn.tsx:24).
- **Movido dentro de scope en esta revisión:** F3·11 (receipts/print/treasury/search hooks) → T9 con ADR de cache-key; baselines numéricos de journey → T10.
- **Diferido en §5 (sin T):** unificación de "flavores de selector" (9/13 sobre `SearchablePopover`) y de formatting de dinero (59 `formatCurrency` + 4 `Intl.NumberFormat` hand-rolled) — candidatos a ADR post-F4.
- **Cero hallazgos:** Performance (el plan no añade mecanismo pesado; T8 elimina trabajo).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | — | — | — |
| Codex Review | `/codex review` (outside voice: subagente Claude) | Independent 2nd opinion | 1 | clean | 8 (H1–H8): censo de tinta stale, 40 self-imports, F3·11 huérfana, falsa "no migración", gobernanza carve-out, verify no falsables, toolbar sin dueño, F1 inalcanzable |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean | A1–A2 + T-a/T-b; 7 decisiones aplicadas al informe; 0 bloqueos |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean | score: 4/10 → 8/10, 7 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | — | — | — |

- **VERDICT:** ENG CLEARED — ready to implement. Resuelto en esta revisión: contradicción §8.0/§8.2 (A1 → alineada a §8.2), `ProductSelector` desdoblado (A2 → rename `ProductGridPicker` + reubicación, 2 imports renombrados), guards de regresión F1 (`semantic-ink.test.ts` + Vitest `LedgerDrawer`) y F4 (hojas `DataTable` + compat de 56 props), censo de tinta recalculado contra el árbol, self-imports 24→40, F3·11 formalizada como T9 (ADR de cache-key) y baselines de journey como T10. Gobernanza: ADR del carve-out `LedgerDrawer` en F1 PR1 + ADR de cache-key antes de T9. Sin decisiones abiertas.

NO UNRESOLVED DECISIONS