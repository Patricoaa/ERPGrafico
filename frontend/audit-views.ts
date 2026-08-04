import fs from 'fs';
import path from 'path';
import { ENTITY_REGISTRY } from './lib/entity-registry';

const files = [
  "features/accounting/components/closures/AccountingClosuresClientView.tsx",
  "features/billing/components/PurchaseInvoicesClientView.tsx",
  "features/billing/components/SalesInvoicesClientView.tsx",
  "features/contacts/components/ContactsClientView.tsx",
  "features/finance/bank-reconciliation/components/StatementsClientView.tsx",
  "features/finance/components/BudgetsClientView.tsx",
  "features/hr/components/AbsenceClientView.tsx",
  "features/hr/components/EmployeeClientView.tsx",
  "features/hr/components/PayrollClientView.tsx",
  "features/hr/components/SalaryAdvanceClientView.tsx",
  "features/inventory/components/AttributesClientView.tsx",
  "features/inventory/components/CategoryClientView.tsx",
  "features/inventory/components/DocumentsClientView.tsx",
  "features/inventory/components/InventoryCountClientView.tsx",
  "features/inventory/components/MovementClientView.tsx",
  "features/inventory/components/PricingRuleClientView.tsx",
  "features/inventory/components/ProductClientView.tsx",
  "features/inventory/components/StockReport.tsx",
  "features/inventory/components/SubscriptionsClientView.tsx",
  "features/inventory/components/UoMCategoryClientView.tsx",
  "features/inventory/components/UoMClientView.tsx",
  "features/inventory/components/WarehouseClientView.tsx",
  "features/production/components/BOMClientView.tsx",
  "features/sales/components/POSSessionsClientView.tsx",
  "features/sales/components/PosTerminalClientView.tsx",
  "features/sales/components/SalesOrdersView.tsx",
  "features/settings/components/GroupsClientView.tsx",
  "features/settings/components/UsersSettingsClientView.tsx",
  "features/settings/components/partners/PartnersClientView.tsx",
  "features/tax/components/TaxDeclarationsClientView.tsx",
  "features/treasury/card-statements/StatementDetailModal.tsx",
  "features/treasury/card-statements/StatementsClientView.tsx",
  "features/treasury/card-statements/UnbilledChargesClientView.tsx",
  "features/treasury/checks/ChecksClientView.tsx",
  "features/treasury/components/BankCenterClientView.tsx",
  "features/treasury/components/BankMovementsClientView.tsx",
  "features/treasury/components/PaymentHardwareClientView.tsx",
  "features/treasury/components/PaymentMethodClientView.tsx",
  "features/treasury/components/TerminalBatchesClientView.tsx",
  "features/treasury/components/TreasuryAccountsClientView.tsx",
  "features/treasury/components/TreasuryMovementsClientView.tsx",
  "features/treasury/credit-lines/CreditLinesClientView.tsx",
  "features/treasury/loans/LoansClientView.tsx"
];

const results = [];

for (const file of files) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) continue;
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Regex to extract entityLabel="something"
  let entityLabel = 'UNKNOWN';
  const labelMatch = content.match(/entityLabel=(['"])(.*?)\1/);
  if (labelMatch) {
    entityLabel = labelMatch[2];
  } else {
    // some files might not have it directly on DataTableView, try to guess from imports or fallback
    const fallbackMatch = content.match(/['"]([a-z]+\.[a-z]+)['"]/);
    if (fallbackMatch) entityLabel = fallbackMatch[1];
  }
  
  const hasRenderCard = content.includes('renderCard=');
  
  const entityMeta = ENTITY_REGISTRY[entityLabel];
  const cardComp = entityMeta?.viewPolicy?.cardComponent || 'none (default list)';
  const availableViews = entityMeta?.viewPolicy?.availableViews?.join(', ') || 'list';

  let recommendation = '';
  if (cardComp === 'custom') {
    recommendation = '✅ JSX Manual Válido (Compleja)';
  } else {
    if (hasRenderCard) {
      recommendation = '🚨 Deuda Crítica: JSX manual (Migrar a AutoEntityCard)';
    } else {
      recommendation = '⚠️ Faltante: Añadir AutoEntityCard (Solo tiene tabla)';
    }
  }

  results.push({
    file: path.basename(file),
    module: file.split('/')[1].toUpperCase(),
    entityLabel,
    availableViews,
    cardComponentRegistry: cardComp,
    hasRenderCard,
    recommendation
  });
}

// Sort by module then file
results.sort((a, b) => a.module.localeCompare(b.module) || a.file.localeCompare(b.file));

const markdown = [
  '# Inventario Completo de Vistas (Client Views)\n',
  'Este documento lista **todas las vistas** existentes y la estrategia recomendada para cada una, considerando que todas (salvo las complejas) deben soportar el modo tarjeta mediante auto-generación.\n',
  '| Módulo | Archivo | Entidad | Vistas en Registry | Estado Actual y Acción Requerida |',
  '|--------|---------|---------|--------------------|----------------------------------|'
];

let manualComplexCount = 0;
let debtManualJSXCount = 0;
let missingCardCount = 0;

for (const r of results) {
  if (r.cardComponentRegistry === 'domain' || r.cardComponentRegistry === 'custom') {
    manualComplexCount++;
  } else {
    if (r.hasRenderCard) debtManualJSXCount++;
    else missingCardCount++;
  }
  markdown.push(`| ${r.module} | \`${r.file}\` | \`${r.entityLabel}\` | ${r.availableViews} | ${r.recommendation} |`);
}

markdown.push('\n## Resumen de Tareas para Cerrar Brecha Técnica');
markdown.push(`- **Total de vistas analizadas:** ${results.length}`);
markdown.push(`- **Dejar Intactas (Vistas Complejas - Domain/Custom):** ${manualComplexCount}`);
markdown.push(`- **Refactorizar (Tienen JSX Manual escrito):** ${debtManualJSXCount}`);
markdown.push(`- **Implementar desde Cero (Solo tenían tabla, requieren tarjeta automática):** ${missingCardCount}`);

fs.writeFileSync('/home/pato/.gemini/antigravity-cli/brain/7d5148ba-d71d-4c76-b223-f204bf516d43/inventory_report.md', markdown.join('\n'));
console.log('Done');
