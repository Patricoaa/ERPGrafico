"use client"

import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CaretRight, CaretDown, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { EmptyState } from "@/components/shared/EmptyState";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

export interface BudgetVarianceNode {
    id: number;
    code: string;
    name: string;
    type: string;
    month_actual: number;
    month_budget: number;
    month_variance: number;
    month_percentage: number;
    ytd_actual: number;
    ytd_budget: number;
    ytd_variance: number;
    ytd_percentage: number;
    is_unbudgeted: boolean;
    children: BudgetVarianceNode[];
}

interface BudgetVarianceTableProps {
    data: BudgetVarianceNode[];
    loading?: boolean;
}

const VarianceCell = ({ value, percentage, type }: { value: number, percentage: number, type: string }) => {
    // Logic for "good" vs "bad" variance depends on account type
    // Income: Actual > Budget is GOOD (+ variance)
    // Expense: Actual > Budget is BAD (+ variance)
    const isIncome = type === 'INCOME';
    const isGood = isIncome ? value >= 0 : value <= 0;
    
    return (
        <TableCell className="text-right p-2">
            <div className="flex flex-col items-end">
                <MoneyDisplay 
                    amount={value} 
                    className={cn(
                        "font-mono text-xs font-bold",
                        value === 0 ? "text-muted-foreground" : (isGood ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")
                    )} 
                />
                <span className={cn(
                    "text-[10px] opacity-70",
                    value === 0 ? "" : (isGood ? "text-emerald-600" : "text-destructive")
                )}>
                    {percentage.toFixed(1)}%
                </span>
            </div>
        </TableCell>
    );
};

const AccountRow = ({ node, level = 0 }: { node: BudgetVarianceNode, level?: number }) => {
    const [expanded, setExpanded] = useState(level < 1);
    const hasChildren = node.children && node.children.length > 0;
    const paddingLeft = level * 16 + 8;

    return (
        <>
            <TableRow className={cn(
                "group hover:bg-muted/50 transition-colors",
                level === 0 ? "bg-muted/20 font-bold" : "",
                node.is_unbudgeted ? "bg-amber-500/5" : ""
            )}>
                <TableCell className="p-2 min-w-[280px]">
                    <div className="flex items-center" style={{ paddingLeft: `${paddingLeft}px` }}>
                        {hasChildren ? (
                            <button 
                                onClick={() => setExpanded(!expanded)} 
                                className="mr-2 h-5 w-5 flex items-center justify-center hover:bg-accent rounded transition-colors"
                            >
                                {expanded ? <CaretDown weight="bold" className="h-3 w-3" /> : <CaretRight weight="bold" className="h-3 w-3" />}
                            </button>
                        ) : (
                            <div className="w-7" />
                        )}
                        <span className="mr-2 text-muted-foreground font-mono text-[10px] w-12 shrink-0">{node.code}</span>
                        <span className="truncate max-w-[200px]" title={node.name}>{node.name}</span>
                        
                        {node.is_unbudgeted && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <WarningCircle className="ml-2 h-3.5 w-3.5 text-amber-500 shrink-0" weight="fill" />
                                    </TooltipTrigger>
                                    <TooltipContent>Cuenta no presupuestada con movimientos reales</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </TableCell>
                
                {/* Month Columns */}
                <TableCell className="text-right p-2">
                    <MoneyDisplay amount={node.month_actual} showColor={false} className="font-mono text-xs" />
                </TableCell>
                <TableCell className="text-right p-2">
                    <MoneyDisplay amount={node.month_budget} showColor={false} className="font-mono text-xs text-muted-foreground/70" />
                </TableCell>
                <VarianceCell value={node.month_variance} percentage={node.month_percentage} type={node.type} />

                {/* YTD Columns */}
                <TableCell className="text-right p-2 bg-muted/10">
                    <MoneyDisplay amount={node.ytd_actual} showColor={false} className="font-mono text-xs font-semibold" />
                </TableCell>
                <TableCell className="text-right p-2 bg-muted/10">
                    <MoneyDisplay amount={node.ytd_budget} showColor={false} className="font-mono text-xs text-muted-foreground/70" />
                </TableCell>
                <VarianceCell value={node.ytd_variance} percentage={node.ytd_percentage} type={node.type} />
            </TableRow>
            {hasChildren && expanded && node.children.map(child => (
                <AccountRow key={child.id} node={child} level={level + 1} />
            ))}
        </>
    );
};

export const BudgetVarianceTable: React.FC<BudgetVarianceTableProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
            </div>
        );
    }

    if (!data.length) {
        return <EmptyState context="finance" variant="full" title="Sin datos presupuestarios" description="No se encontraron datos para el periodo seleccionado." />
    }

    return (
        <div className="relative overflow-x-auto border rounded-sm shadow-sm bg-card">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent border-b-2">
                        <TableHead className="w-[300px] font-heading text-xs uppercase tracking-wider">Cuenta Contable</TableHead>
                        
                        {/* Month Group */}
                        <TableHead className="text-right font-heading text-[10px] uppercase text-primary border-l">Real Mes</TableHead>
                        <TableHead className="text-right font-heading text-[10px] uppercase border-r/50">Ppto Mes</TableHead>
                        <TableHead className="text-right font-heading text-[10px] uppercase">Var Mes</TableHead>
                        
                        {/* YTD Group */}
                        <TableHead className="text-right font-heading text-[10px] uppercase text-primary border-l bg-muted/20">Real YTD</TableHead>
                        <TableHead className="text-right font-heading text-[10px] uppercase border-r/50 bg-muted/20">Ppto YTD</TableHead>
                        <TableHead className="text-right font-heading text-[10px] uppercase bg-muted/20">Var YTD</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map(node => (
                        <AccountRow key={node.id} node={node} />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
