/**
 * Files that still consume the legacy presentation system (`createEntityFields`, `toColumns()`,
 * `AutoEntityCard`, `DataTable`, `DataTableView`), measured 2026-10-18 (Phase 7 replan,
 * docs/50-audit/Tablascards/07-migration-matrix.md §6, rule M8).
 *
 * Ratchet: entries are only removed — that removal IS the migration. When this list is empty
 * the legacy system is deleted (§6.9).
 */
export const LEGACY_CONSUMERS: readonly string[] = []

/**
 * Files permanently exempt from entity-view migration: they use `<DataTable>` directly
 * (no `createEntityFields` / `toColumns()` / legacy data layer) but are architecturally
 * incompatible with entity-view — DnD, per-cell form controls, WebSocket locks, or
 * sub-component row expansion that entity-view has no API for.
 *
 * Entries are removed only when the architectural blocker is lifted and the file migrates.
 */
export const EXEMPT_CONSUMERS: readonly string[] = [
    "features/finance/bank-reconciliation/components/ReconciliationPanel.tsx",
    "features/finance/bank-reconciliation/components/StatementImportModal.tsx",
    "features/finance/components/MappingConfigDrawer.tsx",
    "features/pos/components/DraftCartsClientView.tsx",
]
