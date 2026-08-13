"use client";

import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  flexRender,
  createColumnHelper,
  type ExpandedState,
  type ColumnDef,
} from '@tanstack/react-table';
import { ChevronRight, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, MoneyDisplay, SkeletonShell } from '@/components/shared';
import { LedgerDrawer } from '@/features/accounting';

export interface ReportNode {
    id: number | string;
    code: string;
    name: string;
    balance: number;
    comp_balance?: number;
    variance?: number;
    children?: ReportNode[];
    isTotalRow?: boolean;
    varianceDirection?: 'higher-is-better' | 'lower-is-better';
}

interface ReportTableProps {
    data: ReportNode[] | null;
    showComparison?: boolean;
    isLoading?: boolean;
    periodLabel?: string;
    compPeriodLabel?: string;
    varianceDirection?: 'higher-is-better' | 'lower-is-better';
    disableDrillDown?: boolean;
}

interface DrillDownTarget {
    accountId: number;
    accountName: string;
    accountCode: string;
}

// Column value variants used by ReportTable. Accessor defs are only assignable
// across the *exact* TValue they carry (TanStack templates are contravariant in it),
// so the array must name each variant explicitly instead of widening to `unknown`.
type ReportTableColumn =
    | ColumnDef<ReportNode, string>
    | ColumnDef<ReportNode, number>
    | ColumnDef<ReportNode, number | undefined>;

const columnHelper = createColumnHelper<ReportNode>();

const SKELETON_DATA: ReportNode[] = Array.from({ length: 5 }, (_, i) => ({
    id: `sk-${i}`,
    code: "00.00.00",
    name: "————————————————————————————",
    balance: 0,
    comp_balance: 0,
    variance: 0,
}));

/** Returns true only if the node has a real numeric DB id (not a synthetic wrapper) */
function isDrillable(node: ReportNode): boolean {
    if (node.isTotalRow) return false;
    const numId = Number(node.id);
    return !isNaN(numId) && numId > 0;
}

