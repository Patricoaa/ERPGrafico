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
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";

interface CashFlowItem {
    name: string;
    amount: number;
    amount_comp?: number;
}

interface CashFlowData {
    operating: CashFlowItem[];
    total_operating: number;
    total_operating_comp?: number;
    investing: CashFlowItem[];
    total_investing: number;
    total_investing_comp?: number;
    financing: CashFlowItem[];
    total_financing: number;
    total_financing_comp?: number;
    net_increase: number;
    net_increase_comp?: number;
}

interface CashFlowTableProps {
    data: CashFlowData;
    embedded?: boolean;
    showComparison?: boolean;
    periodLabel?: string;
    compPeriodLabel?: string;
}



const SectionHeader = ({ title, showComparison }: { title: string, showComparison?: boolean }) => (
    <TableRow className="bg-muted/50 font-bold">
        <TableCell colSpan={showComparison ? 4 : 2} className="py-2">{title}</TableCell>
    </TableRow>
);

const SectionTotal = ({ title, amount, amountComp, showComparison }: { title: string, amount: number, amountComp?: number, showComparison?: boolean }) => (
    <TableRow className="font-semibold border-t">
        <TableCell className="pl-8 italic">{title}</TableCell>
        <TableCell className="text-right">
            <MoneyDisplay amount={amount} showColor={false} className="font-mono text-sm" />
        </TableCell>
        {showComparison && (
            <>
                <TableCell className="text-right">
                    <MoneyDisplay amount={amountComp} showColor={false} className="font-mono text-sm text-muted-foreground" />
                </TableCell>
                <TableCell className="text-right">
                    <MoneyDisplay amount={amount - (amountComp || 0)} className="font-mono text-sm" />
                </TableCell>
            </>
        )}
    </TableRow>
);

export const CashFlowTable: React.FC<CashFlowTableProps> = ({ data, embedded, showComparison, periodLabel, compPeriodLabel }) => {
    const tableContent = (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right w-[200px]">{periodLabel || 'Actual'}</TableHead>
                    {showComparison && (
                        <>
                            <TableHead className="text-right w-[200px]">{compPeriodLabel || 'Anterior'}</TableHead>
                            <TableHead className="text-right w-[200px]">Var.</TableHead>
                        </>
                    )}
                </TableRow>
            </TableHeader>
            <TableBody>

                {/* Operating */}
                <SectionHeader title="Actividades de Operación" showComparison={showComparison} />
                {data.operating.map((item, idx) => (
                    <TableRow key={idx}>
                        <TableCell className="pl-4">{item.name}</TableCell>
                        <TableCell className="text-right">
                            <MoneyDisplay amount={item.amount} showColor={false} className="font-mono text-sm" />
                        </TableCell>
                        {showComparison && (
                            <>
                                <TableCell className="text-right">
                                    <MoneyDisplay amount={item.amount_comp} showColor={false} className="font-mono text-sm text-muted-foreground" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <MoneyDisplay amount={item.amount - (item.amount_comp || 0)} className="font-mono text-sm" />
                                </TableCell>
                            </>
                        )}
                    </TableRow>
                ))}
                <SectionTotal title="Flujo Neto de Actividades de Operación" amount={data.total_operating} amountComp={data.total_operating_comp} showComparison={showComparison} />

                {/* Investing */}
                <SectionHeader title="Actividades de Inversión" showComparison={showComparison} />
                {data.investing.length === 0 && (
                    <TableRow><TableCell colSpan={showComparison ? 4 : 2} className="pl-4 text-muted-foreground text-sm">Sin movimientos</TableCell></TableRow>
                )}
                {data.investing.map((item, idx) => (
                    <TableRow key={idx}>
                        <TableCell className="pl-4">{item.name}</TableCell>
                        <TableCell className="text-right">
                            <MoneyDisplay amount={item.amount} showColor={false} className="font-mono text-sm" />
                        </TableCell>
                        {showComparison && (
                            <>
                                <TableCell className="text-right">
                                    <MoneyDisplay amount={item.amount_comp} showColor={false} className="font-mono text-sm text-muted-foreground" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <MoneyDisplay amount={item.amount - (item.amount_comp || 0)} className="font-mono text-sm" />
                                </TableCell>
                            </>
                        )}
                    </TableRow>
                ))}
                <SectionTotal title="Flujo Neto de Actividades de Inversión" amount={data.total_investing} amountComp={data.total_investing_comp} showComparison={showComparison} />

                {/* Financing */}
                <SectionHeader title="Actividades de Financiamiento" showComparison={showComparison} />
                {data.financing.length === 0 && (
                    <TableRow><TableCell colSpan={showComparison ? 4 : 2} className="pl-4 text-muted-foreground text-sm">Sin movimientos</TableCell></TableRow>
                )}
                {data.financing.map((item, idx) => (
                    <TableRow key={idx}>
                        <TableCell className="pl-4">{item.name}</TableCell>
                        <TableCell className="text-right">
                            <MoneyDisplay amount={item.amount} showColor={false} className="font-mono text-sm" />
                        </TableCell>
                        {showComparison && (
                            <>
                                <TableCell className="text-right">
                                    <MoneyDisplay amount={item.amount_comp} showColor={false} className="font-mono text-sm text-muted-foreground" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <MoneyDisplay amount={item.amount - (item.amount_comp || 0)} className="font-mono text-sm" />
                                </TableCell>
                            </>
                        )}
                    </TableRow>
                ))}
                <SectionTotal title="Flujo Neto de Actividades de Financiamiento" amount={data.total_financing} amountComp={data.total_financing_comp} showComparison={showComparison} />

                {/* Total */}
                <TableRow className="bg-muted font-bold border-t-2 text-lg">
                    <TableCell className="pt-4">Aumento (Disminución) Neto de Efectivo</TableCell>
                    <TableCell className="text-right pt-4">
                        <MoneyDisplay amount={data.net_increase} showColor={false} className="text-lg" />
                    </TableCell>
                    {showComparison && (
                        <>
                            <TableCell className="text-right pt-4">
                                <MoneyDisplay amount={data.net_increase_comp} showColor={false} className="text-lg text-muted-foreground" />
                            </TableCell>
                            <TableCell className="text-right pt-4">
                                <MoneyDisplay amount={data.net_increase - (data.net_increase_comp || 0)} className="text-lg" />
                            </TableCell>
                        </>
                    )}
                </TableRow>

            </TableBody>
        </Table>
    );

    if (embedded) return tableContent;

    return (
        <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm">
            <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-lg">Estado de Flujo de Efectivo (Método Indirecto)</h3>
            </div>
            {tableContent}
        </div>
    );
};
