# Tab «Resumen» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el Resumen legado por una vista que reúne la cifra protagonista y los hallazgos de cada tab visible, con acceso directo a cada tab, y dejar de usar `LegacyInsightsPanel` en el modal.

**Architecture:** Solo cliente. `composeOverview` (pura) reutiliza las funciones `compose*` de cada tab sobre los datos de sus hooks; `OverviewBlock` llama a los siete hooks (con `productId = null` para los tabs no visibles) y navega con `onSelectTab`.

**Tech Stack:** Next.js 16, TypeScript, TanStack Query, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-product-overview-tab-design.md` (aprobado).

## Global Constraints

- Zero `any`; tokens semánticos; hooks en `features/inventory/hooks/` (Resumen no llama a la API directo).
- Mismos parámetros de período que los tabs para compartir caché; `idle_days` 90 e `increase_pct` 10.
- Ningún tab monta `LegacyInsightsPanel`; se elimina el aviso de histórico.

## Review Focus

1. Un tab no visible no dispara su consulta (hook con `productId = null`).
2. Una fuente con error no impide mostrar las demás.
3. Hallazgos en el orden del riel y con la etiqueta del tab.
4. Producto que solo tiene Resumen visible: «Sin hallazgos en el periodo» y sin tarjetas.
5. Al cambiar de período, Resumen vuelve a consultar con el nuevo `date_from`.

---

### Task 1: `composeOverview`

**Files:** Create `frontend/features/inventory/analytics/composeOverview.ts`; Test `analytics/__tests__/composeOverview.test.ts`.

- Produces:
  ```ts
  export interface OverviewSources {
      sales?: ProductSales | null; pricing?: ProductPricing | null; costs?: ProductCosts | null
      procurement?: ProductProcurement | null; inventory?: ProductStockAnalysis | null
      production?: ProductProductionAnalysis | null; subscription?: ProductSubscriptionAnalysis | null
  }
  export type OverviewValueKind = "money" | "number" | "percent" | "days"
  export interface OverviewCard {
      tab: ProductAnalyticsTabId; label: string; value: number | null; kind: OverviewValueKind
      unit?: string; context?: string; delta?: { current: number; previous: number; inverse?: boolean }
  }
  export interface OverviewFindingGroup { tab: ProductAnalyticsTabId; findings: Array<{ id: string; message: string }> }
  export function composeOverview(sources: OverviewSources, capabilities: { has_variants: boolean }): { cards: OverviewCard[]; groups: OverviewFindingGroup[] }
  ```
  Solo genera tarjeta y grupo para las fuentes con datos (claves ausentes o `null` se omiten), en el orden `TAB_ORDER`; grupos sin hallazgos se omiten. Cifras según la tabla del spec.
- [ ] Tests (RED): una tarjeta por fuente con la cifra de la tabla (ventas con delta; precio con margen o precio según `has_cost`; costos con el `hero` de `composeCosts`; abastecimiento con cobertura o gasto; inventario existencia; producción unidades o consumo; suscripción anualizado); fuentes `null` no generan tarjeta; grupos de hallazgos por tab en orden del riel, reutilizando los mensajes de cada `compose*`; grupos vacíos omitidos.
- [ ] FAIL → implementa → PASS → commit `feat(inventory): composición del resumen del análisis de producto`.

### Task 2: `OverviewBlock`, navegación y retiro del legado en el modal

**Files:** Create `analytics/OverviewBlock.tsx`; Modify `analytics/TabContent.tsx` (prop `onSelectTab: (tab: ProductAnalyticsTabId) => void`; caso `overview` → `<OverviewBlock … />`; sin `LegacyInsightsPanel`; elimina `tabHasLegacyContent` y `MIGRATED_TABS`), `components/ProductAnalyticsModal.tsx` (pasa `onSelectTab={setActiveTab}`; elimina el aviso de histórico y el import de `tabHasLegacyContent`); tests `analytics/__tests__/OverviewBlock.test.tsx`, `TabContent.test.tsx`, `components/__tests__/ProductAnalyticsModal.test.tsx`.

- [ ] Tests (RED), con los siete hooks mockeados: solo los tabs visibles reciben el `productId` (el resto `null`); muestra una tarjeta por fuente con datos; una fuente cargando muestra su tarjeta en carga y una con error muestra su error sin ocultar las demás; los hallazgos aparecen agrupados con el nombre del tab; el botón «Ver en Costos» llama `onSelectTab("costs")`; sin hallazgos muestra «Sin hallazgos en el periodo»; el período se pasa a los hooks. En `TabContent.test.tsx`: `overview` monta `OverviewBlock`; ningún caso monta `LegacyInsightsPanel`. En el modal: el aviso «Este tab muestra todo el histórico» no aparece en ningún tab; hacer clic en «Ver en <tab>» cambia el tab activo (con `OverviewBlock` mockeado que expone un botón que llama `onSelectTab`).
- [ ] FAIL → implementa → `vitest features/inventory`, `tsc`, `lint` → commit `feat(inventory): resumen con cifras y hallazgos de todos los tabs`.

### Task 3: Documentación y verificación final

ADR-0150 (Resumen migrado por agregación en el cliente; ningún tab usa `insights`; el aviso de histórico se retira; queda pendiente borrar el legado), spec (desvíos). Verificación completa; commit `docs: resumen en ADR-0150`; push al PR #275 y actualización de su descripción.
