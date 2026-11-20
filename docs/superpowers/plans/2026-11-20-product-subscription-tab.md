# Tab «Suscripción» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `OperationsBlock` en el tab `subscription` por un análisis de costo recurrente, pagos del período, subidas de precio y vencimientos.

**Architecture:** Endpoint `GET /inventory/products/{id}/subscription-analysis/` (`subscription_analysis_selector.py`) sobre `Subscription` y `PurchaseLine`; cliente `useProductSubscriptionAnalysis`, `composeSubscription`, `SubscriptionBlock`, como los tabs anteriores.

**Tech Stack:** Django 5 + DRF, pytest; Next.js 16, TypeScript, TanStack Query, Nivo, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-product-subscription-tab-design.md` (aprobado).

## Global Constraints

- Zero `any`; tokens semánticos; `AnalyticsBlockFrame`/`SkeletonShell`; hooks en `features/inventory/hooks/`.
- Vista ≤ 20 líneas; zero N+1.
- Hallazgos: `change_pct ≥ 5`; `differs_from_amount` (> 1 %); activa con `days_to_payment < 0`; `0 ≤ days_to_end ≤ 30`; alguna `PAUSED`.

## Review Focus

1. Suscripción sin pagos: `last_payment` y `change_pct` en `null`, `differs_from_amount` falso.
2. Pagos de dos proveedores: la variación compara solo pagos del mismo proveedor.
3. Órdenes en borrador o anuladas no cuentan como pago.
4. `today` se mide desde hoy aunque `date_to` sea pasado.
5. Período `all`: sin `previous` ni `previous_points`.

---

### Task 1: Endpoint `subscription-analysis`

**Files:** Create `backend/inventory/subscription_analysis_params.py`, `backend/inventory/subscription_analysis_selector.py`; Modify `backend/inventory/views.py` (acción `subscription_analysis`, `url_path="subscription-analysis"`); Tests `backend/inventory/tests/test_subscription_analysis_selector.py`, `test_subscription_analysis_endpoint.py`.

- Produces `SubscriptionAnalysisParams(date_from, date_to, granularity="month")`, `SubscriptionAnalysisSelector.get_analysis(product, params) -> {today, kpis, series, subscriptions, payments}`. Reutiliza `_FREQUENCY_FACTOR` de `operations_selector`.
- [ ] Tests (RED): `test_today_matches_operations` (anualizado, mensual, activas, próximos 90 días iguales a `OperationsSelector._subscriptions`); `test_kpis_paid_and_payments_in_range`; `test_draft_and_cancelled_orders_are_not_payments`; `test_previous_and_aligned_points`; `test_previous_none_without_date_from`; `test_last_payment_and_change_by_supplier`; `test_differs_from_amount`; `test_subscription_without_payments`; `test_days_to_end`; `test_payments_list_with_change`; `test_query_count_constant`; endpoint: claves, 400, 400, 404.
- [ ] FAIL → implementa → PASS + ruff + `pytest inventory -q` → commit `feat(inventory): endpoint subscription-analysis con costo recurrente y pagos`.

### Task 2: Contrato, API y hook

Create `analytics/subscriptionAnalysis.types.ts`, `hooks/useProductSubscriptionAnalysis.ts` + test (copia de `useProductProcurement`); Modify `api/inventoryApi.ts`, `index.ts`. RED → PASS + `tsc` → commit `feat(inventory): hook useProductSubscriptionAnalysis y contrato del endpoint subscription-analysis`.

### Task 3: `composeSubscription`

Create `analytics/composeSubscription.ts` + test. Produces `composeSubscription(data): { findings: SubscriptionFinding[]; sections: Array<"chart" | "subscriptions" | "payments"> }` con `SubscriptionFindingId = "price_increase" | "amount_mismatch" | "overdue" | "ending_soon" | "paused"`, `PRICE_INCREASE_THRESHOLD = 5`, `ENDING_SOON_DAYS = 30`. Tests por umbral (5 sí / 4,9 no; vence en 30 sí / 31 no / ya vencida no; `days_to_payment` −1 en activa sí, en pausada no) y por sección (`chart` y `payments` con pagos; `subscriptions` con filas). RED → PASS → commit `feat(inventory): composición y hallazgos del tab suscripción`.

### Task 4: `SubscriptionBlock` y reemplazo en `TabContent`

Create `analytics/SubscriptionBlock.tsx`, `entity-view/subscriptionAnalysis.entity.ts` (suscripciones con estado como texto y frecuencia con etiqueta en español; pagos); Modify `analytics/TabContent.tsx` (caso `subscription` → `<SubscriptionBlock productId period />`, sin `OperationsBlock`); tests `SubscriptionBlock.test.tsx`, `TabContent.test.tsx`, `ProductAnalyticsModal.test.tsx` (el tab de suscripción monta el bloque nuevo).

- [ ] Tests (RED) con hook y gráfico mockeados: «Hoy» (anualizado, mensual, activas, 90 días); pagos del período con variación; gráfico con período anterior; tabla de suscripciones con último pago y variación; tabla de pagos; hallazgos; sin pagos mantiene «Hoy» y suscripciones; skeleton; parámetros. → implementa → `vitest features/inventory`, `tsc`, `lint` → commit `feat(inventory): tab suscripción con costo recurrente, pagos y vencimientos`.

### Task 5: Documentación y verificación final

ADR-0150 (tab `subscription` migrado; `OperationsBlock` sin consumidores en el modal), `api-contracts.md`, spec (desvíos). Verificación completa; commit `docs: tab suscripción en ADR-0150 y contratos`; push al PR #275 y actualización de su descripción.
