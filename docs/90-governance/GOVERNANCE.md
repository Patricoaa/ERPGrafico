---
layer: 90-governance
doc: governance
status: active
owner: core-team
last_review: 2026-04-21
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

## 3. Visual system

11. No raw Tailwind colors (`bg-red-500`, `text-blue-600`). Semantic tokens only.
12. Primary color: Electric Violet `oklch(62% 0.244 301)` via `text-primary` / `bg-primary`.
13. `font-sans` (Onest) for body; `font-heading` (Syne) for headings.
14. Border radius default: `0.125rem`. No `rounded-xl` / `rounded-full` on form components without ADR.
15. 8pt grid — padding/margin/gap multiples of 8px.
16. Minimum interactive height: `h-10` (40px).
17. Source of truth: `frontend/app/globals.css`. No theme changes elsewhere.

## 4. Component rules

18. `StatusBadge` is the ONLY authorized status renderer.
19. All shared components handle `loading` (Skeleton), `empty` (EmptyState), `error` (toast).
20. Shared components documented in `20-contracts/component-contracts.md` with full prop table.
21. Do not modify `components/ui/` (Shadcn base). Extend in `components/shared/`.
22. Promotion to `components/shared/` requires ≥3 consumers + contract entry.

## 5. Hook rules

23. Hook names: `use[Entity][Action]`. Return domain-named properties (`orders`, not `data`).
24. Errors handled internally via `showApiError` toast; do not expose `error`.
25. Loading flags: `isLoading` (initial), `isFetching` (refetch), `isCreating` / `isUpdating` / `isDeleting`.
26. No `useQuery` / `useMutation` directly in components. Wrap in feature hook.
27. `@/lib/api` importable only from `features/*/hooks` and `/hooks/*`.

## 6. Forms

28. All forms: `react-hook-form` + `zodResolver`.
29. Zod schema in `components/forms/schema.ts`; TS type is `z.infer<typeof Schema>`.
30. Backend serializer is authoritative; frontend Zod mirrors it.

## 7. FSD boundaries

31. A feature never imports internals from another feature. Use barrel `index.ts` or promote to `/shared`.
32. `app/*` imports only feature barrels, not internals.
33. Global hooks live in `/hooks/` only when consumed by ≥3 unrelated features.

## 8. Backend layering

34. Views ≤20 lines per action. Business logic in `services/`.
35. Complex reads in `selectors.py`.
36. Permission class declared on every viewset.
37. Multi-table writes wrapped in `transaction.atomic()`.
38. Async side effects via Celery — never synchronous in request path when >300ms.

## 9. API contracts

39. Every endpoint documented in `20-contracts/api-contracts.md`.
40. Money fields: integer cents, suffix `_cents`.
41. IDs: UUIDv4 in public API.
42. Dates: ISO-8601 UTC with `Z`.
43. Breaking API change: new URL version + parallel period + ADR.

## 10. State

44. Entity states defined in `20-contracts/state-map.md`. Single source of truth.
45. `BUSINESS_STATES.md` is deprecated. Do not reference.
46. Invalid transitions return 409 Conflict.

## 11. Testing

47. Coverage thresholds enforced (see `40-quality/testing.md`).
48. Flaky test = bug. No permanent `@skip`.
49. Tests co-located with source.

## 12. Security

50. Every PR touching auth / permissions / uploads reviewed by security team.
51. Never log or transmit secrets / PII in plaintext (see `40-quality/security.md`).

## Amendment

Changes to this document require ADR. Open PR, link ADR, two approvals from code owners.

## Enforcement

- ESLint / ruff / mypy / pytest pre-commit hook.
- CI gates per `40-quality/ci-cd.md`.
- Contract drift detector between backend and frontend.
- Link-checker on docs/.
