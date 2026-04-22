import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { ChevronRight, ChevronDown, ShieldCheck, List, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";

interface AccountNode {
    id: number | string;
    code: string;
    name: string;
    balance: number;
    comp_balance?: number;
    variance?: number;
    children: AccountNode[];
}

interface FinancialStatementTableProps {
    data: AccountNode[];
    totalLabel?: string;
    totalValue?: number;
    totalValueComp?: number;
    title: string;
    showComparison?: boolean;
    embedded?: boolean;
    periodLabel?: string;
    compPeriodLabel?: string;
}

const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '$0';
    return val.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
};

const AccountRow = ({ node, level = 0, showComparison }: { node: AccountNode, level?: number, showComparison?: boolean }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    // Indentation based on level
    const paddingLeft = level * 16 + 10;

    return (
        <>
            <TableRow className={cn(
                "hover:bg-muted/10 transition-colors border-l-2",
                level === 0 ? "font-black border-l-primary/40 bg-muted/5" : "border-l-transparent"
            )}>
                <TableCell className="py-2.5 px-4">
                    <div className="flex items-center" style={{ paddingLeft: `${paddingLeft}px` }}>
                        {hasChildren && (
                            <button onClick={() => setExpanded(!expanded)} className="mr-2 text-primary hover:scale-110 transition-transform">
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                        )}
                        {!hasChildren && <div className="w-6 mr-1 flex justify-center"><div className="w-1 h-1 rounded-full bg-muted-foreground/30" /></div>}
                        <span className="mr-3 font-mono text-[10px] text-muted-foreground tabular-nums tracking-tighter opacity-70">{node.code}</span>
                        <span className={cn("text-sm tracking-tight", level === 0 ? "uppercase font-bold" : "font-medium")}>{node.name}</span>
                    </div>
                </TableCell>
                <TableCell className="text-right py-2.5 px-4">
                    <MoneyDisplay amount={node.balance} showColor={false} className={cn("font-mono", level === 0 ? "text-base font-black" : "text-sm font-bold")} />
                </TableCell>
                {showComparison && (
                    <>
                        <TableCell className="text-right py-2.5 px-4 border-l border-muted/30">
                            <MoneyDisplay amount={node.comp_balance} showColor={false} className="font-mono text-xs text-muted-foreground font-medium" />
                        </TableCell>
                        <TableCell className="text-right py-2.5 px-4">
                             <div className="flex flex-col items-end">
                                <MoneyDisplay amount={node.variance} className="font-mono text-xs font-bold" />
                                {node.comp_balance ? (
                                    <span className="text-[10px] text-muted-foreground font-bold">
                                        {(((node.balance - node.comp_balance) / Math.abs(node.comp_balance)) * 100).toFixed(1)}%
                                    </span>
                                ) : null}
                             </div>
                        </TableCell>
                    </>
                )}
            </TableRow>
            {hasChildren && expanded && node.children.map(child => (
                <AccountRow key={child.id} node={child} level={level + 1} showComparison={showComparison} />
            ))}
        </>
    );
};

export const FinancialStatementTable: React.FC<FinancialStatementTableProps> = ({ data, totalLabel, totalValue, totalValueComp, title, showComparison, embedded, periodLabel, compPeriodLabel }) => {
    const tableContent = (
        <Table>
            <TableHeader className="bg-muted/50">
                <TableRow className="border-b-2 border-primary/20">
                    <TableHead className="font-bold text-primary py-4 px-4 h-12 uppercase tracking-widest text-[10px]">Cuenta / Concepto</TableHead>
                    <TableHead className="text-right w-[150px] font-bold text-primary py-4 px-4 h-12 uppercase tracking-widest text-[10px]">{periodLabel || 'Saldo'}</TableHead>
                    {showComparison && (
                        <>
                            <TableHead className="text-right w-[150px] font-bold text-muted-foreground py-4 px-4 h-12 uppercase tracking-widest text-[10px]">{compPeriodLabel || 'Anterior'}</TableHead>
                            <TableHead className="text-right w-[120px] font-bold py-4 px-4 h-12 uppercase tracking-widest text-[10px]">Var.</TableHead>
                        </>
                    )}
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map(node => (
                    <AccountRow key={node.id} node={node} showComparison={showComparison} />
                ))}
                {totalLabel && totalValue !== undefined && (
                    <TableRow className="bg-primary/5 font-black border-t-2 border-primary/20">
                        <TableCell className="p-5 text-primary uppercase tracking-tighter text-sm font-black">{totalLabel}</TableCell>
                        <TableCell className="text-right p-5">
                            <MoneyDisplay amount={totalValue} showColor={false} className="text-xl font-black" />
                        </TableCell>
                        {showComparison && totalValueComp !== undefined && (
                            <>
                                <TableCell className="text-right p-5 border-l border-primary/10">
                                    <MoneyDisplay amount={totalValueComp} showColor={false} className="text-xl text-muted-foreground font-bold" />
                                </TableCell>
                                <TableCell className="text-right p-5">
                                    <MoneyDisplay amount={totalValue - totalValueComp} className="text-xl font-black" />
                                </TableCell>
                            </>
                        )}
                    </TableRow>
                )
}
            </TableBody>
        </Table>
    );

    if (embedded) return tableContent;

    return (
        <div className="rounded-md border bg-card shadow-sm">
            <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-lg">{title}</h3>
            </div>
            {tableContent}
        </div>
    );
};
