const fs = require('fs');
const path = require('path');

const filesToFix = [
    "./features/workflow/components/TaskInbox.tsx",
    "./features/production/components/forms/WorkOrderForm/index.tsx",
    "./features/production/components/ProductionOrderDetailClient.tsx",
    "./features/pos/components/Cart.tsx",
    "./features/treasury/components/BankStatementDetailClient.tsx",
    "./features/credits/components/BlacklistView.tsx",
    "./features/profile/components/PartnerProfileTab.tsx",
    "./features/profile/components/ProfileView.tsx"
];

filesToFix.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. TaskInbox
    content = content.replace(/val\.toLocaleDateString\('es-CL',\s*\{[^}]+\}\)/g, 'formatPlainDate(val)');
    
    // 2. WorkOrderForm
    content = content.replace(/suggested\.toLocaleDateString\('es-CL'\)/g, 'formatPlainDate(suggested)');

    // 3. ProductionOrderDetailClient
    content = content.replace(/new Date\(order\.start_date\)\.toLocaleDateString\(\)/g, 'formatPlainDate(order.start_date)');
    content = content.replace(/new Date\(order\.due_date\)\.toLocaleDateString\(\)/g, 'formatPlainDate(order.due_date)');

    // 4. Cart.tsx
    content = content.replace(/new Date\(deliveryDate\)\.toLocaleDateString\(\)/g, 'formatPlainDate(deliveryDate)');
    content = content.replace(/new Date\(\)\.toLocaleDateString\(\)/g, 'formatPlainDate(new Date())');

    // 5. BankStatementDetailClient
    content = content.replace(/new Date\(data\.statement_date \+ "T00:00:00"\)\.toLocaleDateString\("es-CL"\)/g, 'formatPlainDate(data.statement_date)');
    content = content.replace(/new Date\(data\.period_start \+ "T00:00:00"\)\.toLocaleDateString\("es-CL"\)/g, 'formatPlainDate(data.period_start)');
    content = content.replace(/new Date\(data\.period_end \+ "T00:00:00"\)\.toLocaleDateString\("es-CL"\)/g, 'formatPlainDate(data.period_end)');

    // 6. BlacklistView
    content = content.replace(/new Date\(row\.original\.credit_last_evaluated\)\.toLocaleDateString\(\)/g, 'formatPlainDate(row.original.credit_last_evaluated)');

    // 7. PartnerProfileTab
    content = content.replace(/new Date\(\(contact\.partner_since \|\| contact\.created_at\) as string\)\.toLocaleDateString\('es-CL'\)/g, 'formatPlainDate(contact.partner_since || contact.created_at)');

    // 8. ProfileView
    content = content.replace(/new Date\(employee\.start_date\)\.toLocaleDateString\('es-CL'\)/g, 'formatPlainDate(employee.start_date)');

    // Add import if needed
    if (content !== original && !content.includes('formatPlainDate')) {
        // If there's an import from utils, add it there, else add new import
        if (content.includes('@/lib/utils')) {
            content = content.replace(/(import\s*\{[^}]*)(?=\}\s*from\s*['"]@\/lib\/utils['"])/, '$1, formatPlainDate ');
        } else {
            content = `import { formatPlainDate } from "@/lib/utils"\n` + content;
        }
        // Cleanup double commas or leading commas
        content = content.replace(/,\s*,/g, ',');
        content = content.replace(/\{\s*,/g, '{');
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content);
    }
});
