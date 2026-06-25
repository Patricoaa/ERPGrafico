---
layer: 90-governance
doc: governance
status: active
owner: core-team
last_review: 2026-05-28
---

# GOVERNANCE — Project constitution

Rules apply to every PR. Violations block merge unless an accepted ADR waives the rule.

## 1. Type safety

1. **Zero `any`** in TypeScript. Use Zod-derived types or `unknown` + type guard.
2. Prefer `type` over `interface` unless extending.
3. No `@ts-ignore` / `@ts-expect-error` without inline comment citing the root cause + ADR if systemic.
4. No `non-null-assertion!` except in tests.

## 2. Naming

5. React components: `PascalCase`.
6. Hooks: `camelCase` with `use` prefix (`useSaleOrders`).
7. Types / interfaces: `PascalCase`, no `I` prefix, no `Type` suffix.
8. Constants (config, enum-ish): `UPPER_SNAKE_CASE`.
9. Files: match exported symbol (`SaleOrder.tsx` exports `SaleOrder`).
10. Feature folder: singular lowercase (`invoice`, not `invoices`).
11. **Component suffix must match the surface it renders** — see [naming-conventions.md](./naming-conventions.md) for the full suffix table (`Drawer`, `Modal`, `Sheet`, `Wizard`, `View`, `Form`, `Step`…). `FormModal` and `FormDrawer` are prohibited.

## 3. Visual system

12. No raw Tailwind colors (`bg-red-500`), no literal hex/rgb in `className`/inline style, no `white`/`black` utilities — semantic tokens only. Enforced by the `tw/no-raw-color` ESLint rule. Full contract: [color-system.md](../20-contracts/color-system.md).
13. Primary color: Process Cyan `oklch(0.65 0.18 235)` via `text-primary` / `bg-primary`. Layer 1 inks are **fixed** across light/dark; Layer 2 intents carry the dark-mode adaptation. `info` = blue, `accent` = neutral interaction surface, data-viz uses `--chart-1…6` (CMYK inks). Changing a Layer 1/2 value requires an ADR.
14. `font-sans` (Onest) for body; `font-heading` (Syne) for headings.
15. Border radius default: `0.5rem`. No `rounded-xl` on form components without ADR. `rounded-full` limited to: StatusBadge, avatar/entity icons, icon-only buttons, filter pills, skeleton circles, scrollbar thumbs. `rounded-none` only permitted in: nested analytics cards (within a Card container), segmented toolbar buttons, underline tabs, error boundary containers, specific skeleton presets.
16. 8pt grid — padding/margin/gap multiples of 8px.
17. Minimum interactive height: `h-10` (40px).
18. Source of truth: `frontend/app/globals.css`. No theme changes elsewhere.

## 4. Component rules

19. `StatusBadge` is the ONLY authorized status renderer.
20. All shared components handle `loading` (Skeleton), `empty` (EmptyState), `error` (toast).
21. Shared components documented in `20-contracts/component-*.md` with full prop table.
22. Do not modify `components/ui/` (Shadcn base). Extend in `components/shared/`.
23. Promotion to `components/shared/` requires ≥3 consumers + contract entry.

## 5. Hook rules

24. Hook names: `use[Entity][Action]`. Return domain-named properties (`orders`, not `data`).
25. Errors handled internally via `showApiError` toast; do not expose `error`.
26. Loading flags: `isLoading` (initial), `isFetching` (refetch), `isCreating` / `isUpdating` / `isDeleting`.
27. No `useQuery` / `useMutation` directly in components. Wrap in feature hook.
28. `@/lib/api` importable only from `features/*/api/*`, `features/*/hooks/*`, and `/hooks/*`.

## 6. Forms

29. All forms: `react-hook-form` + `zodResolver`.
30. Zod schema in `components/forms/schema.ts`; TS type is `z.infer<typeof Schema>`.
31. Backend serializer is authoritative; frontend Zod mirrors it.

## 7. FSD boundaries

32. A feature never imports internals from another feature. Use barrel `index.ts` or promote to `/shared`.
33. `app/*` imports only feature barrels, not internals.
34. Global hooks live in `/hooks/` only when consumed by ≥3 unrelated features.

## 8. Backend layering

35. Views ≤20 lines per action. Business logic in `services.py`.
36. Complex reads in `services.py` or `ViewSet.get_queryset()`.
37. Permission class declared on every viewset.
38. Multi-table writes wrapped in `transaction.atomic()`.
39. Async side effects via Celery — never synchronous in request path when >300ms.
40. **Zero N+1** — No ORM queries (`.objects.filter/get/create`) inside any `Serializer` or `SerializerMethodField`. All related data MUST be preloaded via `select_related` / `prefetch_related` in the ViewSet. Creation of object graphs belongs in `services.py` with `@transaction.atomic`. Enforced by `assertNumQueries` tests on every list endpoint. See [zero-n-plus-one-policy.md](./zero-n-plus-one-policy.md).

## 9. API contracts

40. Every endpoint documented in `20-contracts/api-contracts.md`.
41. Money fields: `DecimalField`. Transactional document totals use `decimal_places=0` (CLP has no minor unit — see ADR-0014). Canonical names: `total_net`, `total_tax`, `total`. Render only via `MoneyDisplay`. **No `_cents` integer convention.**
42. IDs: integer auto-increment PK (no UUID — see ADR-0016 anti-goals). The business identifier is exposed as `number` / `display_id` and formatted via `ENTITY_REGISTRY` (`entity-identity.md`).
43. Dates: ISO-8601 UTC (`Z` or `+00:00` — formato uniforme dentro de cada serializador) para datetimes; `YYYY-MM-DD` para date-only. Nunca datetimes naive (sin timezone). En frontend, prohibido usar `new Date("YYYY-MM-DD")` — parsear siempre con `new Date(y, m-1, d)` o `parseDateOnly`.
44. Breaking API change: ADR + parallel period. Versioning is unified SemVer across FE+BE (ADR-0012) — there is no per-URL `/api/vN/` versioning.

## 10. State

45. Entity states defined in `20-contracts/state-map.md`. Single source of truth.
46. `BUSINESS_STATES.md` is deprecated. Do not reference.
47. Invalid transitions return 409 Conflict.

## 11. Testing

48. Coverage thresholds enforced (see `40-quality/testing.md`).
49. Flaky test = bug. No permanent `@skip`.
50. Tests co-located with source.

## 12. Security

51. Every PR touching auth / permissions / uploads reviewed by security team.
52. Never log or transmit secrets / PII in plaintext (see `40-quality/security.md`).

---
last_review: 2026-06-25

## Amendment

Changes to this document require ADR. Open PR, link ADR, two approvals from code owners.

## Enforcement

- ESLint / ruff / mypy / pytest pre-commit hook.
- CI gates per `40-quality/ci-cd.md`.
- Contract drift detector between backend and frontend.
- Link-checker on docs/.
