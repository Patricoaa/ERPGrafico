# Fix DataCell actions: Arrow vs Kebab auto-detection

## Problem

Contract (`docs/20-contracts/component-row-actions.md §4`):
- 1 visible action → `DataCell.ActionSingle` (ArrowRight, hover-reveal)
- 2+ visible actions → `DataCell.ActionMenu` (kebab)

This only works when action files return `StructuredAction[]` AND consumers call `.auto()`. Currently:
- **0/48** action files return structured data (all return JSX)
- **42/49** consumers call `.column()` (no auto-detection)
- **7/49** call `.auto()` but fall back to `.column()` because JSX is returned

## Plan

### Phase 0: Extend types (`entity-actions.tsx` + `DataTableCells.tsx`)

Extend `StructuredAction` to support module-specific icon/color/label overrides:

```ts
export type StructuredAction =
  | {
      action: RowActionKey
      onClick: (e: React.MouseEvent) => void
      visible?: boolean
      disabled?: boolean
      label?: string
      icon?: LucideIcon        // NEW: override registry icon
      iconColor?: string       // NEW: semantic color token (e.g. "text-destructive")
      className?: string       // NEW: extra CSS (e.g. "text-success")
    }
  | { separator: true }
```

Update `renderActions()` (cards) and `toMenuItems()` (kebab) to pass `icon`/`iconColor`/`className` through.

Update `DataCell.Action` to accept the same overrides so cards render them too.

### Phase 1: Add common keys to ROW_ACTIONS (`lib/row-actions.ts`)

Add frequently-used module-specific actions that have clear cross-module semantics:

| Key | Icon | Label | Intent |
|-----|------|-------|--------|
| `post` | `CheckCircle` | "Confirmar" | write |
| `reopen` | `LockOpen` | "Reabrir" | write |
| `disburse` | `Send` | "Desembolsar" | write |
| `split` | `SplitSquareHorizontal` | "Distribuir" | write |

**NOT added** (too module-specific, use icon overrides instead): Wallet, Coins, CreditCard, ClipboardList, Book, ShieldAlert, Undo2, FileDown, Pause, Play, Settings, ArrowRight, DollarSign.

### Phase 2: Migrate action files to structured data (48 files)

Convert each `createEntityActions` callback from JSX → `StructuredAction[]`.

**Migration pattern:**

```ts
// BEFORE (JSX)
(item, ctx) => (
  <>
    <DataCell.Action action="edit" onClick={() => ctx.onEdit(item.id)} />
    {!item.is_default && (
      <DataCell.Action action="delete" onClick={() => ctx.onDelete(item)} />
    )}
  </>
)

// AFTER (structured)
(item, ctx) => [
  { action: "edit", onClick: () => ctx.onEdit(item.id) },
  { action: "delete", onClick: () => ctx.onDelete(item), visible: !item.is_default },
]
```

**For custom icons** (not in ROW_ACTIONS):

```ts
// BEFORE
<DataCell.Action icon={Wallet} title="Pagar" onClick={...} className="text-success" />

// AFTER
{ action: "pay", onClick: ..., icon: Wallet, label: "Pagar", iconColor: "text-success" }
```

**For truly custom actions** (new ROW_ACTION_KEY added in Phase 1):

```ts
// BEFORE
<DataCell.Action icon={CheckCircle} title="Confirmar" onClick={...} />

// AFTER
{ action: "post", onClick: ... }
```

**Special cases:**
- `partnerTransactionActions`: returns `<span>` when no doc → use `{ action: "detail", onClick: ..., visible: !!doc }`
- `workOrderActions`: mixes `DataCell.Action` + `DataCell.ActionMenu` → flatten all into structured array
- `posSessionActions`: block body with if/else → early return with visible flags
- `treasuryAccountActions`: block body with if/else → early return with visible flags
- `paymentMethodActions`: block body with early return → early return with visible flags
- `fiscalYearActions`: ternary returning different icons → use icon override
- `statementLineActions`: ternary returning different icons → use icon override
- `checkActions`: 6 conditional actions with complex logic → visible flags
- `journalEntryActions`: edit when DRAFT else detail → dynamic action key

**Files by complexity tier:**

**Tier 1 — Simple (no conditionals, 1-2 actions, 16 files):**
userActions, groupActions, absenceActions, employeeActions, budgetActions, statementActions (bank-reconciliation), systemItemActions, stockMoveActions, ledgerMovementActions, deviceActions, providerActions, treasuryMovementActions, contactDocumentActions, stockReportActions, bomActions, bomManagerActions

**Tier 2 — Moderate (1-3 conditionals, 16 files):**
payrollConceptActions, productActions, categoryActions, warehouseActions, uomActions, uomCategoryActions, pricingRuleActions, attributeActions, accountActions, taxDeclarationActions, posTerminalActions, loanActions, statementActions (card-statements), profilePayrollActions, partnerTransactionActions, posSessionActions

**Tier 3 — Complex (4+ conditionals or early returns, 16 files):**
partnerActions, profitDistributionActions, payrollActions, salaryAdvanceActions, documentActions, subscriptionActions, bankActions, treasuryAccountActions, paymentMethodActions, checkActions, statementLineUnmatchActions, fiscalYearActions, workOrderActions, journalEntryActions, statementLineActions, contactActions

### Phase 3: Switch consumers `.column()` → `.auto()` (42 files)

Mechanical change in each consumer:

```ts
// BEFORE
productActions.column(actionsCtx)

// AFTER
productActions.auto(actionsCtx)
```

Remove `as ColumnDef<...>` casts where no longer needed (`.auto()` returns `ColumnDef<T>` correctly when T is properly typed).

Keep `.column()` only for legacy JSX patterns (none expected after Phase 2).

### Phase 4: Update docs and verify

- Update `component-row-actions.md` to reflect that all modules now use structured data
- Run `npm run type-check` — must pass
- Run `npm run lint` — must pass
- Visual check: single-action rows show ArrowRight on hover; multi-action rows show kebab

## Execution order

1. Phase 0 first (types) — everything else depends on it
2. Phase 1 (ROW_ACTIONS keys) — independent, can be done in parallel with Phase 0
3. Phase 2 + Phase 3 together per-file — convert action file, then immediately switch its consumer
4. Phase 4 last (verification)

## Risk

- **Async onClick**: `profilePayrollActions` has an async onClick (`await ctx.onDownloadPdf`). `StructuredAction` already supports this since `onClick` is typed as `(e: React.MouseEvent) => void` but the actual handler is async — this works because the return type is ignored.
- **`defaultAction()`**: Only returns onClick when exactly 1 visible action. With structured data, this now works correctly for all modules (previously returned `null` for JSX).
- **Card surfaces** (`.render()`): The `renderActions()` utility already handles structured data → JSX for cards. No changes needed to card consumers.
