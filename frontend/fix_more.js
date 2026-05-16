const fs = require('fs');

const replacements = [
    {
        file: './features/inventory/components/UoMList.tsx',
        replacements: [
            [
                `<DataCell.Secondary className="text-center w-full">\n                    {row.getValue("category_name")}\n                </DataCell.Secondary>`,
                `<DataCell.Text className="font-normal">\n                    {row.getValue("category_name")}\n                </DataCell.Text>`
            ]
        ]
    },
    {
        file: './features/inventory/components/MovementList.tsx',
        replacements: [
            [
                `<DataCell.Secondary className="font-bold opacity-80 text-center">\n                    {row.getValue("warehouse_name")}\n                </DataCell.Secondary>`,
                `<DataCell.Text className="font-normal">\n                    {row.getValue("warehouse_name")}\n                </DataCell.Text>`
            ]
        ]
    },
    {
        file: './features/inventory/components/StockReport.tsx',
        replacements: [
            [
                `<DataCell.Secondary className="font-bold opacity-70">\n                    {row.getValue("category_name")}\n                </DataCell.Secondary>`,
                `<DataCell.Text className="font-normal">\n                    {row.getValue("category_name")}\n                </DataCell.Text>`
            ]
        ]
    },
    {
        file: './features/inventory/components/WarehouseList.tsx',
        replacements: [
            [
                `<DataCell.Secondary className="text-center w-full truncate max-w-[200px] opacity-70">\n                    {row.original.address || "-"}\n                </DataCell.Secondary>`,
                `<DataCell.Text className="font-normal truncate max-w-[200px]">\n                    {row.original.address || "-"}\n                </DataCell.Text>`
            ]
        ]
    },
    {
        file: './features/inventory/components/SubscriptionsView.tsx',
        replacements: [
            [
                `<DataCell.Secondary className="text-xs text-center">\n                            {value || "Sin Categoría"}\n                        </DataCell.Secondary>`,
                `<DataCell.Text className="font-normal">\n                            {value || "Sin Categoría"}\n                        </DataCell.Text>`
            ],
            [
                `<DataCell.Secondary className="text-foreground">{getPaymentScheduleText(row.original)}</DataCell.Secondary>`,
                `<DataCell.Text className="font-normal">{getPaymentScheduleText(row.original)}</DataCell.Text>`
            ]
        ]
    },
    {
        file: './features/billing/components/PurchaseInvoicesClientView.tsx',
        replacements: [
            [
                `<DataCell.Secondary className="font-bold uppercase text-[10px]">\n                            {label}\n                        </DataCell.Secondary>`,
                `<DataCell.Text className="font-normal uppercase text-[11px]">\n                            {label}\n                        </DataCell.Text>`
            ]
        ]
    }
];

replacements.forEach(({ file, replacements: reps }) => {
    if (!fs.existsSync(file)) {
        console.error("File not found:", file);
        return;
    }
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    reps.forEach(([from, to]) => {
        if (content.includes(from)) {
            content = content.replace(from, to);
            modified = true;
        } else {
            console.error("String not found in", file, "\n", from);
        }
    });
    if (modified) fs.writeFileSync(file, content);
});
