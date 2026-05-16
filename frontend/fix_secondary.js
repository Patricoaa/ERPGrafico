const fs = require('fs');

const replacements = [
    {
        file: './features/contacts/components/ContactsClientView.tsx',
        replacements: [
            [
                `cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Secondary>{row.getValue("email") || "-"}</DataCell.Secondary></div>`,
                `cell: ({ row }) => <DataCell.Text className="font-normal lowercase">{row.getValue("email") || "-"}</DataCell.Text>`
            ],
            [
                `cell: ({ row }) => <div className="flex justify-center w-full"><DataCell.Secondary>{row.getValue("phone") || "-"}</DataCell.Secondary></div>`,
                `cell: ({ row }) => <DataCell.Code>{row.getValue("phone") || "-"}</DataCell.Code>`
            ]
        ]
    },
    {
        file: './features/inventory/components/ProductList.tsx',
        replacements: [
            [
                `cell: ({ row }) => <DataCell.Secondary>{row.getValue("category_name")}</DataCell.Secondary>`,
                `cell: ({ row }) => <DataCell.Text className="font-normal">{row.getValue("category_name")}</DataCell.Text>`
            ]
        ]
    },
    {
        file: './features/inventory/components/CategoryList.tsx',
        replacements: [
            [
                `cell: ({ row }) => <DataCell.Secondary className="text-[10px] uppercase font-bold text-muted-foreground opacity-60 text-center w-full">{row.getValue("parent_name") || "-"}</DataCell.Secondary>`,
                `cell: ({ row }) => <DataCell.Text className="font-normal text-muted-foreground">{row.getValue("parent_name") || "-"}</DataCell.Text>`
            ]
        ]
    },
    {
        file: './app/(dashboard)/purchasing/orders/components/PurchasingOrdersClientView.tsx',
        replacements: [
            [
                `cell: ({ row }) => <DataCell.Secondary>{row.getValue("warehouse_name")}</DataCell.Secondary>`,
                `cell: ({ row }) => <DataCell.Text className="font-normal">{row.getValue("warehouse_name")}</DataCell.Text>`
            ]
        ]
    },
    {
        file: './features/sales/components/SalesOrdersView.tsx',
        replacements: [
            [
                `cell: ({ row }) => <DataCell.Secondary className="font-bold uppercase text-[10px] text-center">{row.original.dte_type_display}</DataCell.Secondary>`,
                `cell: ({ row }) => <DataCell.Text className="font-normal uppercase text-[11px]">{row.original.dte_type_display}</DataCell.Text>`
            ]
        ]
    },
    {
        file: './features/billing/components/SalesInvoicesClientView.tsx',
        replacements: [
            [
                `cell: ({ row }) => <DataCell.Secondary className="font-bold uppercase text-[10px] text-center">{row.getValue("dte_type_display")}</DataCell.Secondary>`,
                `cell: ({ row }) => <DataCell.Text className="font-normal uppercase text-[11px]">{row.getValue("dte_type_display")}</DataCell.Text>`
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
