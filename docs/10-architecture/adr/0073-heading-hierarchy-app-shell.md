---
id: 0073
title: Heading hierarchy for app-shell pages (one H1 per module root)
status: Accepted
date: 2026-10-09
author: core-team
---

# 0073 — Heading hierarchy for app-shell pages (one H1 per module root)

**Related:** `component-section-header.md`, `PageSectionHeader.tsx`, `PageHeader.tsx`

---

## Context

The system renders **no `<h1>` anywhere inside the app shell**. A screen-crawling probe (Fase 1, dashboard + DataTable + Detail + Settings + Login) found:

- `PageSectionHeader` is used as the de-facto page title in every module root (`app/(dashboard)/page.tsx:12`, `settings/company/general/page.tsx:13`, `finances/analysis/bi/page.tsx:7`, `finances/statements/{pl,bs,cf}/page.tsx`) and hardcodes `<h2 className="text-lg font-semibold tracking-tight">` (`PageSectionHeader.tsx:42`).
- `PageHeader` — the component `component-section-header.md:16` authorizes for "page-level title" — is a **side-effect** (HeaderProvider + `useEffect`, `PageHeader.tsx`) that renders **no DOM heading**.
- **Login is the exception** and the only page with a real `<h1>` ("Iniciar sesión"), plus `autocomplete` and a skip-link (LOG-01). It is the reference implementation.
- Contract drift: `component-section-header.md:17` misdescribes `PageSectionHeader` as "Tabs navigation within a page", but the codebase uses it as page title (+tabs). `SectionHeader` (h2) is for cards; `SectionHeader variant="list"` is for page-level sections — the three-way split is documented but the H1 role is **unowned**.

Consequence: no single-screen reader / document-outline anchor per module; URL deep-links (e.g. `/contacts/1`) give a blank main with zero headings, and the accessible name of each module is the topbar breadcrumb, not an in-content heading (DSH-01, SET-03, BI-01).

## Decision

1. **Every app-shell module root page renders exactly one `<h1>`** — the module's page title.
2. **`PageSectionHeader` becomes the single authorized renderer for that H1.** Add an `as?: "h1" | "h2"` prop to `PageSectionHeader` (`"h2"` default). Module-root pages pass `as="h1"`. Typography unchanged (`text-lg font-semibold tracking-tight text-foreground`); only the element changes. `description` stays a `<p>`.
3. **`PageHeader` (the side-effect) is explicitly *not* the H1 owner.** It remains shell chrome: breadcrumb + global actions via `HeaderProvider`. This is documented, so future "page title" work goes to `PageSectionHeader`, never back to `PageHeader`.
4. **`SectionHeader` stays `<h2>`** for in-card/in-list sections (its contract is unchanged).
5. **Fix the doubled headers** revealed in Fase 1 (DSH-02, SET-03, BI-01): a module root renders `PageSectionHeader as="h1"` as the single title; the shell's `PageHeader`-driven description/branding moves to the shell proper or is removed where redundant.
6. **`component-section-header.md` is corrected**: `PageSectionHeader` = page-level title (optional H1) + tabs; `PageHeader` = shell chrome only; `SectionHeader` = section headings. The H1 role is now owned, and `SectionHeader`'s "heading structure" copy (currently `[icon] Title · count…` `text-[10px]`) applies to it alone.

## Consequences

### Positivas
- Coherent document outline (exactly one H1 per module, H2s for sections/tabs).
- Login becomes the *canonical* pattern, codified — LOG-01 stops being an accident.
- Deep-linked pages have an in-content accessible name even when the list+drawer main is nominally empty (mitigates DET-01's blank-main case).
- Fixes three P2 findings (DSH-01, SET-03, BI-01) with one prop.

### Negativas
- Visual change risk: swapping the H2 to H1 may shift default UA margins/stacking. Mitigated by keeping the same Tailwind classes (element change only) + a one-time visual regression pass.
- Call sites that use `PageSectionHeader` with a title but are *not* module roots (rare) must explicitly keep `as="h2"`.
- `PageSectionHeader` is a client component (uses `usePathname`/`useRouter` for tabs); the H1 will be client-rendered where it already is today (no SSR regression).

### Archivos modificados (estimado)
- `frontend/components/shared/PageSectionHeader.tsx` — `as` prop
- `frontend/components/shared/PageHeader.tsx` — doc comment only (or removal of unused title rendering path)
- `frontend/app/(dashboard)/*/**/page.tsx` — pass `as="h1"` on module roots
- `docs/20-contracts/component-section-header.md` — ownership + wording
- `docs/10-architecture/adr/README.md` (index)

## Alternatives considered

- **`PageHeader` renders the H1** in the shell. Rejected: the shell is shared — nested/duplicate H1s across every page, and the side-effect component would need to change rendering contract.
- **Keep `<h2>` and use `aria-level`** to fake hierarchy. Rejected: markup pragmatism; the real tag is free and auditable.
- **Global CSS making every `h2:first-of-type` behave as H1** for AT. Rejected: abandons semantic markup, breaks `SectionHeader` h2s inside cards.

## References

- `frontend/components/shared/PageSectionHeader.tsx:42` — hardcoded `<h2>`
- `frontend/components/shared/PageHeader.tsx` — side-effect, no DOM heading
- `docs/20-contracts/component-section-header.md:16-18` — component matrix (to correct)
- `docs/20-contracts/typography-scale.md` — heading size lineage (unchanged by this ADR)
- LOG-01 reference: `frontend/app/login/**` — only real `<h1>` in the app