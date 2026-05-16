const fs = require('fs');

const files = [
    './features/treasury/components/TreasuryMovementsClientView.tsx',
    './features/treasury/components/TreasuryAccountsView.tsx',
    './features/treasury/components/MasterDataManagement.tsx',
    './features/inventory/components/UoMList.tsx',
    './features/inventory/components/AttributeManager.tsx',
    './features/inventory/components/MovementList.tsx',
    './features/inventory/components/StockReport.tsx',
    './features/inventory/components/WarehouseList.tsx',
    './features/inventory/components/SubscriptionsView.tsx',
    './features/billing/components/PurchaseInvoicesClientView.tsx',
    './app/(dashboard)/hr/employees/page.tsx',
    './app/(dashboard)/hr/advances/page.tsx'
];

files.forEach(f => {
    if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf8');
        const lines = content.split('\n');
        console.log(`\n--- ${f} ---`);
        lines.forEach((line, i) => {
            if (line.includes('<DataCell.Secondary')) {
                // Print surrounding context
                for(let j = Math.max(0, i-2); j <= Math.min(lines.length-1, i+2); j++) {
                    console.log(`${j}: ${lines[j]}`);
                }
                console.log('------------------');
            }
        });
    }
});
