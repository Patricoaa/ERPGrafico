/**
 * Files that still consume the legacy presentation system (`createEntityFields`, `toColumns()`,
 * `AutoEntityCard`, `DataTable`, `DataTableView`), measured 2026-10-18 (Phase 7 replan,
 * docs/50-audit/Tablascards/07-migration-matrix.md §6, rule M8).
 *
 * Ratchet: entries are only removed — that removal IS the migration. When this list is empty
 * the legacy system is deleted (§6.9).
 */
export const LEGACY_CONSUMERS: readonly string[] = [
    "components/selectors/AccountSelector.tsx",
    "features/finance/bank-reconciliation/components/ReconciliationPanel.tsx",
    "features/finance/bank-reconciliation/components/StatementImportModal.tsx",
    "features/finance/components/MappingConfigDrawer.tsx",
    "features/inventory/components/InventoryCountDetailDrawer.tsx",
    "features/notes/components/steps/NoteStep_LineItems.tsx",
    "features/pos/components/DraftCartsClientView.tsx",
    "features/production/components/steps/MaterialAssignmentStep.tsx",
    "features/production/components/steps/RectificationStep.tsx",
    "features/profile/components/ProfileView.tsx",
    "features/sales/components/checkout/Step2_ManufacturingDetails.tsx",
    "features/settings/components/HRSettingsView.tsx",
    "features/settings/components/InitialCapitalModal.tsx",
    "features/settings/components/partners/AddPartnerModal.tsx",
]