export const ReportTable: React.FC<ReportTableProps> = ({ 
    data, 
    showComparison, 
    isLoading,
    periodLabel,
    compPeriodLabel,
    varianceDirection = 'higher-is-better',
    disableDrillDown = false
}) => {
    const [expanded, setExpanded] = useState<ExpandedState>(true);
    const [drillDown, setDrillDown] = useState<DrillDownTarget | null>(null);

    const displayData = isLoading ? SKELETON_DATA : data || [];

    const handleRowClick = (node: ReportNode) => {
        if (disableDrillDown || !isDrillable(node)) return;
        setDrillDown({
            accountId: Number(node.id),
            accountName: node.name,
            accountCode: node.code ?? '',
        });
    };

    const columns = React.useMemo(() => {
        const cols: ReportTableColumn[] = [
            columnHelper.accessor('name', {
                header: ({ table }) => (
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            onClick={table.getToggleAllRowsExpandedHandler()}
                            className="p-1 bg-transparent text-muted-foreground hover:bg-muted/50 transition-colors flex-shrink-0 -ml-1"
                            title="Expandir/contraer todo"
                        >
                            {table.getIsAllRowsExpanded() ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                        </Button>
                        <span>Cuenta / Concepto</span>
                    </div>
                ),
                cell: ({ row, getValue }) => {
                    const node = row.original;
                    const level = row.depth;
                    const hasChildren = row.getCanExpand();
                    const paddingLeft = level * 16 + 16;
                    const drillable = isDrillable(node);
                    
                    if (node.isTotalRow) {
                        return (
                            <div className="flex items-center py-1" style={{ paddingLeft: `${paddingLeft}px` }}>
                                <span className="text-sm font-bold tracking-tight uppercase text-primary">
                                    {getValue()}
                                </span>
                            </div>
                        )
                    }

                    return (
                        <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: `${paddingLeft}px` }}>
                            {hasChildren ? (
                                <Button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); row.getToggleExpandedHandler()(); }}
                                    className="p-1 bg-transparent text-muted-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
                                >
                                    {row.getIsExpanded() ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            ) : (
                                <div className="w-6 flex-shrink-0" />
                            )}
                            
                            <div className="flex items-baseline gap-2 min-w-0">
                                {node.code && (
                                    <span className="font-mono text-2xs text-muted-foreground/60 leading-none">
                                        {node.code}
                                    </span>
                                )}
                                <span className={cn(
                                    "text-sm tracking-tight truncate", 
                                    level === 0 ? "uppercase font-semibold text-foreground/90" : "font-medium text-foreground/80",
                                    drillable && !disableDrillDown && "group-hover/row:text-primary group-hover/row:underline decoration-dotted underline-offset-2 cursor-pointer transition-colors"
                                )}>
                                    {getValue()}
                                </span>
                            </div>
                        </div>
                    );
                },
            }) as ReportTableColumn,
            columnHelper.accessor('balance', {
                header: () => <div className="text-right">{periodLabel || 'Saldo'}</div>,
                cell: ({ row, getValue }) => {
                    const val = getValue();
                    const level = row.depth;
                    const isTotal = row.original.isTotalRow;
                    return (
                        <div className={cn("text-right font-mono", isTotal ? "text-base font-bold text-primary" : level === 0 ? "text-sm font-semibold text-foreground/90" : "text-sm text-foreground/80")}>
                            <MoneyDisplay amount={val} showColor={false} />
                        </div>
                    );
                },
            }) as ReportTableColumn,
            ...(showComparison
                ? [
                    columnHelper.accessor('comp_balance', {
                        header: () => <div className="text-right text-muted-foreground/70">{compPeriodLabel || 'Anterior'}</div>,
                        cell: ({ getValue }) => (
                            <div className="text-right font-mono text-xs text-muted-foreground font-medium">
                                <MoneyDisplay amount={getValue() || 0} showColor={false} />
                            </div>
                        ),
                    }) as ReportTableColumn,
                    columnHelper.accessor('variance', {
                        header: () => <div className="text-right">Var.</div>,
                        cell: ({ row }) => {
                            const node = row.original;
                            const bal = node.balance || 0;
                            const comp = node.comp_balance || 0;
                            const variance = bal - comp;
                            
                            if (comp === 0 && bal === 0) return null;
                            
                            const pct = comp !== 0 ? ((variance / Math.abs(comp)) * 100).toFixed(1) : null;
                            
                            const rowDir = node.varianceDirection || varianceDirection;
                            const isPositiveGood = rowDir === 'higher-is-better';
                            
                            return (
                                <div className="flex flex-col items-end justify-center py-1">
                                    <div className="flex items-center gap-1.5">
                                        {variance !== 0 && (
                                            variance > 0 ? (
                                                <TrendingUp className={cn("h-3 w-3", isPositiveGood ? "text-success" : "text-destructive")} />
                                            ) : (
                                                <TrendingDown className={cn("h-3 w-3", isPositiveGood ? "text-destructive" : "text-success")} />
                                            )
                                        )}
                                        <MoneyDisplay 
                                            amount={variance} 
                                            className={cn(
                                                "font-mono text-xs font-bold",
                                                variance > 0 ? (isPositiveGood ? "text-success" : "text-destructive") 
                                                    : variance < 0 ? (isPositiveGood ? "text-destructive" : "text-success") : "text-muted-foreground"
                                            )} 
                                        />
                                    </div>
                                    {pct && (
                                        <span className="text-3xs text-muted-foreground/70 font-semibold mt-0.5 inline-block bg-muted/50 px-1.5 py-0.5 rounded-sm">
                                            {pct}%
                                        </span>
                                    )}
                                </div>
                            )
                        }
                    }) as ReportTableColumn,
                ]
                : []),
        ];

        return cols;
    }, [showComparison, periodLabel, compPeriodLabel, varianceDirection]);

    const table = useReactTable({
        data: displayData,
        columns,
        state: {
            expanded,
        },
        onExpandedChange: setExpanded,
        getSubRows: row => row.children,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
    });

    if (!isLoading && (!displayData || displayData.length === 0)) {
        return (
            <div className="p-12 border rounded-2xl bg-card shadow-sm">
                <EmptyState 
                    context="finance" 
                    title="Sin datos en este periodo"
                    description="No se encontraron movimientos contables registrados para los filtros seleccionados." 
                />
            </div>
        );
    }

    return (
        <>
            <SkeletonShell isLoading={!!isLoading} ariaLabel="Cargando reporte contable">
                <div className="mb-8 rounded-t-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full caption-bottom text-sm border-collapse">
                            <thead className="bg-background">
                                {table.getHeaderGroups().map(headerGroup => (
                                    <tr key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <th 
                                                key={header.id} 
                                                className="h-10 px-3 text-left align-middle font-semibold text-2xs uppercase tracking-widest text-muted-foreground/80 whitespace-nowrap"
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {table.getRowModel().rows.map(row => {
                                    const isRoot = row.depth === 0;
                                    const isTotal = row.original.isTotalRow;
                                    const drillable = isDrillable(row.original);
                                    
                                    return (
                                        <tr 
                                            key={row.id} 
                                            onClick={() => handleRowClick(row.original)}
                                            className={cn(
                                                "transition-colors group/row",
                                                drillable ? "cursor-pointer" : "cursor-default",
                                                !isTotal && "hover:bg-muted/10",
                                                isTotal ? "bg-primary/5 hover:bg-primary/10 shadow-[inset_0_1px_0_oklch(var(--foreground-raw)/0.12)]" : "",
                                                isRoot && !isTotal ? "bg-muted/5" : ""
                                            )}
                                        >
                                            {row.getVisibleCells().map(cell => (
                                                <td key={cell.id} className="px-3 py-1.5 align-middle">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </SkeletonShell>

            {drillDown && (
                <LedgerDrawer
                    accountId={drillDown.accountId}
                    accountName={drillDown.accountName}
                    accountCode={drillDown.accountCode}
                    noTrigger
                    open={true}
                    onOpenChange={(open) => { if (!open) setDrillDown(null); }}
                />
            )}
        </>
    );
};
