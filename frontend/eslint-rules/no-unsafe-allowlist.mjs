/**
 * Shared no-unsafe-* allowlist (ratchet P1.6).
 *
 * Source of truth for the `@typescript-eslint/no-unsafe-*` migration:
 * - eslint.config.mjs keeps these rules at `error` globally and applies a
 *   `warn` override to exactly the files listed here.
 * - The guard test (lib/__tests__/no-unsafe.contract.test.ts) enforces that no
 *   file outside this list carries a `no-unsafe-*` warning and that counts
 *   never grow past the baseline.
 *
 * Migrating a file = fixing its warnings AND removing its entry here AND from
 * the guard test baseline in the same change.
 */

/**
 * Baseline captured 2026-10-09 from a full eslint run across ALL five
 * no-unsafe-* rules (assignment, call, function, member-access, return):
 * file -> total no-unsafe-* messages.
 */
/** @type {Record<string, number>} */
export const NO_UNSAFE_BASELINE = {
    "app/(dashboard)/production/orders/WorkOrdersPageClient.tsx": 3,
    "app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx": 9,
    "components/layout/QuickActionsMenu.tsx": 8,
    "components/layout/UserActions.tsx": 11,
    "components/shared/AutoEntityCard.tsx": 1,
    "components/shared/DataTableToolbar.tsx": 1,
    "components/shared/StatusBadge.tsx": 1,
    "components/shared/UniversalSearch.tsx": 1,
    "features/billing/api/billingApi.ts": 1,
    "features/contacts/api/partnersApi.ts": 21,
    "features/contacts/hooks/useProfitDistribution.ts": 3,
    "features/credits/api/creditsApi.ts": 10,
    "features/finance/bank-reconciliation/components/ReconciliationPanel.tsx": 2,
    "features/finance/components/BudgetVarianceView.tsx": 1,
    "features/hr/api/hrApi.ts": 24,
    "features/inventory/api/inventoryApi.ts": 10,
    "features/inventory/hooks/useStockMoves.ts": 1,
    "features/notifications/hooks/useNotifications.ts": 3,
    "features/orders/api/ordersApi.ts": 26,
    "features/orders/components/ActionCategory.tsx": 1,
    "features/orders/components/GlobalHubPanel.tsx": 7,
    "features/orders/components/NoteLogisticsModal.tsx": 7,
    "features/orders/components/OrderActionPanel.tsx": 22,
    "features/orders/components/OrderHubPanel.tsx": 23,
    "features/orders/hooks/useCancelOrderFlow.tsx": 11,
    "features/orders/hooks/useNoteLogisticsData.ts": 2,
    "features/orders/hooks/useOrderDetail.ts": 2,
    "features/orders/hooks/useSaleOrderSearch.ts": 1,
    "features/pos/api/posApi.ts": 26,
    "features/pos/components/POSClientView.tsx": 1,
    "features/pos/components/SessionCloseModal.tsx": 1,
    "features/pos/components/SessionControl.tsx": 5,
    "features/pos/components/SessionOpenModal.tsx": 2,
    "features/pos/contexts/POSProvider.tsx": 3,
    "features/pos/hooks/useCart.ts": 1,
    "features/pos/hooks/useDraftSync.ts": 5,
    "features/pos/hooks/useDrafts.ts": 1,
    "features/pos/hooks/usePOSSessions.ts": 1,
    "features/pos/hooks/useProducts.ts": 2,
    "features/pos/utils/bom-resolver.ts": 5,
    "features/production/api/productionApi.ts": 32,
    "features/production/components/BOMClientView.tsx": 1,
    "features/production/components/BOMDrawer.tsx": 1,
    "features/production/components/WorkOrderWizard.tsx": 1,
    "features/production/components/__tests__/WorkOrderWizard.test.tsx": 2,
    "features/production/components/forms/WorkOrderBasicStep/index.tsx": 1,
    "features/production/components/steps/ManufacturingConfigStep.tsx": 1,
    "features/production/hooks/useBOMs.ts": 2,
    "features/production/hooks/useProductionQueries.ts": 2,
    "features/production/hooks/useSaleOrderManufacturableLines.ts": 2,
    "features/production/hooks/useWorkOrderComments.ts": 1,
    "features/production/hooks/useWorkOrderListActions.ts": 3,
    "features/production/hooks/useWorkOrderMutations.ts": 8,
    "features/production/hooks/useWorkOrderSearch.ts": 2,
    "features/production/hooks/useWorkOrders.ts": 1,
    "features/purchasing/api/purchasingApi.ts": 7,
    "features/sales/api/salesApi.ts": 4,
    "features/sales/components/DeliveryDrawer.tsx": 4,
    "features/sales/components/checkout/SalesCheckoutWizardView.tsx": 11,
    "features/sales/hooks/useDeliveryData.ts": 5,
    "features/sales/hooks/useSaleOrderComments.ts": 1,
    "features/settings/api/settingsApi.ts": 6,
    "features/settings/components/ProfitDistributionDrawer.tsx": 22,
    "features/settings/components/partners/CreateDistributionFlow.tsx": 1,
    "features/tax/api/taxApi.ts": 10,
    "features/tax/components/AccountingPeriodDrawer.tsx": 8,
    "features/tax/components/DeclarationWizard.tsx": 16,
    "features/tax/components/F29DeclarationDrawer.tsx": 7,
    "features/tax/hooks/useTaxQueries.ts": 4,
    "features/treasury/api/treasuryApi.ts": 20,
    "features/treasury/components/CashMovementDrawer.tsx": 26,
    "features/treasury/components/PaymentDrawer.tsx": 38,
    "features/treasury/components/TerminalBatchDrawer.tsx": 20,
    "features/treasury/hooks/usePayment.ts": 1,
    "features/treasury/hooks/useTerminalBatch.ts": 1,
    "features/treasury/hooks/useTreasuryMovement.ts": 1,
    "features/users/api/usersApi.ts": 8,
    "features/users/components/GroupDrawer.tsx": 1,
    "features/users/components/UserDrawer.tsx": 6,
    "features/users/hooks/useGroupSearch.ts": 2,
    "features/users/hooks/useUserSearch.ts": 1,
    "features/workflow/api/workflowApi.ts": 17,
    "features/workflow/components/NotificationBell.tsx": 4,
    "hooks/useAllowedPaymentMethods.ts": 3,
    "hooks/useInitializeDrawerForm.ts": 6,
    "hooks/useOrderHubData.ts": 41,
    "hooks/useSelectedEntity.test.tsx": 2,
    "hooks/useStockValidation.ts": 1,
    "hooks/useTreasuryAccounts.ts": 6,
    "lib/api.ts": 13,
    "lib/server-fetch.ts": 2,
    "scripts/clean_detail_clients.ts": 19,
}

export const NO_UNSAFE_ALLOWLIST_FILES = Object.keys(NO_UNSAFE_BASELINE)
