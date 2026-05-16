const fs = require('fs');
const file = './features/treasury/components/MasterDataManagement.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
    '<DataCell.Secondary className="text-center">{row.original.treasury_account_name}</DataCell.Secondary>',
    '<DataCell.Text className="font-normal">{row.original.treasury_account_name}</DataCell.Text>'
);
fs.writeFileSync(file, content);
