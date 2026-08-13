# Plan: Filtrado por contexto en el ProductSelector

Branch: `issue-161-refactor-productselector`
Fecha: 2026-08-06

## Problema

El `ProductSelector` legado (`frontend/components/selectors/ProductSelector.tsx`) expone 5 mecanismos de filtrado superpuestos y aplicados de forma inconsistente entre 12 consumidores:

| Prop | Nivel | Comportamiento |
|---|---|---|
| `productType: string` | Server | `?product_type=` (exacto, 1 tipo) |
| `allowedTypes: string[]` | Client | Filtra los ya traídos (tope 200) |
| `simpleOnly: boolean` | Client | STORABLE o MANUFACTURABLE simple |
| `customFilter: (p) => boolean` | Client | Predicado arbitrario |
| `context: 'sale'\|'purchase'` | Server | `can_be_sold` / `can_be_purchased` |

El objetivo es una sola vía declarativa de filtrado por tipo que derive el query server-side cuando sea posible, dejando `customFilter`/`excludeIds` solo para reglas de predicado.

## Decisiones de negocio (confirmadas)

1. Materias primas/componentes del BOM = **solo STORABLE** (hoy: STORABLE + MANUFACTURABLE → cambio de comportamiento). **Bloqueo solo-nuevo** en el validador + auditoría de líneas existentes (OV-3).
2. Servicios tercerizados del BOM = **solo SERVICE** con `can_be_purchased`, reforzado en el validador (OV-2).
3. Migrar y **eliminar** los props antiguos (`productType`, `allowedTypes`, `simpleOnly`, `context`) → requiere **ADR obligatorio** (invariante 12).

## Diseño

### Backend
- `backend/inventory/filters.py` — `ProductFilter.Meta.fields` → `"product_type": ["exact", "in"]` (soporta `?product_type__in=`). Patrón ya usado en `backend/inventory/selectors.py:215` (`Q(product_type__in=...)`).
- `backend/production/validators.py` — reforzar `validate_bom_line` (OV-2):
  - Líneas NO tercerizadas: `component.product_type == 'STORABLE'`.
  - Líneas tercerizadas: `component.product_type == 'SERVICE'` **y** `component.can_be_purchased`.
- **Auditoría de datos (OV-3)**: query de líneas BOM existentes con `component.product_type` != STORABLE (pivote: reportar). El validador solo bloquea lo nuevo; las líneas existentes se reportan, no se rompe edición.
- Nota: `URLSearchParams` codifica la coma como `%2C` (OV-5) — inofensivo en runtime (Django decodifica antes del split de `in`), pero el test debe asertar sobre el parámetro decodificado.

### Hook (`frontend/features/inventory/hooks/useProductSearch.ts`)
- `productType?: string` → `productTypes?: ProductType[]`
  - 1 elemento → `?product_type=X`
  - >1 elementos → `?product_type__in=X,Y`
- `context?: 'sale'|'purchase'` → `canBeSold?: boolean`, `canBePurchased?: boolean` (mapeo directo a los query params). Se mantiene la pareja completa aunque hoy solo se use `canBePurchased` (decisión OV-6).
- **Eliminar `fetchSingleId`** (código muerto, declarado pero nunca usado — OV-7).
- Se mantienen `search`, `limit`, `excludeVariantTemplates`.

### Selector (`frontend/components/selectors/ProductSelector.tsx`)
- `productTypes: ProductType[]` reemplaza `productType` / `allowedTypes` / `simpleOnly`.
- `canBeSold` / `canBePurchased` reemplazan `context`.
- Se mantienen: `customFilter`, `customDisabled`, `excludeIds`, `restrictStock`, `shouldResolveVariants`, `excludeVariantTemplates`, `label`, `error`, `required`, `variant`, `className`, `placeholder`, `disabled`, `onSelect`.
- Filtro local que subsiste tras el server-side: `customFilter`, `excludeIds`, `restrictStock` (display).

