"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button"
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
import { EmptyState, SkeletonShell } from '@/components/shared';

export interface BaseTreeNode {
    id: number | string;
    code: string;
    name: string;
    children?: BaseTreeNode[];
}

export interface TreeReportColumn<TNode extends BaseTreeNode> {
    header: string;
    headerClassName?: string;
    render: (node: TNode, level: number) => React.ReactNode;
    cellClassName?: string;
    groupBg?: string;
}

export type AccentColor = 'primary' | 'success' | 'info' | 'destructive' | 'income' | 'expense' | 'asset' | 'liability';

export interface TreeReportTableProps<TNode extends BaseTreeNode> {
    data: TNode[] | null;

    defaultExpanded?: boolean | ((level: number) => boolean);
    indentation?: number;
    leafSpacer?: React.ReactNode;

    columns: TreeReportColumn<TNode>[];
    renderNameContent?: (node: TNode, level: number) => React.ReactNode;
    nameColumnClassName?: string;
    nameHeaderClassName?: string;
    nameHeaderText?: string;

    title?: string;
    totalRow?: {
        label: string;
        colSpan?: number;
        renderCells: (isLoading: boolean) => React.ReactNode;
    };
    accentColor?: AccentColor;
    mode?: 'tree' | 'flat';

    embedded?: boolean;
    isLoading?: boolean;
    skeletonRows?: number;
    ariaLabel?: string;
    rowClassName?: (node: TNode, level: number) => string;
}

const accentBorderColor: Record<AccentColor, string> = {
    primary: "border-primary/20",
    success: "border-success/20",
    info: "border-info/20",
    destructive: "border-destructive/20",
    income: "border-income/20",
    expense: "border-expense/20",
    asset: "border-asset/20",
    liability: "border-liability/20",
};

const accentBgColor: Record<AccentColor, string> = {
    primary: "bg-primary/5 border-primary/20",
    success: "bg-success/5 border-success/20",
    info: "bg-info/5 border-info/20",
    destructive: "bg-destructive/5 border-destructive/20",
    income: "bg-income/5 border-income/20",
    expense: "bg-expense/5 border-expense/20",
    asset: "bg-asset/5 border-asset/20",
    liability: "bg-liability/5 border-liability/20",
};

function TreeRow<TNode extends BaseTreeNode>({
    node,
    level,
    mode,
    indentation,
    defaultExpanded,
    leafSpacer,
    columns,
    renderNameContent,
    nameColumnClassName,
    rowClassName,
}: {
    node: TNode;
    level: number;
    mode: 'tree' | 'flat';
    indentation: number;
    defaultExpanded: boolean | ((level: number) => boolean);
    leafSpacer: React.ReactNode;
    columns: TreeReportColumn<TNode>[];
    renderNameContent?: (node: TNode, level: number) => React.ReactNode;
    nameColumnClassName?: string;
    rowClassName?: (node: TNode, level: number) => string;
}) {
    const initialExpanded = typeof defaultExpanded === 'function'
        ? defaultExpanded(level)
        : defaultExpanded;
    const [expanded, setExpanded] = useState(initialExpanded);
    const hasChildren = mode === 'tree' && node.children && node.children.length > 0;
    const paddingLeft = level * indentation + 10;

    return (
        <>
            <TableRow className={cn(
                "table-row-hover border-l-2",
                level === 0 ? "font-black border-l-primary/40 bg-muted/5 h-12" : "border-l-transparent",
                rowClassName?.(node, level)
            )}>
                <TableCell className={cn("py-2.5 px-4", nameColumnClassName)}>
                    <div className="flex items-center gap-2" style={{ paddingLeft: `${paddingLeft}px` }}>
                        {(hasChildren || mode === 'flat') && (
                            <Button
                                variant="ghost"
                                onClick={() => mode === 'tree' && setExpanded(!expanded)}
                                className={cn(
                                    "flex-shrink-0 h-auto w-auto p-0 border-none bg-transparent hover:bg-transparent shadow-none",
                                    !hasChildren && mode === 'flat' && "cursor-default opacity-50"
                                )}
                                disabled={!hasChildren}
                            >
                                {hasChildren ? (
                                    expanded
                                        ? <ChevronDown className="h-4 w-4 text-primary" />
                                        : <ChevronRight className="h-4 w-4 text-primary" />
                                ) : (
                                    leafSpacer
                                )}
                            </Button>
                        )}
                        {!hasChildren && mode === 'tree' && (
                            <div className="w-6 mr-1 flex justify-center">
                                {leafSpacer}
                            </div>
                        )}
                        {renderNameContent ? (
                            renderNameContent(node, level)
                        ) : (
                            <div className="flex flex-col min-w-0">
                                {node.code && (
                                    <span className="font-mono text-[10px] text-muted-foreground opacity-70 leading-none mb-0.5">
                                        {node.code}
                                    </span>
                                )}
                                <span className={cn(
                                    "text-sm tracking-tight truncate",
                                    level === 0 ? "uppercase font-black" : "font-medium"
                                )}>
                                    {node.name}
                                </span>
                            </div>
                        )}
                    </div>
                </TableCell>
                {columns.map((col) => (
                    <TableCell key={col.header} className={cn("text-right py-2.5 px-4", col.cellClassName, col.groupBg)}>
                        {col.render(node, level)}
                    </TableCell>
                ))}
            </TableRow>
            {hasChildren && expanded && node.children?.map((child) => (
                <TreeRow
                    key={child.id}
                    node={child as TNode}
                    level={level + 1}
                    mode={mode}
                    indentation={indentation}
                    defaultExpanded={defaultExpanded}
                    leafSpacer={leafSpacer}
                    columns={columns}
                    renderNameContent={renderNameContent}
                    nameColumnClassName={nameColumnClassName}
                    rowClassName={rowClassName}
                />
            ))}
        </>
    );
}

