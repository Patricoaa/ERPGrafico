"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Chip, DataTable } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell } from '@/components/shared'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Plus, ClipboardCheck, Check, Loader2 } from "lucide-react"
import { type ColumnDef } from "@tanstack/react-table"
import { useInventoryCounts, useInventoryCount, useInventoryCountMutations } from "../hooks/useInventoryCounts"
import { useWarehouses } from "../hooks/useWarehouses"
import { InventoryCountLine } from "../types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { LabeledInput } from "@/components/shared"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"

const STATUS_MAP: Record<string, { intent: "neutral" | "success" | "destructive" | "warning", label: string }> = {
    'DRAFT': { intent: 'neutral', label: 'Borrador' },
    'IN_PROGRESS': { intent: 'warning', label: 'En Progreso' },
    'APPLIED': { intent: 'success', label: 'Aplicado' },
    'CANCELLED': { intent: 'destructive', label: 'Cancelado' },
}

const newCountSchema = z.object({
    warehouse: z.coerce.number().min(1, "El almacen es requerido"),
    notes: z.string().optional(),
})

type NewCountFormValues = z.infer<typeof newCountSchema>

export function InventoryCountClientView() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    const selectedCountId = searchParams.get('selected')
    const [showNewDialog, setShowNewDialog] = useState(false)

    const { counts, totalCount, isLoading: isLoadingCounts, refetch: refetchCounts } = useInventoryCounts({
        page_size: 100,
    })

    const { count: selectedCount, isLoading: isLoadingCount } = useInventoryCount(
        selectedCountId ? Number(selectedCountId) : null
    )

    const { createCount, saveLines, applyCount, isCreating, isSaving, isApplying } = useInventoryCountMutations()
    const { warehouses } = useWarehouses({ page_size: 100 })

    const [editedLines, setEditedLines] = useState<Map<number, number>>(new Map())

    useEffect(() => {
        setEditedLines(new Map())
    }, [selectedCountId])

    const handleSelectCount = (id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleBack = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

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
        } catch {
            toast.error("Error al guardar las cantidades")
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
            } catch {
                toast.error("Error al guardar las cantidades antes de aplicar")
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
        } catch {
            toast.error("Error al aplicar el conteo")
        }
    }, [selectedCountId, editedLines, saveLines, applyCount, refetchCounts])

    const handleCreateCount = useCallback(async (values: NewCountFormValues) => {
        try {
            const result = await createCount({ warehouse: values.warehouse, notes: values.notes })
            setShowNewDialog(false)
            handleSelectCount(result.id)
            toast.success("Sesion de conteo creada")
        } catch {
            toast.error("Error al crear la sesion de conteo")
        }
    }, [createCount])

    const getCountedQty = (line: InventoryCountLine): number | null => {
        if (editedLines.has(line.id)) {
            return editedLines.get(line.id)!
        }
        return line.counted_qty
    }

    const getDifference = (line: InventoryCountLine): number | null => {
        const counted = getCountedQty(line)
        if (counted === null) return null
        return counted - line.theoretical_qty
    }

    const linesWithChanges = useMemo(() => {
        if (!selectedCount) return 0
        return selectedCount.lines.filter(line => {
            const counted = getCountedQty(line)
            if (counted === null) return false
            return counted !== line.theoretical_qty
        }).length
    }, [selectedCount, editedLines])

    // ─── Detail View ──────────────────────────────────────────────────────
    if (selectedCountId && selectedCount) {
        const lineColumns: ColumnDef<InventoryCountLine>[] = [
            {
                accessorKey: "product_code",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Codigo" className="justify-center" />,
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
                header: ({ column }) => <DataTableColumnHeader column={column} title="Stock Teorico" className="justify-center" />,
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
                                    value !== null && value !== line.theoretical_qty && "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
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
                            diff > 0 && "text-green-600",
                            diff < 0 && "text-red-600",
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

        const statusConfig = STATUS_MAP[selectedCount.status] || { intent: 'neutral' as const, label: selectedCount.status }
        const isInProgress = selectedCount.status === 'IN_PROGRESS'

        return (
            <div className="flex-1 min-h-0 flex flex-col">
                {/* Header */}
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
                                <Chip intent={statusConfig.intent} size="sm">{statusConfig.label}</Chip>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {selectedCount.warehouse_name} &middot; {selectedCount.total_products} productos &middot;{' '}
                                {selectedCount.counted_products} contados
                                {linesWithChanges > 0 && (
                                    <span className="ml-1 text-amber-600">({linesWithChanges} con cambios sin guardar)</span>
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

                {/* Table */}
                <div className="flex-1 min-h-0">
                    <DataTable
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
    const listColumns: ColumnDef<typeof counts[number]>[] = [
        {
            accessorKey: "id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => <DataCell.Code>{`#${row.original.id}`}</DataCell.Code>,
            size: 80,
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Almacen" />,
            cell: ({ row }) => <DataCell.Text>{row.original.warehouse_name}</DataCell.Text>,
            size: 180,
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => {
                const config = STATUS_MAP[row.original.status] || { intent: 'neutral' as const, label: row.original.status }
                return (
                    <div className="flex justify-center w-full">
                        <Chip intent={config.intent} size="sm">{config.label}</Chip>
                    </div>
                )
            },
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
                            <Chip intent="warning" size="sm">{diffCount} diferencias</Chip>
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
            accessorKey: "created_at",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />,
            cell: ({ row }) => <DataCell.Date value={row.original.created_at} />,
            size: 100,
        },
        {
            id: "actions",
            header: () => null,
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <button
                        className="text-xs text-primary font-medium hover:underline"
                        onClick={() => handleSelectCount(row.original.id)}
                    >
                        {row.original.status === 'IN_PROGRESS' ? 'Continuar' : 'Ver Detalles'}
                    </button>
                </div>
            ),
            size: 100,
        },
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTable
                    columns={listColumns}
                    data={counts}
                    isLoading={isLoadingCounts}
                    variant="standalone"
                    createAction={
                        <Button size="sm" onClick={() => setShowNewDialog(true)}>
                            <Plus className="w-4 h-4 mr-1" />
                            Nuevo Conteo
                        </Button>
                    }
                    emptyState={{
                        context: "inventory",
                        title: "No hay conteos de inventario",
                        description: "Crea un nuevo conteo para comparar el stock teorico con el stock real.",
                    }}
                    onRowClick={(row) => handleSelectCount(row.id)}
                    getRowClassName={(row) => row.original.status === 'IN_PROGRESS' ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}
                />
            </div>

            {/* New Count Dialog */}
            <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Nuevo Conteo de Inventario</DialogTitle>
                        <DialogDescription>
                            Selecciona el almacen para cargar el stock teorico y comenzar el conteo.
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
    const form = useForm<NewCountFormValues>({
        resolver: zodResolver(newCountSchema),
        defaultValues: { notes: "" },
    })

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="warehouse"
                    render={({ field }) => (
                        <LabeledInput
                            label="Almacen"
                            type="select"
                            options={warehouses.map(w => ({ value: w.id.toString(), label: w.name }))}
                            placeholder="Seleccione el almacen"
                            required
                            {...field}
                        />
                    )}
                />
                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <LabeledInput
                            label="Notas (opcional)"
                            type="text"
                            placeholder="Motivo del conteo"
                            {...field}
                            value={field.value || ""}
                        />
                    )}
                />
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                        Crear Conteo
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    )
}
