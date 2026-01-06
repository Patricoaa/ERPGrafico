import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

const AccountRow = ({ node, level = 0, showComparison }: { node: AccountNode, level?: number, showComparison?: boolean }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    // Indentation based on level
    const paddingLeft = level * 20 + 10;

    return (
        <>
            <TableRow className={cn("hover:bg-slate-50 dark:hover:bg-slate-800", level === 0 ? "font-bold" : "")}>
                <TableCell className="p-2">
                    <div className="flex items-center" style={{ paddingLeft: `${paddingLeft}px` }}>
                        {hasChildren && (
                            <button onClick={() => setExpanded(!expanded)} className="mr-2">
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                        )}
                        {!hasChildren && <div className="w-6 mr-1" />}
                        <span className="mr-2 text-muted-foreground text-xs">{node.code}</span>
                        <span>{node.name}</span>
                    </div>
                </TableCell>
                <TableCell className="text-right p-2 font-mono">
                    {node.balance.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                </TableCell>
                {showComparison && (
                    <>
                        <TableCell className="text-right p-2 font-mono text-muted-foreground">
                            {(node.comp_balance || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                        </TableCell>
                        <TableCell className={cn("text-right p-2 font-mono", (node.variance || 0) > 0 ? "text-emerald-600" : (node.variance || 0) < 0 ? "text-red-600" : "")}>
                            {(node.variance || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
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

export const FinancialStatementTable: React.FC<FinancialStatementTableProps> = ({ data, totalLabel, totalValue, totalValueComp, title, showComparison }) => {
    return (
        <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm">
            <div className="p-4 border-b bg-slate-50 dark:bg-slate-900">
                <h3 className="font-semibold text-lg">{title}</h3>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Cuenta</TableHead>
                        <TableHead className="text-right w-[150px]">Saldo</TableHead>
                        {showComparison && (
                            <>
                                <TableHead className="text-right w-[150px]">Anterior</TableHead>
                                <TableHead className="text-right w-[150px]">Var.</TableHead>
                            </>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map(node => (
                        <AccountRow key={node.id} node={node} showComparison={showComparison} />
                    ))}
                    {totalLabel && totalValue !== undefined && (
                        <TableRow className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2">
                            <TableCell className="p-4 text-primary">{totalLabel}</TableCell>
                            <TableCell className="text-right p-4 font-mono text-lg">
                                {totalValue.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                            </TableCell>
                            {showComparison && totalValueComp !== undefined && (
                                <>
                                    <TableCell className="text-right p-4 font-mono text-lg text-muted-foreground">
                                        {totalValueComp.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                    </TableCell>
                                    <TableCell className={cn("text-right p-4 font-mono text-lg", (totalValue - totalValueComp) > 0 ? "text-emerald-600" : "text-red-600")}>
                                        {(totalValue - totalValueComp).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                    </TableCell>
                                </>
                            )}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
};
