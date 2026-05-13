import fs from 'fs';
import path from 'path';

// Mapping from old entityType to registry label
const TYPE_MAPPING: Record<string, string> = {
    'sale_order': 'sales.saleorder',
    'purchase_order': 'purchasing.purchaseorder',
    'invoice': 'billing.invoice',
    'payment': 'treasury.treasurymovement',
    'journal_entry': 'accounting.journalentry',
    'inventory': 'inventory.stockmove',
    'stock_move': 'inventory.stockmove',
    'work_order': 'production.workorder',
    'sale_delivery': 'sales.saledelivery',
    'purchase_receipt': 'inventory.warehouse',
    'sale_return': 'sales.salereturn',
    'purchase_return': 'sales.salereturn',
    'cash_movement': 'treasury.treasurymovement',
    'terminal_batch': 'treasury.treasurymovement',
    'contact': 'contacts.contact',
    'employee': 'hr.employee',
    'payroll': 'hr.payroll',
    'user': 'core.user',
    'product': 'inventory.product',
    'treasury_movement': 'treasury.treasurymovement',
    'bank_statement': 'treasury.bankstatement',
    'account': 'accounting.account',
    'pos_session': 'treasury.treasurymovement', // fallback
    'warehouse': 'inventory.warehouse',
    'category': 'inventory.product', // fallback
    'fiscal_year': 'accounting.journalentry', // fallback
};

function walkDir(dir: string, callback: (filePath: string) => void) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else if (f.endsWith('Client.tsx') || f.endsWith('View.tsx')) {
            callback(dirPath);
        }
    });
}

const frontendDir = '/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend/features';
let modifiedFiles = 0;

walkDir(frontendDir, (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if it uses EntityDetailPage
    if (!content.includes('<EntityDetailPage')) return;
    
    const originalContent = content;

    // Pattern to find EntityDetailPage props
    const regex = /<EntityDetailPage\s+([\s\S]*?)breadcrumb=/g;
    
    content = content.replace(regex, (match, props) => {
        let newProps = props;
        
        // Extract entityType
        const entityTypeMatch = newProps.match(/entityType=["']([^"']+)["']/);
        const entityType = entityTypeMatch ? entityTypeMatch[1] : null;
        
        if (entityType && TYPE_MAPPING[entityType]) {
            const label = TYPE_MAPPING[entityType];
            
            // Remove entityType
            newProps = newProps.replace(/entityType=["'][^"']+["']\s*/g, '');
            // Remove title
            newProps = newProps.replace(/title=(["'][^"']+["']|\{[^}]+\})\s*/g, '');
            // Remove icon
            newProps = newProps.replace(/icon=(["'][^"']+["']|\{[^}]+\})\s*/g, '');
            
            // Add entityLabel
            if (!newProps.includes('entityLabel=')) {
                newProps = `entityLabel="${label}"\n            ` + newProps;
            }
        }
        
        return `<EntityDetailPage\n            ${newProps}breadcrumb=`;
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        modifiedFiles++;
        console.log(`Updated ${filePath}`);
    }
});

console.log(`Updated ${modifiedFiles} files.`);
