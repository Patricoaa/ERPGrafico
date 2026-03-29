const fs = require('fs');
const file = 'c:\\Users\\patox\\Nextcloud\\Pato\\Aplicaciones\\ERPGrafico\\frontend\\components\\shared\\TransactionViewModal.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');
const startIdx = lines.findIndex(l => l.includes('// --- Helper Components for the Modular Layout ---'));
const endIdx = lines.findIndex(l => l.startsWith('export function TransactionViewModal'));

if (startIdx !== -1 && endIdx !== -1) {
    const newImports = [
        'import { BannerStatus } from "./transaction-modal/BannerStatus"',
        'import { MetadataItem } from "./transaction-modal/MetadataItem"',
        'import { SidebarSection, SidebarContent } from "./transaction-modal/SidebarContent"',
        'import { RelatedDocumentsSection } from "./transaction-modal/RelatedDocumentsSection"',
        'import { PaymentHistorySection } from "./transaction-modal/PaymentHistorySection"',
        'import { PrintableReceipt } from "./transaction-modal/PrintableReceipt"',
        ''
    ].join('\n');
    lines.splice(startIdx, endIdx - startIdx, newImports);
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Successfully replaced lines ' + startIdx + ' to ' + endIdx);
} else {
    console.log('Could not find indices: start=' + startIdx + ', end=' + endIdx);
}
