"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTableView, DataCell, EntityCard, StatusBadge, UnifiedSearchBar, useUnifiedSearch, LabeledSelect, LabeledInput } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Plus, ClipboardCheck, Check, Loader2 } from "lucide-react"
import { type ColumnDef } from "@tanstack/react-table"
import { useInventoryCounts, useInventoryCount, useInventoryCountMutations } from "../hooks/useInventoryCounts"
import { useWarehouses } from "../hooks/useWarehouses"
import { inventoryCountUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import type { InventoryCount, InventoryCountLine } from "../types"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface NewCountFormValues {
    warehouse: number
    notes?: string
}

export function InventoryCountClientView() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    const selectedCountId = searchParams.get('selected')
    const [showNewDialog, setShowNewDialog] = useState(false)
    const search = useUnifiedSearch(inventoryCountUnifiedSearchDef)

    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, counts, totalCount, isLoading: isLoadingCounts, refetch: refetchCounts } = useInventoryCounts({
        ...search.filters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })

    const { data: selectedCount, isLoading: isLoadingCount } = useInventoryCount(
        selectedCountId ? Number(selectedCountId) : null
    )

    const { createCount, saveLines, applyCount, isCreating, isSaving, isApplying } = useInventoryCountMutations()
    const { warehouses } = useWarehouses()

    const [editedLines, setEditedLines] = useState<Map<number, number>>(new Map())

    const handleSelectCount = useCallback((id: number) => {
        setEditedLines(new Map())
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, pathname, router])

    const handleBack = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, [searchParams, pathname, router])

    const handleCellEdit = useCallback((lineId: number, value: string) => {
        setEditedLines(prev => {
            const next = new Map(prev)
            if (value === '' || value === '-') {
                next.delete(lineId)
            } else {
                const num = parseFloat(value)
                if (!isNaN(num)) {
                    next.set(lineId, num)
                }
            }
            return next
        })
    }, [])

    const handleSaveAll = useCallback(async () => {
        if (!selectedCountId || editedLines.size === 0) return

        const lines = Array.from(editedLines.entries()).map(([line_id, counted_qty]) => ({
            line_id,
            counted_qty,
        }))

        try {
            await saveLines({ id: Number(selectedCountId), lines })
            setEditedLines(new Map())
            toast.success("Cantidades guardadas correctamente")
        } catch (error) {
            showApiError(error, "Error al guardar las cantidades")
        }
    }, [selectedCountId, editedLines, saveLines])

    const handleApply = useCallback(async () => {
        if (!selectedCountId) return

        if (editedLines.size > 0) {
            const lines = Array.from(editedLines.entries()).map(([line_id, counted_qty]) => ({
                line_id,
                counted_qty,
            }))
            try {
                await saveLines({ id: Number(selectedCountId), lines })
            } catch (error) {
                showApiError(error, "Error al guardar las cantidades antes de aplicar")
                return
            }
        }

        try {
            const result = await applyCount(Number(selectedCountId))
            if (result.document_id) {
                toast.success(`Conteo aplicado. Documento de ajuste #${result.document_id} generado.`)
            } else {
                toast.success("Conteo aplicado. No se encontraron diferencias.")
            }
            refetchCounts()
        } catch (error) {
            showApiError(error, "Error al aplicar el conteo")
        }
    }, [selectedCountId, editedLines, saveLines, applyCount, refetchCounts])

    const handleCreateCount = useCallback(async (values: NewCountFormValues) => {
        try {
            const result = await createCount({ warehouse: values.warehouse, notes: values.notes })
            setShowNewDialog(false)
            handleSelectCount(result.id)
            toast.success("Sesión de conteo creada")
        } catch (error) {
            showApiError(error, "Error al crear la sesión de conteo")
        }
    }, [createCount, handleSelectCount])

    const getCountedQty = useCallback((line: InventoryCountLine): number | null => {
        if (editedLines.has(line.id)) {
            return editedLines.get(line.id)!
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
    }, [selectedCount, editedLines, getCountedQty])

    // ─── Detail View ──────────────────────────────────────────────────────
    if (selectedCountId && selectedCount) {
        const lineColumns: ColumnDef<InventoryCountLine>[] = [
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
                            <span className="text-[10px] text-muted-foreground font-mono">{row.original.product_internal_code}</span>
                        )}
                    </div>
                ),
                size: 250,
            },
            {
                accessorKey: "theoretical_qty",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Stock Teórico" className="justify-center" />,
                cell: ({ row }) => (
                    <div className="text-center font-mono text-sm">
                        {Number(row.original.theoretical_qty).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                    </div>
                ),
                size: 120,
            },
            {
                id: "counted_qty",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Cantidad Real" className="justify-center" />,
                cell: ({ row }) => {
                    const line = row.original
                    const value = getCountedQty(line)
                    return (
                        <div className="flex justify-center">
                            <Input
                                type="number"
                                value={value ?? ''}
                                onChange={(e) => handleCellEdit(line.id, e.target.value)}
                                placeholder="--"
                                className={cn(
                                    "w-24 h-8 text-center text-sm font-mono",
                                    value !== null && value !== line.theoretical_qty && "border-warning bg-warning/10"
                                )}
                                disabled={selectedCount.status !== 'IN_PROGRESS'}
                            />
                        </div>
                    )
                },
                size: 130,
            },
            {
                id: "difference",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Diferencia" className="justify-center" />,
                cell: ({ row }) => {
                    const diff = getDifference(row.original)
                    if (diff === null) return <span className="text-muted-foreground text-center block">--</span>
                    return (
                        <div className={cn(
                            "text-center font-mono font-medium text-sm",
                            diff > 0 && "text-success",
                            diff < 0 && "text-destructive",
                            diff === 0 && "text-muted-foreground"
                        )}>
                            {diff > 0 ? '+' : ''}{Number(diff).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
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
        ]

        const isInProgress = selectedCount.status === 'IN_PROGRESS'

        return (
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="shrink-0 flex items-center justify-between gap-4 pb-4">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleBack}
                            className="h-8 w-8 p-0"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold">Conteo #{selectedCount.id}</h2>
                                <StatusBadge status={selectedCount.status} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {selectedCount.warehouse_name} · {selectedCount.total_products} productos ·{' '}
                                {selectedCount.counted_products} contados
                                {linesWithChanges > 0 && (
                                    <span className="ml-1 text-warning">({linesWithChanges} con cambios sin guardar)</span>
                                )}
                            </p>
                        </div>
                    </div>

                    {isInProgress && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSaveAll}
                                disabled={editedLines.size === 0 || isSaving}
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                                Guardar ({editedLines.size})
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleApply}
                                disabled={isApplying}
                            >
                                {isApplying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ClipboardCheck className="h-4 w-4 mr-1" />}
                                Aplicar Conteo
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-h-0">
                    <DataTableView
                        entityLabel="inventory.inventorycount"
                        columns={lineColumns}
                        data={selectedCount.lines}
                        isLoading={isLoadingCount}
                        variant="embedded"
                        hidePagination
                        noBorder
                        emptyState={{
                            context: "inventory",
                            title: "Sin productos",
                            description: "Este conteo no tiene productos registrados.",
                        }}
                    />
                </div>
            </div>
        )
    }

    // ─── Loading Detail ───────────────────────────────────────────────────
    if (selectedCountId && isLoadingCount) {
        return (
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="shrink-0 flex items-center gap-3 pb-4">
                    <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <p className="text-sm text-muted-foreground">Cargando conteo...</p>
                </div>
                <div className="flex-1 min-h-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        )
    }

    // ─── List View ────────────────────────────────────────────────────────
    const listColumns: ColumnDef<InventoryCount>[] = [
        {
            accessorKey: "id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => <DataCell.Code>{`#${row.original.id}`}</DataCell.Code>,
            size: 80,
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Almacén" />,
            cell: ({ row }) => <DataCell.Text>{row.original.warehouse_name}</DataCell.Text>,
            size: 180,
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={row.original.status} />
                </div>
            ),
            size: 120,
        },
        {
            id: "progress",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Progreso" className="justify-center" />,
            cell: ({ row }) => (
                <div className="text-center text-sm">
                    <span className="font-medium">{row.original.counted_products}</span>
                    <span className="text-muted-foreground"> / {row.original.total_products}</span>
                </div>
            ),
            size: 100,
        },
        {
            id: "differences",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Diferencias" className="justify-center" />,
            cell: ({ row }) => {
                const diffCount = row.original.products_with_difference
                return (
                    <div className="flex justify-center w-full">
                        {diffCount > 0 ? (
                            <StatusBadge status="WARNING" label={`${diffCount} diferencias`} />
                        ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                        )}
                    </div>
                )
            },
            size: 120,
        },
        {
            accessorKey: "created_by_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Creado por" className="justify-center" />,
            cell: ({ row }) => (
                <div className="text-center text-sm text-muted-foreground">{row.original.created_by_name ?? '-'}</div>
            ),
            size: 150,
        },
    ]

    const createAction = (
        <Button size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Conteo
        </Button>
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.inventorycount"
                    columns={listColumns}
                    data={counts}
                    isLoading={isLoadingCounts}
                    variant="embedded"
                    pageCount={page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={pageState}
                    onPaginationChange={setPageState}
                    unifiedSearch={<UnifiedSearchBar
                        config={inventoryCountUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar conteos..."
                    />}
                    unifiedSearchConfig={inventoryCountUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "No hay conteos de inventario",
                        description: "Crea un nuevo conteo para comparar el stock teórico con el stock real.",
                    }}
                    renderCard={(count: InventoryCount) => (
                        <EntityCard
                            key={count.id}
                            onClick={() => handleSelectCount(count.id)}
                        >
                            <EntityCard.Header
                                title={`Conteo #${count.id}`}
                                subtitle={count.warehouse_name}
                                trailing={<StatusBadge status={count.status} size="sm" />}
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Progreso" value={`${count.counted_products} / ${count.total_products}`} />
                                {count.products_with_difference > 0 && (
                                    <EntityCard.Field
                                        label="Diferencias"
                                        value={<StatusBadge status="WARNING" label={`${count.products_with_difference} diferencias`} size="sm" />}
                                    />
                                )}
                                <EntityCard.Field label="Creado por" value={count.created_by_name ?? '-'} />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                />
            </div>

            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Nuevo Conteo de Inventario</DialogTitle>
                        <DialogDescription>
                            Selecciona el almacén para cargar el stock teórico y comenzar el conteo.
                        </DialogDescription>
                    </DialogHeader>
                    <NewCountForm
                        warehouses={warehouses}
                        onSubmit={handleCreateCount}
                        isSubmitting={isCreating}
                        onCancel={() => setShowNewDialog(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}

function NewCountForm({
    warehouses,
    onSubmit,
    isSubmitting,
    onCancel,
}: {
    warehouses: Array<{ id: number; name: string }>
    onSubmit: (values: NewCountFormValues) => void
    isSubmitting: boolean
    onCancel: () => void
}) {
    const [warehouse, setWarehouse] = useState<string>("")
    const [notes, setNotes] = useState("")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!warehouse) return
        onSubmit({ warehouse: Number(warehouse), notes: notes || undefined })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <LabeledSelect
                label="Almacén"
                value={warehouse}
                onChange={setWarehouse}
                placeholder="Seleccione el almacén"
                required
                options={warehouses.map(w => ({ value: w.id.toString(), label: w.name }))}
            />
            <LabeledInput
                label="Notas (opcional)"
                placeholder="Motivo del conteo"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
            />
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || !warehouse}>
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Crear Conteo
                </Button>
            </DialogFooter>
        </form>
    )
}
