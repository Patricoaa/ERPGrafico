"use client"

import { useState, useMemo, useCallback } from "react"
import { DataTableView, DataCell, StatusBadge, UnifiedSearchBar, useUnifiedSearch, Drawer, SkeletonShell, QuantityDisplay, DataTableColumnHeader, SubmitButton } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClipboardCheck, Check, Equal } from "lucide-react"
import { type ColumnDef } from "@tanstack/react-table"
import { useInventoryCount, useInventoryCountMutations } from "../hooks/useInventoryCounts"
import { inventoryCountLineSearchDef } from "@/features/inventory/unifiedSearchDef"
import type { InventoryCountLine } from "../types"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { cn } from "@/lib/utils"

function EditableQtyCell({
    line,
    isInProgress,
    onCommit,
}: {
    line: InventoryCountLine
    isInProgress: boolean
    onCommit: (lineId: number, value: number | null) => void
}) {
    const [localValue, setLocalValue] = useState<string>(
        line.counted_qty != null ? String(line.counted_qty) : ''
    )

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value)
    }, [])

    const handleBlur = useCallback(() => {
        if (localValue === '' || localValue === '-') {
            onCommit(line.id, null)
            return
        }
        const num = parseFloat(localValue)
        if (!isNaN(num)) {
            setLocalValue(String(num))
            onCommit(line.id, num)
        }
    }, [localValue, line.id, onCommit])

    const handleEquals = useCallback(() => {
        setLocalValue(String(line.theoretical_qty))
        onCommit(line.id, line.theoretical_qty)
    }, [line.id, line.theoretical_qty, onCommit])

    const numericValue = localValue === '' || localValue === '-' ? null : parseFloat(localValue)
    const hasDifference = numericValue !== null && numericValue !== line.theoretical_qty

    return (
        <div className="flex justify-center gap-1">
            <Input
                type="text"
                inputMode="decimal"
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="--"
                className={cn(
                    "w-24 h-8 text-center text-sm font-mono",
                    hasDifference && "border-warning bg-warning/10"
                )}
                disabled={!isInProgress}
            />
            {isInProgress && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={handleEquals}
                    title="Igualar a stock teórico"
                >
                    <Equal className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
            )}
        </div>
    )
}

interface InventoryCountDetailDrawerProps {
    countId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Called after a successful "aplicar conteo" so the parent list refetches. */
    onApplied: () => void
}

/**
 * Detail drawer of an inventory count: editable "stock real" per line. Legacy system (Oleada E,
 * not yet migrated — the cell-level editing needs EditableCollection, not just a read-only list).
 */
