---
id: 0083
title: Document sheet replaces the Order Hub — relations tab, lifecycle and in-sheet actions
status: Accepted
date: 2026-10-15
author: frontend-team
---

# 0083 — Document sheet replaces the Order Hub

**Related:** ADR-0080 (document model, relations, navigation — decision D4 is reverted here), ADR-0081 (invoice lines), ADR-0028 (entity drawer registry), ADR-0076 (CMYK navigation accents), plan `docs/50-audit/documental/ui-document-sheet-plan.md`, contract `docs/20-contracts/component-document-sheet.md` (new).

**Status note:** Accepted 2026-10-15 by the project owner, together with the five UI decisions recorded in `docs/50-audit/documental/document-decisions.md` (D7–D11). **Implemented U0–U6 (2026-10-15):** the Order Hub and the legacy relation formats are removed.

---

## Context

ADR-0080 decision D4 made the **Order Hub** (a 320 px global side panel with five phase accordions, ~4,600 lines in `features/orders`) the sheet of sale/purchase orders. The Hub:

- duplicates navigation: every other document opens a drawer, OV/OC open a different surface;
- reads the deprecated `related_documents` buckets, which blocks ADR-0080 §7 (legacy formats removal);
- runs actions through a hidden global "headless engine" driven by a `ref` (`triggerAction`), with a `setHubTemporarilyHidden` workaround for modals;
- coexists with hand-built document drawers that share no structure (each repeats `Drawer` + grid of `<span>`s + line list).

The owner asked to drop the Hub entirely and move connections, relations and actions into a common document sheet with a reusable relations tab, reordering every document with the system's hierarchy primitives.

## Decision

1. **One document sheet for all documents.** `DocumentDrawerShell` (shared) gains the zones header (with the actions menu) → lifecycle → tabs (`TabBar` horizontal `underline`) → activity sidebar, plus an `embedded` mode (no Drawer) for inline views. Standard tabs: **Resumen** (Contexto + Productos with totals) **· Relaciones**, then type-specific tabs only when they add something Relaciones does not cover.
2. **Reusable relations tab** — `DocumentRelationsTab` (`@/features/documents`) groups `GET /relations/` by **operational area** in cycle order (Origen, Facturación, Producción, Logística, Tesorería, Contabilidad, Otros), with per-area actions ("+ Registrar pago"), per-row actions (annul/cancel) and an area filter. It replaces the Hub phases, `DocumentListModal` and `PaymentHistoryModal`.
3. **`domain`, `amount` and `detail` are declared by the backend registry** (areas include Contactos; the service adds the journal entries of related documents and the counterparties as indirect links) (`DocumentTypeRegistry.domain(label)`, app default + per-type override) and exposed in `DocumentRef` — additive change to the `document-relations.md` contract. The frontend keeps only presentation (label, icon, order); no 8th registry.
4. **Actions live inside the sheet**, in a single **"Acciones" menu in the Drawer header** next to close, which also holds **Imprimir** (pilot refinement, 2026-10-15). The action registries (`features/sales/actions.tsx`, `features/purchasing/actions.tsx`) are kept as-is. `resolveRegistryActions` evaluates them (same rules as the Hub); the menu starts with the **next cycle step**, then the other actions, print, and destructive ones separated. Execution moves to `useOrderActionEngine` (the Hub's `ActionCategory` delegates to it until removal); no global ref.
5. **Lifecycle strip** (`DocumentLifecycle`, steps only — amounts live in the Resumen totals box) replaces `HubStatus`/`OrderHeaderDashboard` in the sheet, rendered with `StatusBadge variant="hub"` (invariant 7). Clicking a step opens Relaciones filtered by that area. Billing uses `invoicing_status` (ADR-0081).
6. **D4 is reverted.** `openEntity('sales.saleorder' | 'purchasing.purchaseorder')` and the list `?selected` open the document sheet. Rollout is a pilot: OV first (U2), then OC + invoices/notes (U3), entry points (U4), the remaining sheets (U5) and removal of the Hub, `HubPanelProvider`, `?hub` and the legacy buckets (U6).
7. **POS keeps an inline view** (owner decision): `OrderSheet embedded` replaces the embedded `OrderHubPanel`, with its own action engine and `posSessionId`.

## Consequences

- New contract `component-document-sheet.md`; updates to `component-entity-drawers.md` (§2.2, OV/OC no longer redirect to the Hub), `document-relations.md` (`domain`, D4 removed) and `component-form-patterns.md` (`FormTabs` → `TabBar`, master/document sheet row).
- During U2–U5 the Hub and the sheet coexist: OC and invoices still open the Hub. Shared logic (action engine, annul-payment modal) is extracted once and used by both, so nothing is duplicated.
- U6 removes ~4,600 lines of `features/orders/components` and unblocks ADR-0080 §7 (removal of `related_documents` buckets and `JournalEntry.source_documents`).
- Risk: an action of the Hub without an equivalent. Mitigation: parity checklist per document type (plan §3) and unit tests on `resolveRegistryActions`/`planOrderSheetActions`.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep the Hub as OV/OC sheet (D4) | Two navigation models; blocks removal of legacy relation formats |
| One tab per area (Facturación, Logística, Tesorería…) + Relaciones | Duplicates the same documents in two places; 7–8 tabs in a drawer. Owner chose a single grouped tab |
| Vertical tab rail (form contract rule ≥5 tabs) | Eats drawer width needed by tables; master drawers (`ContactDrawer`) already use horizontal `underline` |
| Area mapping in the frontend | Would be another type registry; the backend registry already owns per-type metadata |
