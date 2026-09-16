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
- ~45 usos de tintas CMYK en 4 archivos: la mayoría es **superficie de marca Layer-1** (botones de `Cart.tsx`, texto sobre gradiente de tesorería) — legítima y contrastada; solo el subconjunto que **codifica significado** (`LedgerDrawer` Debe/Haber/Saldo, estados de `POSApprovalCard`) es uso semántico indebido y mapea a intents (nunca a `destructive`).
- 63 archivos que reimplementan `animate-in fade-in` inline en vez de usar el `FadeIn` compartido.

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
| `components/shared/ProductSelector/` (carpeta) | ~840 en 6 files | 13 | **Segundo** `ProductSelector` con el mismo nombre que el de `components/selectors/ProductSelector.tsx` (413L, 19 props, con test suite); este vive en shared pero importa internos de features (ver §3.1); solo 2 consumidores vs 12 del otro | Elegir uno y migrar los consumidores del otro; en shared deben borrarse los imports a features |
| `components/shared/index.ts` (barrel) | 173 | — | Re-exporta ~140 módulos; **24 archivos shared importan de su propio barrel** (`DataTable.tsx:32` importa 9 nombres de sí mismo) — red circular que el barrel esconde | Codemod a imports relativos dentro de `components/shared`; no publicar en barrel componentes con <3 consumidores (ergonomía sobre completitud) |
| Sistema de variantes (BaseModal/Drawer/PanelHeader) | 163/333/133 | — | Cada caso nuevo crea una dimensión nueva (`touchMode`, `surface`, `density`) en `PanelBaseProps` en vez de componer sobre el base | Congelar la matriz de variantes; superficies nuevas = componentes delgados compuestos sobre `PanelBase` |
| `components/shared/FormLineItemsTable.tsx` + `AccountingLinesTable.tsx` | 235 + 193 | 12 | Shell delgado (~13 líneas de JSX reales) con ~40 líneas de doc block; segunda capa de wrapper (`AccountingLinesTable`) para ~5 consumidores | Recortar doc a <30 líneas; colapsar wrapper en los 3 call sites que difieren o como variante opcional |

### 3.1 Violaciones shared→feature (capa compartida importando features)

| Archivo shared | Importa | Impacto |
|---|---|---|
| `components/shared/FolioValidationInput.tsx:9` | `@/features/pos/components/NumpadModal` | La capa compartida depende del módulo POS; `NumpadModal` (81L: Numpad+BaseModal, 4 consumidores) debe promoverse a `components/shared/NumpadModal.tsx` |
| `components/shared/ReportTable.tsx:17` | `LedgerDrawer` de `@/features/accounting` | Compartir un componente que arrastra el ledger contable a su grafo de dependencias |
| `components/shared/ProductSelector/CategoryFilter.tsx` | `@/features/inventory` (x2), y `VariantSelectorModal`, `ProductGrid`, `ProductSelector` internos importan `@/features/pos` | Carpetas shared que dependen del dominio |

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
- **`animate-in fade-in` inline (63 archivos vs 12 que usan `FadeIn`):** top offenders: `pos/SessionOpenModal.tsx` (7), `SessionCloseModal.tsx` (5), `pos/POSClientView.tsx` (5), `finance/bank-reconciliation/StatementImportModal.tsx` (4), wizard de partners (3 c/u). → `<FadeIn yOffset={8}>` en reveal top-level.
- **Tintas CMYK (45 usos, 4 archivos) — clasificar por princípio 1 de DESIGN.md (tinta L1 vs intención L2), no mapear a ciegas:**
  - **Marca (L1, legítima → documentar, NO reemplazar):** `pos/Cart.tsx` (16: botones `bg-cyan`/`bg-magenta`/`bg-yellow` con `text-white`/`text-black` bien contrastados — identidad imprenta) y `treasury/BankAccountsSection.tsx` (4: `text-white` sobre gradiente de marca = texto-sobre-tinta, legal).
  - **Metáfora deliberada (decisión de sabor, §8.2):** `accounting/LedgerDrawer.tsx` (13: Saldo Inicial=K100, Cargos/Debe=Cyan, Abonos/Haber=Magenta, Saldo Final=Yellow — mapeo CMYK comentado en el propio código). Mantener la metáfora o pasar a intents requiere decisión explícita; en ningún caso `destructive` para saldos.
  - **Semántico a verificar (→ intents):** estados de `POSApprovalCard` (solo las piezas que codifican `approved`/`waiting`/`required`, no sus botones de acción).
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