export function TreeReportTable<TNode extends BaseTreeNode>({
    data,
    defaultExpanded = true,
    indentation = 16,
    leafSpacer = <div className="w-1 h-1 rounded-full bg-muted-foreground/30 flex-shrink-0" />,
    columns,
    renderNameContent,
    nameColumnClassName,
    nameHeaderClassName,
    nameHeaderText = "Cuenta / Concepto",
    title,
    totalRow,
    accentColor = 'primary',
    mode = 'tree',
    embedded = false,
    isLoading = false,
    skeletonRows = 6,
    ariaLabel = "Cargando reporte",
    rowClassName,
}: TreeReportTableProps<TNode>) {
    const skeletonData = React.useMemo(() =>
        Array.from({ length: skeletonRows }, (_, i) => ({
            id: `sk-${i}`,
            code: "00.00.00",
            name: "————————————————————————————",
        } as unknown as TNode)),
        [skeletonRows]
    );

    const displayData = isLoading ? skeletonData : data;

    if (!isLoading && (!displayData || displayData.length === 0)) {
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
                <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                    <TableRow className={cn("border-b-2", accentBorderColor[accentColor])}>
                        <TableHead className={cn(
                            "font-black text-foreground py-4 px-4 h-12 uppercase tracking-widest text-[10px]",
                            nameHeaderClassName
                        )}>
                            {nameHeaderText}
                        </TableHead>
                        {columns.map((col) => (
                            <TableHead
                                key={col.header}
                                className={cn(
                                    "text-right font-black py-4 px-4 h-12 uppercase tracking-widest text-[10px]",
                                    col.headerClassName,
                                    col.groupBg
                                )}
                            >
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {displayData?.map((node) => (
                        <TreeRow
                            key={node.id}
                            node={node}
                            level={0}
                            mode={mode}
                            indentation={indentation}
                            defaultExpanded={defaultExpanded}
                            leafSpacer={leafSpacer}
                            columns={columns}
                            renderNameContent={renderNameContent}
                            nameColumnClassName={nameColumnClassName}
                            rowClassName={rowClassName}
                        />
                    ))}
                    {totalRow && (
                        <TableRow className={cn(
                            "font-black border-t-2 shadow-card sticky bottom-0 z-10",
                            accentBgColor[accentColor]
                        )}>
                            <TableCell className="p-5 text-foreground uppercase tracking-tighter text-sm font-black italic">
                                {isLoading ? "————————————————" : totalRow.label}
                            </TableCell>
                            {totalRow.renderCells(isLoading)}
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );

    const container = embedded ? (
        tableContent
    ) : (
        <div className="rounded-none border bg-card shadow-card overflow-hidden">
            {title && (
                <div className="p-4 border-b bg-muted/30 flex justify-between items-center h-12">
                    <h3 className="font-bold uppercase tracking-widest text-xs text-muted-foreground animate-in slide-in-from-left-2">{title}</h3>
                </div>
            )}
            {tableContent}
        </div>
    );

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel={ariaLabel}>
            {container}
        </SkeletonShell>
    );
}