export function InventoryCountDetailDrawer({ countId, open, onOpenChange, onApplied }: InventoryCountDetailDrawerProps) {
    const lineSearch = useUnifiedSearch(inventoryCountLineSearchDef)
    const { data: selectedCount, isLoading: isLoadingCount } = useInventoryCount(countId)
    const { saveLines, applyCount, isSaving, isApplying } = useInventoryCountMutations()

    // Remounted with a fresh `key` by the parent whenever `countId` changes (see
    // InventoryCountClientView), so a newly selected count always starts with clean edits.
    const [editedLines, setEditedLines] = useState<Map<number, number>>(new Map())

    const handleCellCommit = useCallback((lineId: number, value: number | null) => {
        setEditedLines(prev => {
            const next = new Map(prev)
            if (value === null) {
                next.delete(lineId)
            } else {
                next.set(lineId, value)
            }
            return next
        })
    }, [])

    const handleSetAllToTheoretical = useCallback(() => {
        if (!selectedCount) return
        const next = new Map<number, number>()
        for (const line of selectedCount.lines) {
            next.set(line.id, line.theoretical_qty)
        }
        setEditedLines(next)
        toast.success("Todas las cantidades ajustadas al stock teórico")
    }, [selectedCount])

    const handleSaveAll = useCallback(async () => {
        if (!countId || editedLines.size === 0) return

        const lines = Array.from(editedLines.entries()).map(([line_id, counted_qty]) => ({
            line_id,
            counted_qty,
        }))

        try {
            await saveLines({ id: countId, lines })
            setEditedLines(new Map())
            toast.success("Cantidades guardadas correctamente")
        } catch (error) {
            showApiError(error, "Error al guardar las cantidades")
        }
    }, [countId, editedLines, saveLines])

    const handleApply = useCallback(async () => {
        if (!countId) return

        if (editedLines.size > 0) {
            const lines = Array.from(editedLines.entries()).map(([line_id, counted_qty]) => ({
                line_id,
                counted_qty,
            }))
            try {
                await saveLines({ id: countId, lines })
            } catch (error) {
                showApiError(error, "Error al guardar las cantidades antes de aplicar")
                return
            }
        }

        try {
            const result = await applyCount(countId)
            if (result.document_id) {
                toast.success(`Conteo aplicado. Documento de ajuste #${result.document_id} generado.`)
            } else {
                toast.success("Conteo aplicado. No se encontraron diferencias.")
            }
            setEditedLines(new Map())
            onApplied()
        } catch (error) {
            showApiError(error, "Error al aplicar el conteo")
        }
    }, [countId, editedLines, saveLines, applyCount, onApplied])

    const getCountedQty = useCallback((line: InventoryCountLine): number | null => {
        if (editedLines.has(line.id)) {
            return editedLines.get(line.id) ?? null
        }
        return line.counted_qty
    }, [editedLines])

    const getDifference = useCallback((line: InventoryCountLine): number | null => {
        const counted = getCountedQty(line)
        if (counted === null) return null
        return counted - line.theoretical_qty
    }, [getCountedQty])

    const linesWithChanges = useMemo(() => {
        if (!selectedCount) return 0
        return selectedCount.lines.filter((line: InventoryCountLine) => {
            const counted = getCountedQty(line)
            if (counted === null) return false
            return counted !== line.theoretical_qty
        }).length
    }, [selectedCount, getCountedQty])

    const isDrawerLoading = open && isLoadingCount
    const count = selectedCount
    const isInProgress = count?.status === 'IN_PROGRESS'

    const lineColumns = useMemo<ColumnDef<InventoryCountLine>[]>(() => [
        {
            accessorKey: "product_code",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código" className="justify-center" />,
            cell: ({ row }) => <DataCell.Code>{row.original.product_code}</DataCell.Code>,
            size: 100,
        },
        {
            accessorKey: "product_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <DataCell.Text>{row.original.product_name}</DataCell.Text>
                    {row.original.product_internal_code && (
                        <span className="text-3xs text-muted-foreground font-mono">{row.original.product_internal_code}</span>
                    )}
                </div>
            ),
            size: 250,
        },
        {
            accessorKey: "theoretical_qty",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Stock Teórico" className="justify-center" />,
            cell: ({ row }) => (
                <div className="text-center">
                    <QuantityDisplay value={row.original.theoretical_qty} />
                </div>
            ),
            size: 120,
        },
        {
            id: "counted_qty",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Stock Real" className="justify-center" />,
            cell: ({ row }) => (
                <EditableQtyCell
                    line={row.original}
                    isInProgress={isInProgress ?? false}
                    onCommit={handleCellCommit}
                />
            ),
            size: 170,
        },
        {
            id: "difference",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Diferencia" className="justify-center" />,
            cell: ({ row }) => {
                const diff = getDifference(row.original)
                if (diff === null) return <span className="text-muted-foreground text-center block">--</span>
                return (
                    <div className={cn(
                        "text-center font-medium text-sm",
                        diff > 0 && "text-success",
                        diff < 0 && "text-destructive",
                        diff === 0 && "text-muted-foreground"
                    )}>
                        <QuantityDisplay value={diff} showSign />
                    </div>
                )
            },
            size: 110,
        },
        {
            accessorKey: "uom_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Unidad" className="justify-center" />,
            cell: ({ row }) => (
                <div className="text-center text-sm text-muted-foreground">{row.original.uom_name}</div>
            ),
            size: 80,
        },
    ], [isInProgress, handleCellCommit, getDifference])

    const drawerSubtitle = count ? (
        <span className="text-sm text-muted-foreground">
            {count.total_products} productos · {count.counted_products} contados
            {linesWithChanges > 0 && (
                <span className="ml-1 text-warning">({linesWithChanges} sin guardar)</span>
            )}
        </span>
    ) : undefined

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="bottom"
            boundary="embedded"
            defaultSize="100%"
            title={count ? `Conteo #${count.id}` : "Conteo"}
            subtitle={drawerSubtitle}
            icon="clipboard-check"
            headerActions={
                count ? (
                    <div className="flex items-center gap-2">
                        <StatusBadge status={count.status} variant="badge" />
                        {isInProgress && (
                            <>
                                <SubmitButton
                                    variant="outline"
                                    onClick={handleSetAllToTheoretical}
                                    className="text-muted-foreground"
                                    icon={<Equal className="h-4 w-4" />}
                                >
                                    Igual a Stock Teórico
                                </SubmitButton>
                                <SubmitButton
                                    onClick={handleSaveAll}
                                    disabled={editedLines.size === 0}
                                    loading={isSaving}
                                    className="bg-success hover:bg-success/90 text-success-foreground"
                                    icon={<Check className="h-4 w-4" />}
                                >
                                    Guardar ({editedLines.size})
                                </SubmitButton>
                                <SubmitButton
                                    onClick={handleApply}
                                    loading={isApplying}
                                    icon={<ClipboardCheck className="h-4 w-4" />}
                                >
                                    Aplicar Conteo
                                </SubmitButton>
                            </>
                        )}
                    </div>
                ) : undefined
            }
        >
            {isDrawerLoading ? (
                <div className="p-4">
                    <SkeletonShell isLoading ariaLabel="Cargando conteo" />
                </div>
            ) : count ? (
                <div className="p-4 animate-in fade-in duration-500">
                    <DataTableView
                        entityLabel="inventory.inventorycount"
                        columns={lineColumns}
                        data={lineSearch.filterFn(count.lines)}
                        isLoading={false}
                        variant="embedded"
                        hidePagination
                        noBorder
                        columnToggle={false}
                        unifiedSearch={
                            <UnifiedSearchBar
                                config={inventoryCountLineSearchDef}
                                chips={lineSearch.chips}
                                isFiltered={lineSearch.isFiltered}
                                inputValue={lineSearch.inputValue}
                                onInputChange={lineSearch.setInputValue}
                                onApply={lineSearch.applyFilter}
                                onRemove={lineSearch.removeFilter}
                                onClearAll={lineSearch.clearAll}
                                groupBy={lineSearch.groupBy}
                                onGroupBySelect={lineSearch.setGroupBy}
                                paramValues={lineSearch.paramValues}
                                placeholder="Buscar producto, código o SKU..."
                            />
                        }
                        showReset={lineSearch.isFiltered}
                        onReset={lineSearch.clearAll}
                        emptyState={{
                            context: "inventory",
                            title: "Sin productos",
                            description: "Este conteo no tiene productos registrados.",
                        }}
                    />
                </div>
            ) : null}
        </Drawer>
    )
}
