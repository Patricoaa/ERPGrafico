# 00 · Anexo: inventario de consumidores (Fase 0)

> Fecha: 2026-10-16. Barrido de un subagente `Explore` con comprobaciones puntuales (ver `00-system-map.md` §3).
> Rutas relativas a `frontend/`. **inline cols** es heurístico (`accessorKey:'…'` o `id:'…'`); * = inflado por `id:` fuera de columnas. `computed` y `renderCard` son exactos. En la columna computed, para los consumidores de `toColumns` se cuenta el `*Fields` asociado.

Comandos:
```bash
EX="--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=__tests__ --exclude=*.test.tsx --exclude=*.stories.tsx"
P='<DataTable\b|DataTableView|toColumns\(|AutoEntityCard|renderCard|type: .computed.|createEntityFields|<Table\b|<table\b'
grep -rlE $EX "$P" app features components | grep -vE '^components/(shared|ui)/'
# por archivo: grep -c 'toColumns(' · grep -c '<AutoEntityCard' · grep -nE 'renderCard[=:]' · grep -cE "type: .computed." · grep -cE "(accessorKey|id): ['\"]" · grep -nE '<Table\b|<table\b'
```

| archivo | entidad | superficies | toColumns | AEC | renderCard | computed | inline | tabla paralela |
|---|---|---|---|---|---|---|---|---|
| app/(dashboard)/accounting/accounts/[id]/ledger/page.tsx | ledger | table | N | N | – | 0 | 7 | – |
| app/(dashboard)/accounting/entries/EntriesClientView.tsx | journalentry | table/card | Y | Y | :149 | 0 | 0 | – |
| app/(dashboard)/production/orders/WorkOrdersPageClient.tsx | workorder | table | column() | N | – | 0 | 3 | – |
| app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx | purchaseorder/invoice | table/card | Y | Y | :881 | 2 | 66* | – |
| app/(dashboard)/settings/audit/AuditPageClient.tsx | audit log | table | N | N | – | 0 | 7 | – |
| app/(dashboard)/settings/jobs/JobsView.tsx | job | table/card | N | N | :189 (manual) | 0 | 6 | – |
| app/(dashboard)/treasury/reconciliation/[id]/page.tsx | reconciliation | table | N | N | – | 0 | 8 | – |
| components/selectors/AccountSelector.tsx | account | embedded | N | N | – | 0 | 3 | – |
| components/selectors/ProductSelector.tsx | product | embedded | N | N | – | 0 | 0 | raw :373 |
| features/accounting/components/AccountsClientView.tsx | account | table | Y | N | – | 0 | 1 | – |
| features/accounting/components/closures/AccountingClosuresClientView.tsx | fiscalyear | table | Y | N | – | 0 | 0 | – |
| features/accounting/components/LedgerDrawer.tsx | ledger movement | embedded | Y | N | – | 2 | 0 | – |
| features/billing/components/checkout/Step1_Items.tsx | invoice lines | embedded | N | N | – | 0 | 0 | raw :87 |
| features/billing/components/checkout/Step2_Logistics.tsx | logistics lines | embedded | N | N | – | 0 | 1 | raw :228 |
| features/billing/components/PurchaseInvoicesClientView.tsx | invoice (compra) | table/card | Y | Y | :168 | 1 | 0 | – |
| features/billing/components/SalesInvoicesClientView.tsx | invoice (venta) | table/card | Y | Y | :107 | 1 | 0 | – |
| features/contacts/components/ContactDrawer.tsx | sublistas de contacto | embedded | Y(4) | N | – | 0 | 4 | – |
| features/contacts/components/ContactsClientView.tsx | contact | table/card | Y | Y | :123 | 1 | 0 | – |
| features/credits/components/BlacklistClientView.tsx | blacklist | table | N | N | – | 0 | 1 | raw :125 |
| features/credits/components/CreditPortfolioClientView.tsx | credit contact | table | Y(2) | N | – | 1 | 0 | – |
| features/credits/components/PortfolioTable.tsx | credit ledger | table | Y | N | – | 2 | 1 | – |
| features/finance/bank-reconciliation/components/ImportPreviewStep.tsx | statement line | embedded | N | N | – | 0 | 0 | – |
| features/finance/bank-reconciliation/components/ReconciliationPanel.tsx | statement line/movement | embedded | N | N | – | 0 | 10 | – |
| features/finance/bank-reconciliation/components/SimulationResults.tsx | match result | embedded | N | N | – | 0 | 0 | – |
| features/finance/bank-reconciliation/components/SplitAllocationDialog.tsx | allocation | embedded | N | N | – | 0 | 0 | raw :151 |
| features/finance/bank-reconciliation/components/StatementDetailPanel.tsx | statement line | embedded | N | N | – | 0 | 8 | – |
| features/finance/bank-reconciliation/components/StatementImportModal.tsx | import preview | embedded | N | N | – | 0 | 4 | – |
| features/finance/bank-reconciliation/components/StatementsClientView.tsx | bank statement | table/card | Y | Y | – | 2 | 0 | – |
| features/finance/components/BudgetDetailView.tsx | budget item | embedded | N | N | – | 0 | 4 | – |
| features/finance/components/BudgetsClientView.tsx | budget | table/card | Y | Y | :129 | 1 | 0 | – |
| features/finance/components/BudgetVarianceTable.tsx | budget variance | report | N | N | – | 0 | 0 | raw :167 |
| features/finance/components/CashFlowTable.tsx | cash flow | report | N | N | – | 0 | 6 | ReportTable + raw :151,:251 |
| features/finance/components/MappingConfigDrawer.tsx | mapping | embedded | N | N | – | 0 | 5 | – |
| features/hr/components/AbsenceClientView.tsx | absence | table/card | Y | Y | :109 | 0 | 0 | – |
| features/hr/components/EmployeeClientView.tsx | employee | table/card | Y | Y | :101 | 0 | 0 | – |
| features/hr/components/PayrollCard.tsx | payroll | card | N | N | – | 0 | 0 | raw :234 |
| features/hr/components/PayrollClientView.tsx | payroll | table/card | Y | Y | :560 | 0 | 39* | – |
| features/hr/components/SalaryAdvanceClientView.tsx | salaryadvance | table/card | Y | Y | :108 | 1 | 0 | – |
| features/inventory/components/AttributesClientView.tsx | attribute | table/card | Y | Y | :188 | 1 | 1 | – |
| features/inventory/components/CategoryClientView.tsx | category | table/card | Y | Y | :124 | 1 | 0 | – |
| features/inventory/components/DocumentsClientView.tsx | inventorydocument | table/card | Y | Y | :113 | 1 | 0 | – |
| features/inventory/components/InventoryCountClientView.tsx | inventorycount | table/card | Y | Y | :416 | 0 | 9 | – |
| features/inventory/components/InventoryDocumentDrawer.tsx | doc detail | embedded | Y | N | – | 1 | 2 | – |
| features/inventory/components/MovementClientView.tsx | stockmove | table/card | Y | Y | :342 | 0 | 9 | – |
| features/inventory/components/PricingRuleClientView.tsx | pricingrule | table/card | Y | Y | :238 | 0 | 6 | – |
| features/inventory/components/ProductClientView.tsx | product | table/card | Y | Y | :609 | 2 | 22 | – |
| features/inventory/components/ProductInsightsModal.tsx | product insights | embedded | N | N | – | 0 | 2 | – |
| features/inventory/components/ProductInsightsPanel.tsx | stockmove | embedded/card | Y | Y | :234 | 0 | 0 | – |
| features/inventory/components/product/ProductVariantsTab.tsx | variants | embedded | N | N | – | 0 | 0 | raw :285 |
| features/inventory/components/StockReport.tsx | stockreport | table/card/embedded | Y | Y | :205 | 0 | 0 | – |
| features/inventory/components/SubscriptionHistoryModal.tsx | subscription hist | embedded | N | N | – | 0 | 0 | – |
| features/inventory/components/SubscriptionsClientView.tsx | subscription | table/card | Y | Y | :359 | 0 | 1 | – |
| features/inventory/components/UoMCategoryClientView.tsx | uomcategory | table/card | Y | Y | :174 | 0 | 1 | – |
| features/inventory/components/UoMClientView.tsx | uom | table/card | N | Y | :173 | 0 | 2 | – |
| features/inventory/components/WarehouseClientView.tsx | warehouse | table/card | N | Y | :180 | 0 | 1 | – |
| features/notes/components/steps/NoteStep_LineItems.tsx | note lines | embedded | N | N | – | 0 | 1 | ui/table :64 |
| features/orders/components/NoteLogisticsModal.tsx | logistics | embedded | N | N | – | 0 | 0 | raw :174 |
| features/orders/components/PaymentHistoryModal.tsx | payment | embedded | N | N | – | 0 | 0 | – |
| features/orders/components/sheet/InvoiceSummaryTab.tsx | invoice line | embedded | Y | N | – | 1 | 0 | – |
| features/orders/components/sheet/OrderSummaryTab.tsx | order line | embedded | Y | N | – | 2 | 0 | – |
| features/pos/components/DraftCartsClientView.tsx | draft cart | table | Y | N | – | 0 | 4 | – |
| features/production/components/BOMClientView.tsx | bom | table/card | Y | Y | :117 | 1 | 0 | – |
| features/production/components/BOMManager.tsx | bom lines | embedded | N | N | – | 0 | 6 | – |
| features/production/components/steps/MaterialAssignmentStep.tsx | materials | embedded | N | N | – | 0 | 6 | – |
| features/production/components/steps/RectificationStep.tsx | materials | embedded | N | N | – | 0 | 7 | – |
| features/production/components/WorkOrderWizard.tsx | wo materials | embedded | N | N | – | 0 | 8 | raw :859 |
| features/profile/components/PartnerProfileTab.tsx | partner txns | embedded | N | N | – | 0 | 4 | – |
| features/profile/components/ProfileView.tsx | payroll/payments | embedded | N | N | – | 0 | 11 | – |
| features/purchasing/components/checkout/Step4_Receipt.tsx | receipt lines | embedded | N | N | – | 0 | 3 | raw :231,:284 |
| features/purchasing/components/PurchaseOrderModal.tsx | PO lines | embedded | N | N | – | 0 | 0 | raw :256,:413 |
| features/purchasing/components/PurchaseReceiptDrawer.tsx | receipt line | embedded | Y | N | – | 2 | 0 | – |
| features/purchasing/components/PurchaseReturnDrawer.tsx | return line | embedded | Y | N | – | 2 | 0 | – |
| features/purchasing/components/ReceiptModal.tsx | receipt lines | embedded | N | N | – | 0 | 0 | raw :286 |
| features/sales/components/checkout/Step2_ManufacturingDetails.tsx | mfg lines | embedded | N | N | – | 0 | 5 | – |
| features/sales/components/checkout/Step3_Delivery.tsx | delivery lines | embedded | N | N | – | 0 | 0 | raw :173 |
| features/sales/components/DeliveryDrawer.tsx | delivery lines | embedded | N | N | – | 0 | 0 | raw :427 |
| features/sales/components/POSSessionsClientView.tsx | pos.session | table/card | Y | Y | :132 | 0 | 0 | – |
| features/sales/components/PosTerminalClientView.tsx | posterminal | table/card | Y | Y | :123 | 0 | 0 | – |
| features/sales/components/SaleDeliveryDrawer.tsx | delivery line | embedded | Y | N | – | 2 | 0 | – |
| features/sales/components/SaleReturnDrawer.tsx | return line | embedded | Y | N | – | 1 | 0 | – |
| features/sales/components/SalesOrdersView.tsx | saleorder/note | table/card | Y | Y | :371 | 3 | 45* | – |
| features/settings/components/GroupsClientView.tsx | group | table/card | Y | Y | :81 | 0 | 0 | – |
| features/settings/components/HRSettingsView.tsx | hr concepts | embedded | N | N | – | 0 | 4 | – |
| features/settings/components/InitialCapitalModal.tsx | capital lines | embedded | N | N | – | 0 | 3 | – |
| features/settings/components/partners/AddPartnerModal.tsx | partner | embedded | N | N | – | 0 | 6 | – |
| features/settings/components/partners/CreateDistributionFlow.tsx | distribution | embedded | N | N | – | 0 | 2 | raw :343 |
| features/settings/components/partners/MassPaymentWizard.tsx | payments | embedded | N | N | – | 0 | 0 | raw :118 |
| features/settings/components/partners/MobilizeEarningsWizard.tsx | earnings | embedded | N | N | – | 0 | 0 | raw :124 |
| features/settings/components/partners/PartnerLedgerDrawer.tsx | partner ledger | embedded | Y | N | – | 1 | 0 | – |
| features/settings/components/partners/PartnersClientView.tsx | partner | table/card | Y | Y | :527 | 0 | 23 | – |
| features/settings/components/partners/ProfitDistributionsTab.tsx | distribution | embedded | N | N | – | 0 | 5 | – |
| features/settings/components/ProfitDistributionDrawer.tsx | distribution line | embedded | Y | N | – | 1 | 0 | – |
| features/settings/components/UsersSettingsClientView.tsx | user | table/card | Y | Y | :136 | 1 | 1 | – |
| features/tax/components/TaxDeclarationsClientView.tsx | taxperiod | table/card | Y | Y | – | 2 | 0 | – |
| features/treasury/card-statements/BillChargesModal.tsx | charges | embedded | N | N | – | 0 | 0 | raw :232 |
| features/treasury/card-statements/StatementDetailModal.tsx | statement charge | embedded | Y | N | – | 2 | 0 | – |
| features/treasury/card-statements/StatementsClientView.tsx | cardstatement | table/card | Y | Y | :515 | 0 | 15 | – |
| features/treasury/card-statements/UnbilledChargesClientView.tsx | unbilledcharge | table/card | N | Y | :572 | 1 | 15 | – |
| features/treasury/checks/ChecksClientView.tsx | check | table/card | Y | Y | :166 | 1 | 0 | – |
| features/treasury/components/BankCenterClientView.tsx | bank | table/card | Y | Y | :121 | 0 | 0 | – |
| features/treasury/components/Bank{Checking,Credit,Loan}Section.tsx | bank sections | card | N | Y | – | 0 | 0 | – |
| features/treasury/components/BankMovementsClientView.tsx | movement | table/card | Y | Y | :113 | 0 | 0 | – |
| features/treasury/components/PaymentHardwareClientView.tsx | provider/device | table/card ×2 | Y(2) | Y(2) | :194, :247 | 0 | 0 | – |
| features/treasury/components/PaymentMethodClientView.tsx | paymentmethod | table/card | Y | Y | :208 (→ :109) | 1 | 0 | – |
| features/treasury/components/TerminalBatchesClientView.tsx | terminalbatch | table/card | Y | Y | :86 | 2 | 0 | – |
| features/treasury/components/TreasuryAccountsClientView.tsx | treasury account | table/card | Y | Y | :165 | 1 | 0 | – |
| features/treasury/components/TreasuryMovementsClientView.tsx | movement | table/card | Y | Y | :418 | 0 | 9 | – |
| features/treasury/credit-lines/CreditLinesClientView.tsx | creditline | table/card | Y | Y | :103 | 0 | 1 | – |
| features/treasury/loans/LoanDetailModal.tsx | loan installments | embedded | N | N | – | 0 | 11 | – |
| features/treasury/loans/LoanRegisterDrawer.tsx | loan register | embedded | Y | N | – | 0 | 0 | – |
| features/treasury/loans/LoansClientView.tsx | bankloan | table/card | Y | Y | :148 | 0 | 0 | – |

