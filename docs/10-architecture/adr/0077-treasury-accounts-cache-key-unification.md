---
id: 0077
title: Unify treasury-account data surface and single cache-key namespace
status: Accepted
date: 2026-10-09
author: frontend-team
approved: 2026-10-09
---

# 0077 — Unify treasury-account data surface and single cache-key namespace

**Related:** `docs/50-audit/design-system-ui-audit.md` (§5 cache-key collision, T9), ADR-0020, `docs/20-contracts/hook-contracts.md` (patrón de queryKey factories e invalidación cross-feature)

---

## Context

Three overlapping treasury-account data surfaces exist with **three different cache-key namespaces** — and a fourth was discovered during execution. The audit tracked this as "useTreasuryAccounts x3" with a cache-key collision; the evidence below was re-verified on 2026-10-09 against the current tree.

| Surface | Location | Cache key (`all`) | Consumers (active) |
|---|---|---|---|
| `useTreasuryAccounts(options)` — context/terminal/payment-method selector, reads `/treasury/pos-terminals/{id}/available_accounts/` | `frontend/hooks/useTreasuryAccounts.ts` (root, shared) | `['treasury_accounts']` (snake) | `features/purchasing/components/PurchaseCheckoutWizard.tsx`, `components/selectors/TreasuryAccountSelector.tsx` |
| `useTreasuryAccounts({ filters })` — CRUD + list for treasury screens, reads `treasuryApi.getAccounts(filters)` | `frontend/features/treasury/hooks/useTreasuryAccounts.ts` | `['treasury-accounts']` (kebab) via `TREASURY_ACCOUNTS_KEYS` | ~9 (treasury screens, loans, `settings` re-exports, `BankCreationWizard`, `TransferDrawer`) |
| `POS_KEYS.treasuryAccounts` (`['treasuryAccounts']`, camel) re-exported as `TREASURY_ACCOUNTS_KEYS` | `frontend/features/pos/hooks/queryKeys.ts` | `['treasuryAccounts']` (camel) | **0 — dead**, only declared |
| `TREASURY_ACCOUNTS_QUERY_KEY = ["treasuryAccounts"]` — settings-owned snapshot list (reads `settingsApi.getTreasuryAccounts`, `staleTime` 10 min) | `frontend/features/settings/hooks/useTreasuryAccounts.ts` | `["treasuryAccounts"]` (camel, **double-quoted**) | `settings/components/partners/MassPaymentWizard.tsx`, `settings/components/partners/EquityMovementModals.tsx` |

> The 4th surface eluded the original audit because its key uses **double quotes** (`["treasuryAccounts"]`); a single-quote grep for `'treasuryAccounts'` misses it. Verify with both quote styles. It is **not dead**: `MassPaymentWizard` and `EquityMovementModals` cache accounts for 10 min under a namespace that no mutation invalidates (mutation invalidations target `['treasury-accounts', …]`), so partner screens can serve stale account lists long after an account edit.

Why this is a defect, not just debt:

- **Cache miss on invalidation.** `useTreasuryAccounts` (treasury feature) invalidates `TREASURY_ACCOUNTS_KEYS.lists()/details()` → `['treasury-accounts', …]`. The two root-hook consumers read `['treasury_accounts', …]`. After a create/update/delete in any treasury screen, the POS-checkout account selector and `TreasuryAccountSelector` keep serving **stale accounts** until `staleTime` (60s) or a refetch. Same tension in reverse.
- **Two names bound to two different cache namespaces.** A developer fixing an invalidation on one side "misses" the other because both modules export the symbol `TREASURY_ACCOUNTS_KEYS`. Collision is silent at compile time (different modules) and detectable only by runtime staleness.
- **Return shapes differ** (POS selector returns `TreasuryAccount[]` with `allows_*` booleans; CRUD hook returns a full `UseTreasuryAccountsReturn`), so a single consumer cannot swap one for the other without a migration.

The dead `POS_KEYS.treasuryAccounts` must not be "revived" as the canonical key: it exists inside a feature's POS query-keys file and naming a treasury domain there inverts ownership.

## Decision

