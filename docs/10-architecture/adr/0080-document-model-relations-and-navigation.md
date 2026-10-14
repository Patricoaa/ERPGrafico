---
id: 0080
title: Unified document model — DocumentRef, relation service and canonical document navigation
status: Accepted
date: 2026-10-14
author: backend-team
---

# 0080 — Unified document model: DocumentRef, relation service and canonical navigation

**Related:** documentary audit `docs/50-audit/documental/` (target architecture, migration roadmap, decisions D1–D6), `docs/20-contracts/document-relations.md` (new), `docs/20-contracts/component-entity-drawers.md`, `docs/20-contracts/entity-identity.md`, ADR-0016 (source-document GFK), ADR-0020 (`?selected` deep links), ADR-0028 (entity drawer registry).

**Status note:** Accepted 2026-10-14 by the project owner. M2 (additive) and M3 (common document sheet, `openEntity` stack, Order Hub as OV/OC sheet) are implemented under this ADR.

---

## Context

The documentary audit (2026-10-14) found ~25 document types in app-specific models, related mostly through typed FKs, but:

- relations are exposed in **3 incompatible formats** (`related_documents` buckets of the Order Hub, `Invoice.related_documents`, `JournalEntry.source_documents`) and only two UIs render them;
- identity and routing live in **7 parallel registries** (backend `UniversalRegistry`, FE `ENTITY_REGISTRY`, `ENTITY_DRAWERS`, `searchableEntityRoutes`, `DRAWER_MAP`, `TYPE_TO_REGISTRY`, `ActivitySidebar` types) with 29 detail routes that do not exist;
- several relations were written wrong or not at all (INT-01…06). Phases M0/M1 repaired persistence (typed StockMove ↔ document link, delivery fulfilment, single paid-amount rule, typed invoice → order).

Product decisions D1–D4 constrain the design: invoices relate to orders N:M (D1), payments are allocated to invoices with the order derived (D2), the Order Hub stays the sheet of OV/OC (D4).

## Decision

1. **No parent `Document` table and no generic relation table.** Business relations stay as typed FKs with their referential integrity. A generic table would duplicate them and lose `PROTECT`/`SET_NULL` semantics.
2. **`DocumentTypeRegistry` extends `UniversalRegistry`** (it is not an 8th registry). For each label it adds what navigation needs: canonical URL, status/date/partner fields, view permission. Titles, icons and permissions come from the `SearchableEntity` already registered.
3. **`DocumentRef`** is the only shape that travels between modules and to the UI:
   `{label, id, display_id, title, icon, status, status_display, date, partner_name, url, accessible, exists}`.
   `exists=false` exposes dangling references instead of hiding them; `accessible=false` shows the relation without its content.
4. **`DocumentRelationService`** resolves relations through **providers per document type**, declared in each app's `relations.py` (autodiscovered). Providers read the normalized FKs; they never parse text. Each link is a `DocumentLink`:
   `{semantic, direction, role, target: DocumentRef, amount?, quantity?, is_dependency}` with `semantic ∈ derivation | fulfillment | settlement | posting | correction | reference | association`.
   Invoice ↔ order is returned as a **list** in both directions from day one (D1), so the switch to invoice lines (GAP-13) does not change the contract.
5. **Endpoints** (read-only, additive):
   - `GET /api/core/documents/{label}/{id}/` → `DocumentRef`
   - `GET /api/core/documents/{label}/{id}/relations/?semantic=&direction=` → `{document, relations[], unresolved[]}`
6. **Canonical URL** is generated only by the registry. It stays `list_url?selected={id}` (ADR-0020) where the list really opens that document. Types without such a list use the resolver route **`/d/{label}/{id}`**, which opens the registered entity drawer. OV/OC (and sale invoices) keep opening the Order Hub through `?selected` (D4).
7. **Legacy formats stay** (`related_documents`, `Invoice.related_documents`, `source_documents`) and are marked deprecated; they are removed in M6 once their consumers reach zero.

## Consequences

- New contract `docs/20-contracts/document-relations.md` (layer 20).
- M3 (requires this ADR Accepted): `DocumentDrawerShell` + `RelatedDocumentsTable`, `openEntity` with a stack and "back", Order Hub consuming `relations`, `DRAWER_MAP` retirement. These modify `component-entity-drawers.md`.
- Each new document type must register a canonical URL and, if it has relations, a provider; a sync test fails when a registered canonical URL has no frontend route.
- Cost: one provider per document type; relation queries are per document (bounded, no N+1 across lists).

## Alternatives considered

| Alternative | Why not |
|---|---|
| Parent `Document` table | Mass migration over ~25 models with PROTECT FKs; no gain for relations that are already FKs |
| Generic relation table | Loses referential integrity; a 4th representation of payment ↔ document |
| Frontend-only navigation layer | Does not fix persistence; keeps 3 backend formats |
| New independent registry | Would be the 8th registry |