**Código muerto verificado (0 consumidores fuera del barrel):**

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
| Borrar código muerto (EntityHeader, CardActions, EntityCard.Hero, props muertas) | No | deprecate-feature playbook |
| Promover `NumpadModal` / extraer bridge de `ReportTable` | No (cambios locales de archivo; sin nuevo API público) | add-shared-component playbook |
| Elegir `ProductSelector` único | **Sí** si el ganador es `components/shared/ProductSelector` (migrar 12 consumidores = cambio de API pública del barrel) | ADR + add-shared-component |
| Fusionar duplicados de features (TerminalDrawer, Variant forms, Session modals, Order drawers) | **No** — son internos de features; pero documentar en `component-decision-tree.md` si nace un componente compartido | add-shared-component |
| Refactor `DataTable` family / `GenericWizard` / `ActionDock` / barrel | **Sí** — tocan API pública de Capa-20 e invariante 6 (imports via barrel) | ADR (10-architecture/adr) |
| Clasificar tintas CMYK (L1 marca → documentar; L2 semántico → intents) + decisión `LedgerDrawer` (§8.2) | No (restaura principios 1 y 2; decisión de sabor documentada) | color-system contract |
| Cambiar contratos de Capa-20 (component-fields, component-decision-tree) | **Sí** | GOVERNANCE §12 |

Todo cambio debe mantener verdes `npm run type-check`, `npm run lint` y el test `frontend/lib/__tests__/color-system.contract.test.ts`.

## 8. Oleadas de ejecución recomendadas

**§8.0 — Estado objetivo del sistema (calibrar contra [DESIGN.md](../../DESIGN.md), no degradar).**

Ningún refactor de estas fases reduce la jerarquía actual. Toda fase converge a esto:

- **Jerarquía visual preservada:** `primary` = K100, `accent` = cyan (énfasis de marca, no "información genérica"), radios 8/12/16/20, densidad compacta por defecto; `tabular-nums` en el `MoneyDisplay`/`formatCurrency` consolidados. Los duplicados fusionados (§4.3) heredan el *shell* del ganador sin cambiar su jerarquía de acciones.
- **Tinta vs intención (L1/L2 de DESIGN.md):** la limpieza de los 45 tokens CMYK (§4.4) clasifica entre *superficie de marca* (intencional: `Cart.tsx`, `POSApprovalCard` — se documenta su uso legítimo, no se reemplaza) y *uso semántico indebido* (p. ej. `LedgerDrawer` Debe/Haber/Saldo vistiendo tintas: pasa a intents `success`/`warning`/`muted`; nunca "destructive").
- **Criterio de aceptación del operador (mantra speed + density)** — cada fase termina con un check medible: F1: 0 tokens raw y 0 `animate-in` inline; F2: `components/shared` sin imports de `features/*` ni conflicto de barrels; F3: 1 componente por par duplicado con las mismas props/hooks documentados en §4.3; F4: core de `DataTable` ≤15 props, wizard en 1 sola superficie, `ActionDock` sin `MutationObserver`. "Menos mecanismo, misma densidad".
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
| F4 `DataTable` family | Buscar → filtrar → leer | Analista | densidad preservada; 0 re-renders percibidos |

**§8.2 — Decisión de sabor: `LedgerDrawer` (resuelto 2026-09-16).**

Se mantiene la metáfora CMYK (K = Saldo Inicial, C = Cargos/Debe, M = Abonos/Haber, Y = Saldo Final), coherente con la identidad imprenta y los charts. Acciones:

- Documentar la intención en el componente y en [color-system.md](../../20-contracts/color-system.md).
- Auditar contraste en modo oscuro (las tintas no se adaptan como intents) y añadir cue no cromático (icono/flecha en Saldo) para daltonismo.
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
| Ganador de `ProductSelector` (shared vs selectors) | Coexisten 2 superficies y el barrel expone ambas hasta F2 | ADR + add-shared-component |
| `ReportTable` vs `DataTable`: ¿fundir o mantener 2? | `ReportTable` (335L, 2 consumidores) mantiene shell propio; deriva lenta y contenida | ADR en F4 |
| Unificar `StatCard`/`KPIComponents`/`AnalyticsPanel` | 3 módulos superpuestos; cada KPI nuevo decide localmente | ADR en F4 |
| Veredicto del toolbar legacy vs `UnifiedSearchBar` | Ambas ramas viven; acciones duplicadas persisten | ADR en F4 |

**Fase 1 — Limpieza inmediata (sin ADR, bajo riesgo):**
1. Borrar `EntityHeader`, `CardActions`, `EntityCard.Hero`, props `textTransform`/`letterSpacing`.
2. `FadeIn` en vez de `animate-in` inline en los 5 top offenders.
3. Clasificar los 45 usos CMYK por L1/L2 (marca → documentar, semántico → intents) y resolver la metáfora del `LedgerDrawer` (§8.2).

**Fase 2 — Violaciones shared→feature:**
4. Promover `NumpadModal` a shared (desengancha `FolioValidationInput` de POS).
5. Extraer el bridge `LedgerDrawer` de `ReportTable`.
6. Decidir `ProductSelector` único (ADR si aplica) y borrar los imports de features en la carpeta shared.

**Fase 3 — Duplicados de features (ADR para los que cambien API pública):**
7. `TerminalDrawer`/`PosTerminalDrawer` → uno.
8. `VariantQuickEditForm`/`BulkVariantEditForm` → `VariantPriceFields` compartido.
9. `SessionOpenModal`/`SessionCloseModal` → `FundJustificationStep` compartido.
10. `SaleOrderDrawer`/`PurchaseOrderDrawer` → `OrderDetailDrawer`.
11. Fusionar receipts imprimibles + hooks de print + hooks de treasury + familia de search hooks.

**Fase 4 — Refactors grandes (ADR):**
12. `DataTable` family: extraer `DataTableCompact`/`DataTableLoading`/`DataTableEmpty`, split de prop surface, `ToolbarActionsCluster`.
13. `GenericWizard`: split Drawer, token `variant`, hook `useWizardState`.
14. `ActionDock`: posicionamiento por layout, sin MutationObserver.
15. Barrel: codemod de los 24 self-imports a rutas relativas.

**Orden de valor sugerido:** 3 → 1 → 2 (borrados rápidos y deuda de tokens), luego 4–6, después 7–11, y por último 12–15.

## 9. Checklist para futuras auditorías

- [ ] Re-verificar consumidores de `ProductSelector` (objetivo: 1 única fuente).
- [ ] Contar `animate-in` inline (objetivo: solo `FadeIn`).
- [ ] Renumerar usos de tinta: 0 usos *semánticos* con tintas; usos de marca documentados; `LedgerDrawer` resuelto (§8.2).
- [ ] Verificar que `components/shared` no importa de `features/*`.
- [ ] Actualizar este documento si un refactor cambia el estado de un hallazgo (marca `done` y fecha).

## Implementation Tasks

- [ ] **T1 (P1, human: ~1h / CC: ~10min)** — Borrar código muerto (`EntityHeader`, `CardActions`, `EntityCard.Hero`, props `textTransform`/`letterSpacing`)
  - Surfaced by: §8 F1·1, §6
  - Files: `components/shared/{EntityHeader,CardActions,EntityCard,DataTableCells}.tsx` + barrel
  - Verify: `npm run type-check` + `npm run lint`; 0 usos fuera del barrel