### Consumidores (migración de los 12)

| Archivo | Líneas | Antes | Después |
|---|---|---|---|
| `BOMDrawer.tsx` producto a fabricar | 416 | `allowedTypes=['MANUFACTURABLE']` | `productTypes={['MANUFACTURABLE']}` |
| `BOMDrawer.tsx` materiales | 563, 610 | `allowedTypes` + `customFilter` | `productTypes={['STORABLE']}` + `excludeIds` (quitar customFilter) → **wrapper local solo-props `MaterialSelector`** (OV-8) |
| `BOMDrawer.tsx` servicios | 833, 856 | solo `customFilter` | `productTypes={['SERVICE']}` + `canBePurchased` → **wrapper local solo-props `ServiceSelector`** (OV-8) |
| `MaterialAssignmentStep.tsx` | 199 | `customFilter` | `productTypes` STORABLE+MANUFACTURABLE + `customFilter` (mantener semántica) |
| `OutsourcedServiceForm.tsx` | 127 | `customFilter` | `productTypes={['SERVICE']}` + `canBePurchased` |
| `WorkOrderBasicInfo.tsx` | 207 | `productType` + `customFilter` | `productTypes={['MANUFACTURABLE']}` + `customFilter` |
| `PricingRuleDrawer.tsx` | 207 | `customFilter` (!parent_template) | quitar `customFilter` (redundante: hook fuerza `parent_template__isnull=true`) |
| `PartnerWithdrawalWizard.tsx` / `InventoryContributionModal.tsx` / `PartnerContributionWizard.tsx` | 316/297/354 | `allowedTypes` + `simpleOnly` | `productTypes={['STORABLE','MANUFACTURABLE']}` + `customFilter` **simple-only exacto** (OV-1): `(p) => !(p.product_type === 'MANUFACTURABLE' && (p.requires_advanced_manufacturing || p.mfg_auto_finalize))` |
| `Step1_ProductSelection.tsx` | 231 | `context="purchase"` | `canBePurchased` |
| `PurchaseOrderModal.tsx` | 276, 433 | `context="purchase"` | `canBePurchased` + `excludeVariantTemplates` |
| `ProviderDrawer.tsx` | 264 | sin filtro (bug) | `productTypes={['SERVICE']}` |
| `ProductInsightsPanel.tsx` | 441 | sin filtro | sin cambios |

### Docs y ADR
- **ADR obligatorio** (invariante 12) en `docs/10-architecture/adr/` por el cambio de contrato layer 20 del selector. Incluye: reglas de negocio (STORABLE-only, SERVICE+can_be_purchased), política "bloquear solo nuevo + auditoría" y split semántico BOM vs OT material.
- Actualizar `docs/20-contracts/component-selectors.md` (tabla de props: `productTypes`, `canBeSold`, `canBePurchased`; corregir doc de `context` que se elimina y eliminarlo de la tabla).
- Crear `TODOS.md` con: (1) fusión del selector legado + shared POS, (2) paginación server-side en `useProductSearch`.

## Tests

### Frontend (Vitest + react-testing-library, patrón `__tests__/`)
- `frontend/components/selectors/__tests__/ProductSelector.test.tsx`:
  - `productTypes` 1 tipo → `useProductSearch` recibe `product_type=X`.
  - `productTypes` multi → recibe `product_type__in=X,Y` (asertar sobre param **decodificado**, `%2C` — OV-5).
  - `canBePurchased` → recibe flag server.
  - `customFilter` aplicado en cliente.
  - Estado vacío renderiza `EmptyState`.
  - **REGRESIÓN (CRITICAL)**: BOM materiales solo muestra STORABLE (antes STORABLE+MANUFACTURABLE).
  - **Edit-mode / valor fuera de filtro (OV-4)**: mock de `useSingleProduct`; `value` fuera del set filtrado → el trigger renderiza nombre/precio y permite limpiar; el dropdown muestra solo el set filtrado.