1. **One namespace wins: `['treasury-accounts']`** (kebab, matching the treasury domain file `features/treasury/hooks/queryKeys.ts`). All invalidation flows already use the treasury feature as the authoritative owner of account mutations.
2. **Migrate the root hook** `frontend/hooks/useTreasuryAccounts.ts` to consume `TREASURY_ACCOUNTS_KEYS` from `@/features/treasury` instead of its local `TREASURY_ACCOUNT_KEYS` (`['treasury_accounts']`), deleting the local constant. Its list query becomes `[...TREASURY_ACCOUNTS_KEYS.lists(), options]`. Consumers are unaffected (same props/return).
3. **Delete the dead POS keyset** `POS_KEYS.treasuryAccounts` (and any `export { … }` shim) from `features/pos/hooks/queryKeys.ts`; do not re-export `TREASURY_ACCOUNTS_KEYS` from POS.
4. **Keep two hooks** — they expose genuinely different contracts (POS terminal-scoped selector vs CRUD + realtime invalidation). Merging their return surfaces is out of scope; this ADR unifies the **data identity** (cache key) that makes their invalidation behavior coherent, not their APIs.
5. **Contract, not comments:** add a note to `docs/20-contracts/hook-contracts.md` (the canonical cache-key/invalidation contract — `docs/20-contracts/cache-invalidation.md` no existe) documenting that the treasury-accounts entity has exactly one namespace (`['treasury-accounts']`) and that any future account-reader must key off it (alongside the existing `DOMAIN_KEYS.list(filters)` rule).
6. **Migrate the settings hook (surface #4) to the same namespace:** `features/settings/hooks/useTreasuryAccounts.ts` drops `TREASURY_ACCOUNTS_QUERY_KEY = ["treasuryAccounts"]` and reads `TREASURY_ACCOUNTS_KEYS.all` from `@/features/treasury` (keeping `settingsApi.getTreasuryAccounts` as its queryFn and its own `staleTime`). The `TREASURY_ACCOUNTS_QUERY_KEY` re-exports in `features/settings/hooks/index.ts` and `features/settings/index.ts` are removed (no external consumers import the key symbol itself; `MassPaymentWizard`/`EquityMovementModals` consume only the hook). This closes the last namespace so partner screens are invalidated on account mutation.

## Consequences

### Positivas
- A mutation in any treasury screen invalidates the POS-checkout and selector caches (fixes latency staleness at `PurchaseCheckoutWizard` and `TreasuryAccountSelector`).
- Removes the two-signal collision (`treasury_accounts` vs `treasury-accounts`) that makes invalidation bugs invisible to `tsc`.
- Deletes a dead keyset; `features/pos/hooks/queryKeys.ts` stops owning a treasury namespace.

### Negativas
- After deploy, the first root-hook read under the new key is a cache miss (single cold fetch per terminal/context) — negligible.
- Any consumer relying on `TREASURY_ACCOUNT_KEYS` (old snake symbol) must re-point; only the root hook + its 2 consumers exist, all migrated in the same change.
- Security/realtime: `useRealtime` (`markLocalMutation`) already guards optimistic updates on the feature hook; the root hook does not subscribe to realtime, so its staleness is bounded by `staleTime`/refetch regardless — the fix targets the *invalidation-on-mutation* path.

### Archivos modificados
- `frontend/hooks/useTreasuryAccounts.ts` — **aplicado**: drop local keys, import feature keys; list query = `[...TREASURY_ACCOUNTS_KEYS.lists(), options]`. `tsc` exit 0; consumidores sin cambios.
- `frontend/features/pos/hooks/queryKeys.ts` — **aplicado**: bloque `treasuryAccounts` eliminado (0 refs fuera del bloque verificado).
- `frontend/features/settings/hooks/useTreasuryAccounts.ts` — **aplicado**: `TREASURY_ACCOUNTS_QUERY_KEY` eliminado; usa `TREASURY_ACCOUNTS_KEYS.all`; mantiene `settingsApi.getTreasuryAccounts`/`staleTime` 10min.
- `frontend/features/settings/hooks/index.ts` + `frontend/features/settings/index.ts` — **aplicado**: re-exports del key eliminados (0 consumidores del símbolo).
- `docs/20-contracts/hook-contracts.md` — **aplicado**: nota de namespace canónico (sección "Single cache-key namespace (ADR-0077)").
- `docs/50-audit/design-system-ui-audit.md` — §5 row done + T9 ADR ref.

> Verificado 2026-10-09 tras aplicar: `grep` de `'treasuryAccounts'`, `"treasuryAccounts"` y `treasury_accounts]` → **cero resultados** en cache keys; el único namespace es `['treasury-accounts']` vía `TREASURY_ACCOUNTS_KEYS`. `tsc --noEmit` exit 0.

## Alternatives considered

- **Canonicalize `['treasury_accounts']` instead**: rejected — snake key is owned by a *root* hook file, not a feature; the domain owner (treasury) defines its keys. Kebab matches every other treasury entity (`terminals`, `terminal-batches`, `movements`, `payment-references`).
- **Revive `['treasuryAccounts']` from POS as canonical**: rejected — it is dead and inverts ownership (a feature's POS file owning a treasury namespace). Deleting it removes the 3-way ambiguity entirely.
- **Merge into one hook**: rejected now — the return contracts differ (selector vs CRUD); forcing one would churn ~11 call sites for no caching benefit. Recorded as a possible follow-up ADR.
- **Single source-of-truth keyset in a neutral `lib/` file**: possible follow-up; the treasury feature file already is the de-facto home, so this ADR keeps the smallest diff.

## References

- Evidence: `frontend/hooks/useTreasuryAccounts.ts:27-30`, `frontend/features/treasury/hooks/queryKeys.ts:37-41`, `frontend/features/pos/hooks/queryKeys.ts` (`POS_KEYS.treasuryAccounts`, 0 usos verificado 2026-10-09), `frontend/features/settings/hooks/useTreasuryAccounts.ts:7` (superficie #4, doble-quote), consumidores listados arriba.
- Migración **completa aplicada** (working tree, sin commitear aún).
- `docs/50-audit/design-system-ui-audit.md` §5, §7 (fila cache-key), T9
- `docs/20-contracts/hook-contracts.md` (queryKey factories + invalidación cross-feature)
- ADR-0020 (modal-on-list edit UX — POS checkout context)