import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface CashFlowItem {
    name: string;
    amount: number;
}

interface CashFlowData {
    operating: CashFlowItem[];
    total_operating: number;
    investing: CashFlowItem[];
    total_investing: number;
    financing: CashFlowItem[];
    total_financing: number;
    net_cash_flow: number;
}

interface CashFlowTableProps {
    data: CashFlowData;
    embedded?: boolean;
}

const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '$0';
    return val.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
};

const SectionHeader = ({ title }: { title: string }) => (
    <TableRow className="bg-slate-100 dark:bg-slate-900 font-bold">
        <TableCell colSpan={2} className="py-2">{title}</TableCell>
    </TableRow>
);

const SectionTotal = ({ title, amount }: { title: string, amount: number }) => (
    <TableRow className="font-semibold border-t">
        <TableCell className="pl-8 italic">{title}</TableCell>
        <TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell>
    </TableRow>
);

export const CashFlowTable: React.FC<CashFlowTableProps> = ({ data, embedded }) => {
    const tableContent = (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right w-[200px]">Monto</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>

                {/* Operating */}
                <SectionHeader title="Actividades de Operación" />
                {data.operating.map((item, idx) => (
                    <TableRow key={idx}>
                        <TableCell className="pl-4">{item.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                ))}
                <SectionTotal title="Flujo Neto de Actividades de Operación" amount={data.total_operating} />

                {/* Investing */}
                <SectionHeader title="Actividades de Inversión" />
                {data.investing.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="pl-4 text-muted-foreground text-sm">Sin movimientos</TableCell></TableRow>
                )}
                {data.investing.map((item, idx) => (
                    <TableRow key={idx}>
                        <TableCell className="pl-4">{item.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                ))}
                <SectionTotal title="Flujo Neto de Actividades de Inversión" amount={data.total_investing} />

                {/* Financing */}
                <SectionHeader title="Actividades de Financiamiento" />
                {data.financing.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="pl-4 text-muted-foreground text-sm">Sin movimientos</TableCell></TableRow>
                )}
                {data.financing.map((item, idx) => (
                    <TableRow key={idx}>
                        <TableCell className="pl-4">{item.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                ))}
                <SectionTotal title="Flujo Neto de Actividades de Financiamiento" amount={data.total_financing} />

                {/* Total */}
                <TableRow className="bg-slate-200 dark:bg-slate-800 font-bold border-t-2 text-lg">
                    <TableCell className="pt-4">Aumento (Disminución) Neto de Efectivo</TableCell>
                    <TableCell className="text-right pt-4 font-mono">
                        {formatCurrency(data.net_cash_flow)}
                    </TableCell>
                </TableRow>

            </TableBody>
        </Table>
    );

    if (embedded) return tableContent;

    return (
        <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm">
            <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
                <h3 className="font-semibold text-lg">Estado de Flujo de Efectivo (Método Indirecto)</h3>
            </div>
            {tableContent}
        </div>
    );
};