- **Predicado simple-only (OV-1)**: test que excluye `requires_advanced_manufacturing` y `mfg_auto_finalize` en los 3 wizards.

### Backend (pytest)
- `backend/inventory/tests/` (archivo nuevo `test_filters.py`): `ProductFilter` con `product_type__in` devuelve intersección correcta y `product_type` exacto sigue funcionando.
- `backend/production/tests/`: `validate_bom_line` rechaza material no-STORABLE y servicio sin `can_be_purchased` (OV-2). Auditoría reporta líneas existentes sin romper.

## DoD

- `npm run type-check` y `npm run lint` sin errores.
- `npm run test` (al menos la suite del selector) y `pytest backend/inventory/tests backend/production/tests`.
- Invariantes respetados (zero `any`, imports por barrel, hooks policy).
- ADR + contract docs + TODOS.md actualizados.

## What already exists (reusado, no reconstruido)

- `ProductFilter.product_type` exacto ya existe en `backend/inventory/filters.py:13` — solo se añade el lookup `in`.
- `Q(product_type__in=...)` ya es patrón en `backend/inventory/selectors.py:215`.
- `can_be_sold`/`can_be_purchased` ya son filtros del backend (`filters.py:15-16`).
- El `product_type__in` se decodifica server-side automáticamente (django-filter `BaseInFilter`, OV-3 probe).
- `useSingleProduct` ya resuelve el display de un valor fuera del filtro (`ProductSelector.tsx:88,96-102`) — se reutiliza, no se cambia.

## Fuera de alcance (NOT in scope)

- Fusionar el selector legado con el shared POS (`@/components/shared/ProductSelector`) — refactor mayor, registrado en TODOS.md.
- Paginación server-side infinita en `useProductSearch` — el tope 200 queda aceptado para filtros por predicado (3 wizards, dominio pequeño); registrado en TODOS.md.
- Filtros de stock/categoría por contexto en el selector.
- Migrar `schema-driven-forms.md` (solo referencia en doc, sin uso en código).

## Failure modes (uno por codepath nuevo)

| Codepath | Fallo realista | Test | Error handling | ¿Crítico? |
|---|---|---|---|---|
| `product_type__in` backend | CSV parseado con `%2C` mal decodificado | sí (pytest) | 400 de DRF | No |
| Selector BOM materiales | Edit de receta con componente MANUFACTURABLE existente | sí (edit-mode OV-4) | trigger renderiza vía `useSingleProduct` | No |
| Validador STORABLE-only | Línea nueva no-STORABLE pasa por API | sí (pytest OV-2) | ValidationError claro | No |
| Predicado simple-only wizards | `mfg_auto_finalize` aparece en aportes | sí (OV-1) | filtrado client-side | No |
| `canBePurchased` server | Servicio no comprable en línea tercerizada | sí (pytest) | ValidationError | No |

## Secuenciación y paralelización (OV-9)

`npm run type-check` falla hasta migrar los 12 consumidores juntos → el frontend es un **commit atómico**; el backend es aditivo/no-breaking.

- **Lane A (backend)**: filters.py + validators.py + auditoría + tests — independiente.
- **Lane B (frontend)**: hook + selector + 12 consumidores + docs/ADR/TODOS — atómico.

Orden: lanzar A y B en paralelo; merge A (no-breaking) primero, luego B. Conflictos: ninguno (módulos distintos).

## Implementation Tasks

- [ ] **T1 (P1, human: ~30min / CC: ~10min)** — backend — añadir `product_type__in` a `ProductFilter`
  - Surfaced by: Section 1 issue 3
  - Files: `backend/inventory/filters.py`, `backend/inventory/tests/test_filters.py`
  - Verify: `pytest backend/inventory/tests/test_filters.py`
- [ ] **T2 (P1, human: ~1h / CC: ~20min)** — backend — reforzar `validate_bom_line` (STORABLE-only + SERVICE con can_be_purchased) + auditoría
  - Surfaced by: OV-2, OV-3
  - Files: `backend/production/validators.py`, `backend/production/tests/test_serializers.py`
  - Verify: `pytest backend/production/tests -k "bom or line"`
