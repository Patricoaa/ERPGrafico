const fs = require('fs');
const path = require('path');
const files = [
  'treasury/components/MasterDataManagement.tsx',
  'treasury/components/TerminalBatchesManagement.tsx',
  'treasury/components/TreasuryMovementsClientView.tsx',
  'treasury/components/TreasuryAccountsView.tsx',
  'tax/components/TaxDeclarationsView.tsx',
  'settings/components/GroupManagement.tsx',
  'settings/components/PartnerSettingsTab.tsx',
  'profile/components/ProfileView.tsx',
  'profile/components/PartnerProfileTab.tsx',
  'settings/components/UsersSettingsView.tsx',
  'settings/components/partners/ProfitDistributionsTab.tsx',
  'settings/components/partners/EquityCompositionTab.tsx',
  'settings/components/partners/PartnerLedgerTab.tsx',
  'sales/components/SalesOrdersView.tsx',
  'sales/components/POSSessionsView.tsx',
  'settings/components/HRSettingsView.tsx',
  'production/components/BOMManager.tsx',
  'inventory/components/CategoryList.tsx',
  'inventory/components/PricingRuleList.tsx',
  'inventory/components/MovementList.tsx',
  'inventory/components/ProductList.tsx',
  'inventory/components/StockReport.tsx',
  'inventory/components/SubscriptionsView.tsx',
  'inventory/components/WarehouseList.tsx',
  'inventory/components/UoMList.tsx',
  'inventory/components/UoMCategoryList.tsx',
  'finance/components/BudgetsListView.tsx',
  'inventory/components/AttributeManager.tsx',
  'finance/bank-reconciliation/components/DashboardPendingTable.tsx',
  'finance/bank-reconciliation/components/ReconciliationPanel.tsx',
  'finance/bank-reconciliation/components/ReconciliationRules.tsx',
  'contacts/components/ContactModal.tsx',
  'contacts/components/ContactsClientView.tsx',
  'credits/components/BlacklistView.tsx',
  'finance/bank-reconciliation/components/StatementsList.tsx',
  'credits/components/CreditPortfolioView.tsx',
  'billing/components/PurchaseInvoicesClientView.tsx',
  'billing/components/SalesInvoicesClientView.tsx',
  'accounting/components/AccountsClientView.tsx',
  'accounting/components/LedgerModal.tsx'
];

let result = '';
for (const file of files) {
  const fullPath = path.join('c:/Users/patox/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend/features', file);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, 'utf8');
  
  const hasButton = content.includes('<Button');
  const hasToolbar = content.includes('toolbarAction=');
  const isNormalButtonInToolbar = content.match(/toolbarAction=\{.*?<Button/s);
  
  result += '--- ' + file + ' ---\n';
  result += 'Has toolbarAction: ' + hasToolbar + '\n';
  result += 'Has Button in toolbar: ' + !!isNormalButtonInToolbar + '\n';
  
  // extract line with DataTable
  const lines = content.split('\n');
  const tableIdx = lines.findIndex(l => l.includes('<DataTable'));
  if (tableIdx > -1) {
      result += 'Action Context:\n';
      result += lines.slice(Math.max(0, tableIdx - 5), tableIdx + 15).join('\n') + '\n';
  }
  result += '\n';
}
fs.writeFileSync('c:/Users/patox/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend/tmp_inventory.txt', result);
console.log('Done');
