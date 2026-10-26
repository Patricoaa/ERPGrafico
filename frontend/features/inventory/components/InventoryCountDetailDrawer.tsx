"use client"

import { useState, useMemo, useCallback } from "react"
import { StatusBadge, UnifiedSearchBar, useUnifiedSearch, Drawer, FadeIn, SkeletonShell, SubmitButton } from "@/components/shared"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { inventoryCountLineEntity, inventoryCountLineViews, type AugmentedCountLine } from "../entity-view/inventoryCountLine.entity"
import { ClipboardCheck, Check, Equal } from "lucide-react"
import { useInventoryCount, useInventoryCountMutations } from "../hooks/useInventoryCounts"
import { inventoryCountLineSearchDef } from "@/features/inventory/unifiedSearchDef"
import type { InventoryCountLine } from "../types"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"

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

    const augmentedLines = useMemo<AugmentedCountLine[]>(
        () =>
            (count?.lines ?? []).map((line: InventoryCountLine) => ({
                ...line,
                _isInProgress: isInProgress ?? false,
                _onCommit: handleCellCommit,
                _diff: getDifference(line),
            })),
        [count?.lines, isInProgress, handleCellCommit, getDifference],
    )

    const filteredAugmentedLines = useMemo(
        () => lineSearch.filterFn(augmentedLines),
        [lineSearch, augmentedLines],
    )

    const lineCollection = useEntityCollection(
        inventoryCountLineEntity,
        { rows: filteredAugmentedLines },
        { pagination: { mode: "none" } },
    )

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
                <FadeIn className="p-4 space-y-3" duration={0.5}>
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
                    <Collection.Root
                        collection={lineCollection}
                        label="Líneas de conteo"
                    >
                        <Collection.View
                            table={inventoryCountLineViews.table}
                            emptyTitle="Sin productos"
                            emptyDescription="Este conteo no tiene productos registrados."
                            onResetFilters={lineSearch.isFiltered ? lineSearch.clearAll : undefined}
                        />
                    </Collection.Root>
                </FadeIn>
            ) : null}
        </Drawer>
    )
}
