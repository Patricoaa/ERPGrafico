---
id: 0100
title: Document drilldown stacks over the origin list — origin list and module are kept (behind a feature flag)
status: Proposed
date: 2026-10-26
author: frontend-team
---

# 0100 — Document drilldown stacks over the origin list

**Related:** ADR-0086 (drilldown navigates — this ADR supersedes its decision 1 when the flag is on), ADR-0028 (entity drawer registry + in-memory stack), ADR-0083 (document sheet), ADR-0020 (`?selected`), contracts `component-entity-drawers.md` §3 and §5.2, `document-relations.md`.

---

## Context

ADR-0086 made the drilldown **navigate** to the target's canonical list (`?selected=`), so the module rail followed the relationship. Using it in the dev server showed the cost:

- the origin list and the user's place in it are **replaced**; "browser Back" is the only way home;
- the destination often opens a *different surface* than the sheet (e.g. a journal entry opened as an **edit form** in Accounting instead of the read-only view stacked from the invoice);
- the in-memory stack is not cleared on navigation, so the origin drawer lingers on top of the destination page until the destination list mounts (observed for 35–40 s while the dev server compiled the target route);
- three mechanisms coexist (stack, `?selected` + document sheet, `?selected` + page-own modal) and they are not coordinated.

Product decision (2026-10): **keep the origin list and the origin module while navigating by the stack**, and make unsaved edits impossible to lose silently.

## Decision

1. **One entry point.** Every surface that opens "another document" calls `useOpenDocument()` (`frontend/hooks/useOpenDocument.ts`): `useOpenRelatedDocument` (Relations tab rows), `SourceDocumentLink`, `DocumentRefLink`. An ESLint rule (`drilldown/no-bypass`, `warn`) flags importing `isListSelectionUrl` outside the helper.
2. **Feature flag.** `isDrilldownStackEnabled()` (`@/lib/documentNavigation`): `NEXT_PUBLIC_DRILLDOWN_STACK=true` at build, or `localStorage["erp.drilldownStack"] = "1"` for per-browser QA. Evaluated on each click.
3. **Flag on:** if the label has a registered drawer, `openEntity(label, id, undefined, undefined, { display })` — stack over the origin list, module and URL unchanged, "Volver a …" available. No `data` is passed (the registry loads by id). **No drawer registered** (e.g. `inventory.subscription`, `treasury.paymentmethod`, `accounting.budget`, `tax.taxperiod`, `production.bom`): `router.push(DocumentRef.url)`.
4. **Flag off:** ADR-0086 behaviour, unchanged.
5. **Canonical URLs stay** for external links, universal search, `/d/{label}/{id}` and server redirects (`[id]/page.tsx`). They are the exception to "do not navigate".
6. **Unsaved-changes guard** (delivered with phase 2, always on): a dirty drawer form blocks opening another document, "Volver", closing (X / Escape / Cancel / row switch) and page unload until the user chooses *Guardar y continuar*, *Descartar y continuar* or *Seguir editando*. Implemented by `DirtyRegistry` in `GlobalModalProvider` (`registerDirty`, `runGuarded`, `requestLeave`), `useDirtyGuard` (wired through `useInitializeDrawerForm`), `UnsavedChangesDialog`, and the URL helpers `useEntityRouteActions` / `useSelectedEntity`. Only the top drawer is mounted, so drawers below the top are always clean.
7. **Closing** (X / Escape / outside click / `onSuccess`) pops one level through the same guard as "Volver"; with a single document it closes. `closeEntity` (clear all) stays for programmatic use.
8. **Breadcrumbs and module indicator** (phase 4): the `Drawer` header renders `EntityTrail` (`nav aria-label="Ruta de documentos"`, `ol`, current `aria-current="page"`, previous levels clickable and guarded by `runGuarded`; more than 3 previous levels collapse into "…"; on mobile only "Volver a X"). A `Chip` with the module name appears when the top document's module (from `getEntityMetadata(label).listUrl`) differs from the page module, so the rail staying put is never ambiguous. Context: `EntityNavigation` in `EntityNavigationContext`.

## Consequences

- The module rail and sidebar stay on the origin while drilling; the user must see *where* the open document lives. A module chip in the drawer header (phase 4) is required before the flag becomes the default.
- Documents stacked over a list are no longer shareable by URL (`?stack=` serialization is a separate spike: it re-introduces the alternative ADR-0086 rejected and conflicts with `useDocumentSheetRoute`).
- Destinations that used a page-own edit modal now open their registered **view** drawer; editing from the stack goes through that drawer's own flow.
- Known gaps in the guard: browser Back/Forward, and page-mounted drawers closed through local state rather than the URL helpers.
9. **Stack in the URL** (phase 5, same flag): with two or more documents the stack travels in `?stack=label:id,label:id` (base → top, base included; `lib/drilldownStackUrl.ts`). `useDrilldownStackUrl` (in `GlobalModalProvider`) mirrors stack → URL with the native History API: opening a document pushes a history entry (Back pops, Forward re-stacks), popping/closing replaces the entry, and reload or a shared link rebuilds the stack. Only labels that open by id (`isRestorableById` in `lib/entity-drawers.tsx`) are serialized; masters that need the row (`data`) stay memory-only. Back/Forward with unsaved changes goes through `runGuarded`; if the user keeps editing, the URL is restored. `?selected` still names the list selection; `useDocumentSheetRoute` opens it with `openRootEntity`, which keeps an already-restored base. Known limit: popping with "Volver"/X replaces the history entry (the entry created on open stays as a duplicate Back step).
10. **Pinned documents** (phase 5): a document that opens by id can be pinned from the trail (pin button, `aria-pressed`). Pins are per browser (`localStorage["erp.pinnedDocuments"]`, max 5, `lib/pinnedDocuments.ts`) and render as chips under the trail in every stacked drawer. Clicking a chip pops to it if it is in the stack, otherwise stacks it (both through the unsaved-changes guard). Chips only show while a stack of two or more is open; the permanent tabbed panel stays out of scope until usage data justifies it.

## Rollout

1. Merge with the flag off (no behaviour change).
2. Enable per browser (`localStorage`) for QA; verify the chains OV → invoice → journal entry → back, and master drawers.
3. Enable via `NEXT_PUBLIC_DRILLDOWN_STACK=true` in dev; collect feedback.
4. When stable: make it the default, remove the flag and the legacy branch, raise `drilldown/no-bypass` to `error`, mark ADR-0086 *Superseded by 0100*.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep navigating (ADR-0086) | Replaces the origin list, orphan drawer during transition, destination may open an edit form |
| Reset the stack on `pathname` change only | Fixes the lingering drawer but not the lost origin list or the edit-form destination |
| Permanent workspace with tabs | 3–5 weeks, conflicts with `usePathname()`-driven rail; `pin` to chips kept as phase 5 option |
| Intercepting / parallel routes | Rejected in ADR-0086 and still valid (rail and content disagree; soft-nav vs refresh) |