- [ ] **T3 (P1, human: ~1h / CC: ~15min)** — hook — `productTypes` + `canBeSold`/`canBePurchased`, eliminar `fetchSingleId`
  - Surfaced by: Section 1 issue 2, OV-7
  - Files: `frontend/features/inventory/hooks/useProductSearch.ts`
  - Verify: `npm run type-check`
- [ ] **T4 (P1, human: ~2h / CC: ~30min)** — selector — consolidar props `productTypes`/`canBe*`
  - Surfaced by: Section 1 issues 1-3
  - Files: `frontend/components/selectors/ProductSelector.tsx`
  - Verify: `npm run type-check && npm run lint`
- [ ] **T5 (P1, human: ~3h / CC: ~40min)** — consumidores — migrar los 12 (wrappers BOM solo-props, quitar redundancias)
  - Surfaced by: Sections 1-2 issues 4, 5; OV-1, OV-8
  - Files: `BOMDrawer.tsx`, `MaterialAssignmentStep.tsx`, `OutsourcedServiceForm.tsx`, `WorkOrderBasicInfo.tsx`, `PricingRuleDrawer.tsx`, 3 wizards partners, `Step1_ProductSelection.tsx`, `PurchaseOrderModal.tsx`, `ProviderDrawer.tsx`
  - Verify: `npm run type-check && npm run lint`
- [ ] **T6 (P1, human: ~2h / CC: ~30min)** — tests frontend — suite del selector (filtrado, edit-mode, regresión STORABLE-only, predicado simple-only)
  - Surfaced by: Section 3; IRON RULE regresión; OV-1, OV-4, OV-5
  - Files: `frontend/components/selectors/__tests__/ProductSelector.test.tsx`
  - Verify: `npm run test -- frontend/components/selectors`
- [ ] **T7 (P1, human: ~1h / CC: ~15min)** — ADR + docs — ADR (invariante 12), `component-selectors.md`, crear `TODOS.md`
  - Surfaced by: Section 1 issue 1; TODOs 1-2
  - Files: `docs/10-architecture/adr/`, `docs/20-contracts/component-selectors.md`, `TODOS.md`
  - Verify: revisión manual
- [ ] **T8 (P2, human: ~2h / CC: ~30min)** — backend — auditoría de líneas BOM existentes con MANUFACTURABLE (reporte/pivote)
  - Surfaced by: OV-3
  - Files: management command o script + `backend/production/tests/`
  - Verify: ejecución del comando

## Completion summary

- Step 0: Scope Challenge — migración completa aceptada (no reducción)
- Architecture Review: 3 issues (ADR, `context`, `product_type__in`)
- Code Quality Review: 2 issues (DRY BOM JSX, filtros redundantes)
- Test Review: diagram producido, 10 gaps + 1 regresión CRITICAL
- Performance Review: 1 issue (tope 200 aceptado)
- NOT in scope: written
- What already exists: written
- TODOS.md updates: 2 items propuestos (ambos "Add a TODOS.md")
- Failure modes: 0 critical gaps
- Outside voice: ran (claude subagent), 9 findings → 4 AUQ aprobadas (OV-1..OV-4, OV-8), 1 tensión cross-model (OV-6 mantener ambos), 3 correcciones técnicas (OV-5/7/9)
- Parallelization: 2 lanes, 2 parallel
- Lake Score: 6/6 recomendaciones completas

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 (claude subagent) | issues_found | 9 (4 aprobadas, 1 tensión resuelta, 3 correcciones) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open | 6 (3+2+1) + 10 test gaps + 1 regresión |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **VERDICT:** ENG REVIEW — issues_open (todos resueltos por decisión del usuario, pendiente de implementación). Ready to implement.

NO UNRESOLVED DECISIONS
