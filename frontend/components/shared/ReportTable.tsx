"use client";

import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { CaretRight, CaretDown, Receipt, Info } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";

export interface ReportNode {
    id: number | string;
    code: string;
    name: string;
    balance: number;
    comp_balance?: number;
    variance?: number;
    children?: ReportNode[];
}

interface ReportTableProps {
    data: ReportNode[] | null;
    title?: string;
    totalLabel?: string;
    totalValue?: number;
    totalValueComp?: number;
    showComparison?: boolean;
    embedded?: boolean;
    isLoading?: boolean;
    periodLabel?: string;
    compPeriodLabel?: string;
    mode?: 'tree' | 'flat';
    accentColor?: 'primary' | 'success' | 'info' | 'destructive';
}

const RowIcon = ({ isExpanded, hasChildren, level }: { isExpanded: boolean, hasChildren: boolean, level: number }) => {
    if (hasChildren) {
        return isExpanded ? <CaretDown weight="bold" className="h-4 w-4 text-primary" /> : <CaretRight weight="bold" className="h-4 w-4 text-primary" />;
    }
    return <div className="w-1 h-1 rounded-full bg-muted-foreground/30 flex-shrink-0" />;
};

const ReportRow = ({ 
    node, 
    level = 0, 
    showComparison, 
    mode = 'tree' 
}: { 
    node: ReportNode, 
    level?: number, 
    showComparison?: boolean,
    mode?: 'tree' | 'flat'
}) => {
    const [expanded, setExpanded] = React.useState(true);
    const hasChildren = mode === 'tree' && node.children && node.children.length > 0;
    const paddingLeft = level * 16 + 10;

    return (
        <>
            <TableRow className={cn(
                "hover:bg-muted/10 transition-colors border-l-2",
                level === 0 ? "font-black border-l-primary/40 bg-muted/5 h-12" : "border-l-transparent"
            )}>
                <TableCell className="py-2.5 px-4">
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${paddingLeft}px` }}>
                        {(hasChildren || mode === 'flat') && (
                            <button 
                                onClick={() => mode === 'tree' && setExpanded(!expanded)} 
                                className={cn("flex-shrink-0", !hasChildren && mode === 'flat' && "cursor-default opacity-50")}
                                disabled={!hasChildren}
                            >
                                <RowIcon isExpanded={expanded} hasChildren={hasChildren} level={level} />
                            </button>
                        )}
                        {!hasChildren && mode === 'tree' && <div className="w-6 mr-1 flex justify-center"><div className="w-1 h-1 rounded-full bg-muted-foreground/30" /></div>}
                        
                        <div className="flex flex-col min-w-0">
                            {node.code && (
                                <span className="font-mono text-[9px] text-muted-foreground tracking-tighter opacity-70 leading-none mb-0.5">
                                    {node.code}
                                </span>
                            )}
                            <span className={cn(
                                "text-sm tracking-tight truncate", 
                                level === 0 ? "uppercase font-bold" : "font-medium"
                            )}>
                                {node.name}
                            </span>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="text-right py-2.5 px-4">
                    <MoneyDisplay 
                        amount={node.balance} 
                        showColor={false} 
                        className={cn("font-mono font-bold", level === 0 ? "text-base font-black" : "text-sm")} 
                    />
                </TableCell>
                {showComparison && (
                    <>
                        <TableCell className="text-right py-2.5 px-4 border-l border-muted/20">
                            <MoneyDisplay amount={node.comp_balance} showColor={false} className="font-mono text-xs text-muted-foreground font-medium" />
                        </TableCell>
                        <TableCell className="text-right py-2.5 px-4">
                             <div className="flex flex-col items-end">
                                <MoneyDisplay amount={node.variance} className="font-mono text-xs font-bold" />
                                {node.comp_balance ? (
                                    <span className="text-[10px] text-muted-foreground font-black">
                                        {(((node.balance - node.comp_balance) / Math.abs(node.comp_balance)) * 100).toFixed(1)}%
                                    </span>
                                ) : null}
                             </div>
                        </TableCell>
                    </>
                )}
            </TableRow>
            {hasChildren && expanded && node.children?.map(child => (
                <ReportRow key={child.id} node={child} level={level + 1} showComparison={showComparison} mode={mode} />
            ))}
        </>
    );
};

export const ReportTableSkeleton = ({ showComparison }: { showComparison?: boolean }) => (
    <div className="space-y-4 p-4 animate-in fade-in duration-500">
        <div className="h-10 w-1/3 bg-muted/50 rounded-sm mb-6" />
        {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex justify-between items-center py-3 border-b border-muted/30">
                <div className="flex gap-4 items-center">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                </div>
                <div className="flex gap-12">
                    <Skeleton className="h-4 w-24" />
                    {showComparison && (
                        <>
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-16" />
                        </>
                    )}
                </div>
            </div>
        ))}
    </div>
);

export const ReportTable: React.FC<ReportTableProps> = ({ 
    data, 
    title, 
    totalLabel, 
    totalValue, 
    totalValueComp, 
    showComparison, 
    embedded, 
    isLoading,
    periodLabel,
    compPeriodLabel,
    mode = 'tree',
    accentColor = 'primary'
}) => {
    if (isLoading) return <ReportTableSkeleton showComparison={showComparison} />;
    
    if (!data || data.length === 0) {
        return (
            <div className="p-12">
                <EmptyState 
                    context="finance" 
                    title="Sin datos en este periodo"
                    description="No se encontraron movimientos contables registrados para los filtros seleccionados." 
                />
            </div>
        );
    }

    const tableContent = (
        <div className="relative group">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow className={cn(
                        "border-b-2",
                        accentColor === 'primary' ? "border-primary/20" : 
                        accentColor === 'success' ? "border-success/20" : 
                        accentColor === 'info' ? "border-info/20" : "border-destructive/20"
                    )}>
                        <TableHead className="font-bold text-foreground py-4 px-4 h-12 uppercase tracking-widest text-[9px]">Cuenta / Concepto</TableHead>
                        <TableHead className="text-right w-[150px] font-bold text-foreground py-4 px-4 h-12 uppercase tracking-widest text-[9px]">{periodLabel || 'Saldo'}</TableHead>
                        {showComparison && (
                            <>
                                <TableHead className="text-right w-[150px] font-bold text-muted-foreground py-4 px-4 h-12 uppercase tracking-widest text-[9px]">{compPeriodLabel || 'Anterior'}</TableHead>
                                <TableHead className="text-right w-[110px] font-bold py-4 px-4 h-12 uppercase tracking-widest text-[9px]">Var.</TableHead>
                            </>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map(node => (
                        <ReportRow key={node.id} node={node} showComparison={showComparison} mode={mode} />
                    ))}
                    {totalLabel && totalValue !== undefined && (
                        <TableRow className={cn(
                            "font-black border-t-2 shadow-sm relative z-10",
                            accentColor === 'primary' ? "bg-primary/5 border-primary/20" :
                            accentColor === 'success' ? "bg-success/5 border-success/20" :
                            accentColor === 'info' ? "bg-info/5 border-info/20" : "bg-destructive/5 border-destructive/20"
                        )}>
                            <TableCell className="p-5 text-foreground uppercase tracking-tighter text-sm font-black italic">{totalLabel}</TableCell>
                            <TableCell className="text-right p-5">
                                <MoneyDisplay amount={totalValue} showColor={false} className="text-xl font-black" />
                            </TableCell>
                            {showComparison && totalValueComp !== undefined && (
                                <>
                                    <TableCell className="text-right p-5 border-l border-muted/20">
                                        <MoneyDisplay amount={totalValueComp} showColor={false} className="text-xl text-muted-foreground font-bold opacity-70" />
                                    </TableCell>
                                    <TableCell className="text-right p-5">
                                        <MoneyDisplay amount={totalValue - totalValueComp} className="text-xl font-black" />
                                    </TableCell>
                                </>
                            )}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );

    if (embedded) return tableContent;

    return (
        <div className="rounded-none border bg-card shadow-sm overflow-hidden">
            {title && (
                <div className="p-4 border-b bg-muted/30 flex justify-between items-center h-12">
                    <h3 className="font-bold uppercase tracking-widest text-xs text-muted-foreground animate-in slide-in-from-left-2">{title}</h3>
                </div>
            )}
            {tableContent}
        </div>
    );
};