## `*Fields` con `computed` (línea exacta)

`accounting/ledgerMovementFields.tsx` :9, :25 · `billing/purchaseInvoiceFields.tsx` :33 · `billing/salesInvoiceFields.tsx` :28 · `contacts/contactFields.tsx` :46 · `credits/creditContactFields.tsx` :22 · `credits/creditHistoryEntryFields.tsx` :14, :25 · `credits/creditLedgerEntryFields.tsx` :16, :29 · `finance/bank-reconciliation/statementFields.tsx` :24, :37 · `finance/budgetFields.tsx` :9 · `hr/salaryAdvanceFields.tsx` :8 · `inventory/attributeFields.tsx` :13 · `inventory/categoryFields.tsx` :8 · `inventory/inventoryDocumentDetailFields.tsx` :13 · `inventory/inventoryDocumentFields.tsx` :38 · `inventory/productFields.tsx` :35, :53 · `orders/invoiceLineFields.tsx` :14 · `orders/orderLineFields.tsx` :16, :58 · `production/bomFields.tsx` :12 · `production/workOrderFields.tsx` :9 · `purchasing/purchaseOrderFields.tsx` :28, :45 · `purchasing/purchaseReceiptLineFields.tsx` :14, :33 · `purchasing/purchaseReturnLineFields.tsx` :11, :30 · `sales/saleDeliveryLineFields.tsx` :14, :33 · `sales/saleReturnLineFields.tsx` :11 · `sales/salesOrderFields.tsx` :49, :66, :92 · `settings/partnerLedgerFields.tsx` :50 · `settings/profitDistributionLineFields.tsx` :13 · `settings/userFields.tsx` :48 · `tax/taxPeriodFields.tsx` :7, :51 · `treasury/accountFields.tsx` :27 · `treasury/card-statements/statementChargeFields.tsx` :13, :60 · `treasury/card-statements/unbilledChargeFields.tsx` :19 · `treasury/checks/checkFields.tsx` :30 · `treasury/paymentMethodFields.tsx` :29 · `treasury/terminalBatchFields.tsx` :10, :30 (todas bajo `features/`).

Los `*Fields` sin `computed` (30 archivos) incluyen dos `journalEntryFields.ts` divergentes (`app/(dashboard)/accounting/entries/` y `features/accounting/`).