- [ ] **T2 (P1, human: ~1h / CC: ~15min)** — Reemplazar `animate-in` inline por `<FadeIn>` en los 5 top offenders
  - Surfaced by: §8 F1·2, §4.4
  - Files: `pos/SessionOpenModal.tsx`, `SessionCloseModal.tsx`, `pos/POSClientView.tsx`, `bank-reconciliation/StatementImportModal.tsx`, wizard de partners
  - Verify: type-check + lint + conteo de `animate-in` inline (objetivo: solo `FadeIn`)
- [ ] **T3 (P1, human: ~2h / CC: ~20min)** — Clasificar los 45 usos CMYK por L1/L2 y resolver el `LedgerDrawer` (§8.2)
  - Surfaced by: §8 F1·3, §4.4, §8.2
  - Files: `pos/Cart.tsx`, `accounting/LedgerDrawer.tsx`, `pos/POSApprovalCard.tsx`, `treasury/BankAccountsSection.tsx`, `color-system.md`
  - Verify: 0 usos *semánticos* con tintas; test `color-system.contract.test.ts` verde
- [ ] **T4 (P2, human: ~2h / CC: ~20min)** — Promover `NumpadModal` a shared y extraer el bridge `LedgerDrawer` de `ReportTable`
  - Surfaced by: §8 F2·4–5, §3.1
  - Files: `features/pos/components/NumpadModal.tsx` → `components/shared/NumpadModal.tsx`; `ReportTable.tsx`, `FolioValidationInput.tsx`
  - Verify: shared no importa de `features/*`; type-check + lint
- [ ] **T5 (P2, human: ~3h / CC: ~30min)** — Decidir `ProductSelector` único (ADR) y borrar imports de features en la carpeta shared
  - Surfaced by: §8 F2·6, §3.1, §8.4
  - Files: `components/shared/ProductSelector/*`, `components/selectors/ProductSelector.tsx`, ADR F2
  - Verify: 1 única superficie; barrel estable; type-check + lint
- [ ] **T6 (P3, human: ~0.5d / CC: ~45min)** — Fusionar `TerminalDrawer`/`PosTerminalDrawer` y `SaleOrderDrawer`/`PurchaseOrderDrawer`
  - Surfaced by: §8 F3·7 y F3·10, §4.3
  - Files: settings + sales + purchasing duplicados; `OrderDetailDrawer`
  - Verify: journey no-regresión (§8.1); type-check + lint
- [ ] **T7 (P3, human: ~0.5d / CC: ~45min)** — Extraer `VariantPriceFields` y `FundJustificationStep` (+ contracts de estado §4.5)
  - Surfaced by: §8 F3·8–9, §4.3, §4.5
  - Files: `VariantQuickEditForm`/`BulkVariantEditForm`, `SessionOpenModal`/`SessionCloseModal`
  - Verify: contrato de estados §4.5; axe en PR; type-check + lint
- [ ] **T8 (P4, human: ~1d / CC: ~1h)** — Refactor `DataTable` family, `GenericWizard`, `ActionDock` y codemod del barrel (ADR)
  - Surfaced by: §8 F4·12–15, §3
  - Files: `DataTable.tsx`, `DataTableCells.tsx`, `DataTableToolbar.tsx`, `GenericWizard.tsx`, `ActionDock.tsx`, `index.ts`
  - Verify: core ≤15 props; 1 sola superficie de wizard; sin `MutationObserver`; codemod self-imports; ADR en `10-architecture/adr`

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | — | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | — | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | — | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean | score: 4/10 → 8/10, 7 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | — | — | — |

- **VERDICT:** DESIGN CLEARED — ready to implement. Resolved: estado objetivo (§8.0), contratos de estado (§4.5), journeys por oleada (§8.1), guardas anti-genericidad (§8.0), clasificación tinta-vs-intención con metáfora `LedgerDrawer` (§8.2), a11y/responsive (§8.3), diferimientos explícitos (§8.4). Pass 3 permanece 7/10 (mapeo de journey fino diferido a ADRs F3/F4, decisión del usuario). **Eng review required** (sin entrada `/plan-eng-review` para este plan).

NO UNRESOLVED DECISIONS