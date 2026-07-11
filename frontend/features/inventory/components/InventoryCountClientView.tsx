"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { DataTableView, DataCell, EntityCard, StatusBadge, UnifiedSearchBar, useUnifiedSearch, LabeledSelect, LabeledInput, Drawer, SkeletonShell, QuantityDisplay } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Plus, ClipboardCheck, Check, Equal } from "lucide-react"
import { type ColumnDef } from "@tanstack/react-table"
import { useInventoryCounts, useInventoryCount, useInventoryCountMutations } from "../hooks/useInventoryCounts"
import { useWarehouses } from "../hooks/useWarehouses"
import { inventoryCountUnifiedSearchDef, inventoryCountLineSearchDef } from "@/features/inventory/unifiedSearchDef"
import type { InventoryCount, InventoryCountLine } from "../types"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { SubmitButton, ActionSlideButton } from "@/components/shared"
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

const newCountSchema = z.object({
    warehouse: z.number().min(1, "Selecciona un almacén"),
    notes: z.string().optional(),
})
type NewCountFormData = z.infer<typeof newCountSchema>

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

export function InventoryCountClientView() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    const selectedCountId = searchParams.get('selected')
    const [showNewDialog, setShowNewDialog] = useState(false)
    const search = useUnifiedSearch(inventoryCountUnifiedSearchDef)
    const lineSearch = useUnifiedSearch(inventoryCountLineSearchDef)

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

    const handleCloseDrawer = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, [searchParams, pathname, router])

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
            setEditedLines(new Map())
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

    const drawerIsOpen = !!selectedCountId
    const isDrawerLoading = drawerIsOpen && isLoadingCount
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
        {
            id: "actions",
            header: () => null,
            cell: () => (
                <div className="flex justify-center w-full">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
            ),
            size: 50,
        },
    ]

    const createAction = (
        <Button size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Conteo
        </Button>
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
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
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
                    onRowClick={(row) => handleSelectCount(row.id)}
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
                    renderCard={(cnt: InventoryCount) => (
                        <EntityCard
                            key={cnt.id}
                            onClick={() => handleSelectCount(cnt.id)}
                        >
                            <EntityCard.Header
                                title={`Conteo #${cnt.id}`}
                                subtitle={cnt.warehouse_name}
                                trailing={<StatusBadge status={cnt.status} size="sm" />}
                            />
                            <EntityCard.Body>
                                <EntityCard.Field label="Progreso" value={`${cnt.counted_products} / ${cnt.total_products}`} />
                                {cnt.products_with_difference > 0 && (
                                    <EntityCard.Field
                                        label="Diferencias"
                                        value={<StatusBadge status="WARNING" label={`${cnt.products_with_difference} diferencias`} size="sm" />}
                                    />
                                )}
                                <EntityCard.Field label="Creado por" value={cnt.created_by_name ?? '-'} />
                            </EntityCard.Body>
                        </EntityCard>
                    )}
                />

            {/* Detail Drawer */}
            <Drawer
                open={drawerIsOpen}
                onOpenChange={(open) => { if (!open) handleCloseDrawer() }}
                side="bottom"
                boundary="embedded"
                defaultSize="80vh"
                title={count ? `Conteo #${count.id}` : "Conteo"}
                subtitle={drawerSubtitle}
                icon="clipboard-check"
                headerActions={
                    count ? (
                        <div className="flex items-center gap-2">
                            <StatusBadge status={count.status} />
                            {isInProgress && (
                                <>
                                    <ActionSlideButton
                                        variant="muted"
                                        size="sm"
                                        onClick={handleSetAllToTheoretical}
                                        icon={<Equal className="h-4 w-4" />}
                                    >
                                        Igual a Stock Teórico
                                    </ActionSlideButton>
                                    <ActionSlideButton
                                        variant="success"
                                        size="sm"
                                        onClick={handleSaveAll}
                                        disabled={editedLines.size === 0}
                                        loading={isSaving}
                                        icon={<Check className="h-4 w-4" />}
                                    >
                                        Guardar ({editedLines.size})
                                    </ActionSlideButton>
                                    <ActionSlideButton
                                        variant="primary"
                                        size="sm"
                                        onClick={handleApply}
                                        loading={isApplying}
                                        icon={<ClipboardCheck className="h-4 w-4" />}
                                    >
                                        Aplicar Conteo
                                    </ActionSlideButton>
                                </>
                            )}
                        </div>
                    ) : undefined
                }
            >
                {isDrawerLoading ? (
                    <SkeletonShell isLoading ariaLabel="Cargando conteo" />
                ) : count ? (
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                        <div className="shrink-0 px-4 pb-1">
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
                        </div>
                        <div className="flex-1 min-h-0">
                            <DataTableView
                                entityLabel="inventory.inventorycount"
                                columns={lineColumns}
                                data={lineSearch.filterFn(count.lines)}
                                isLoading={false}
                                variant="embedded"
                                hidePagination
                                noBorder
                                columnToggle={false}
                                showReset={lineSearch.isFiltered}
                                onReset={lineSearch.clearAll}
                                emptyState={{
                                    context: "inventory",
                                    title: "Sin productos",
                                    description: "Este conteo no tiene productos registrados.",
                                }}
                            />
                        </div>
                    </div>
                ) : null}
            </Drawer>

            {/* New Count Dialog */}
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogContent
                    className="sm:max-w-[400px]"
                    onPointerDownOutside={(e) => {
                        const target = e.target as HTMLElement
                        if (target.closest('[data-slot="select-content"]') ||
                            target.closest('[role="listbox"]') ||
                            target.closest('[data-radix-popper-content-wrapper]')) {
                            e.preventDefault()
                        }
                    }}
                >
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
    const form = useForm<NewCountFormData>({
        resolver: zodResolver(newCountSchema),
        defaultValues: { warehouse: 0, notes: "" },
    })

    return (
        <form id="new-count-form" onSubmit={form.handleSubmit((data) => onSubmit({ warehouse: data.warehouse, notes: data.notes || undefined }))} className="space-y-4">
            <LabeledSelect
                label="Almacén"
                value={form.watch("warehouse")?.toString() ?? ""}
                onChange={(v) => form.setValue("warehouse", Number(v), { shouldValidate: true })}
                placeholder="Seleccione el almacén"
                options={warehouses.map(w => ({ value: w.id.toString(), label: w.name }))}
            />
            {form.formState.errors.warehouse && (
                <p className="text-xs text-destructive">{form.formState.errors.warehouse.message}</p>
            )}
            <LabeledInput
                label="Notas (opcional)"
                placeholder="Motivo del conteo"
                {...form.register("notes")}
            />
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancelar
                </Button>
                <SubmitButton type="submit" form="new-count-form" loading={isSubmitting}>
                    Crear Conteo
                </SubmitButton>
            </DialogFooter>
        </form>
    )
}
