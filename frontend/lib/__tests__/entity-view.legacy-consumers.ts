/**
 * Files that still consume the legacy presentation system (`createEntityFields`, `toColumns()`,
 * `AutoEntityCard`, `DataTable`, `DataTableView`), measured 2026-10-18 (Phase 7 replan,
 * docs/50-audit/Tablascards/07-migration-matrix.md §6, rule M8).
 *
 * Ratchet: entries are only removed — that removal IS the migration. When this list is empty
 * the legacy system is deleted (§6.9).
 */
export const LEGACY_CONSUMERS: readonly string[] = [
    "features/finance/bank-reconciliation/components/ReconciliationPanel.tsx",
    "features/finance/bank-reconciliation/components/StatementImportModal.tsx",
    "features/finance/components/MappingConfigDrawer.tsx",
    "features/notes/components/steps/NoteStep_LineItems.tsx",
    "features/pos/components/DraftCartsClientView.tsx",
    "features/profile/components/ProfileView.tsx",
]
