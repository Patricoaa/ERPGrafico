"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import api from "@/lib/api"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, Search, ChevronsUpDown, Check, Ruler } from "lucide-react"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { BaseModal } from "@/components/shared/BaseModal"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast } from "sonner"
import { FORM_STYLES } from "@/lib/styles"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface UoMCategory {
    id: number
    name: string
}

interface UoM {
    id: number
    name: string
    category: number
    category_name: string
    uom_type: 'REFERENCE' | 'BIGGER' | 'SMALLER'
    ratio: string
    rounding: string
    active: boolean
}

interface UoMListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export function UoMList({ externalOpen, onExternalOpenChange }: UoMListProps) {
    const [uoms, setUoMs] = useState<UoM[]>([])
    const [categories, setCategories] = useState<UoMCategory[]>([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [selectedRows, setSelectedRows] = useState<RowSelectionState>({})
    const [isUoMModalOpen, setIsUoMModalOpen] = useState(false)
    const [currentUoM, setCurrentUoM] = useState<Partial<UoM>>({})
    const [isSaving, setIsSaving] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsUoMModalOpen(false)
        setCurrentUoM({})
        onExternalOpenChange?.(false)

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            const [resUoMs, resCats] = await Promise.all([
                api.get('/inventory/uoms/'),
                api.get('/inventory/uom-categories/')
            ])
            setUoMs(resUoMs.data.results || resUoMs.data)
            setCategories(resCats.data.results || resCats.data)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar unidades de medida")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSaveUoM = async () => {
        setIsSaving(true)
        try {
            if (currentUoM.id) {
                await api.put(`/inventory/uoms/${currentUoM.id}/`, currentUoM)
                toast.success("Unidad actualizada")
            } else {
                await api.post('/inventory/uoms/', currentUoM)
                toast.success("Unidad creada")
            }
            setIsUoMModalOpen(false)
            fetchData()
        } catch (error) {
            toast.error("Error al guardar")
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/inventory/uoms/${id}/`)
            toast.success("Eliminada correctamente")
            fetchData()
        } catch (error) {
            toast.error("No se puede eliminar (puede estar en uso)")
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const columns = useMemo<ColumnDef<UoM>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text className="text-center w-full">
                    {row.getValue("name")}
                </DataCell.Text>
            ),
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Secondary className="text-center w-full">
                    {row.getValue("category_name")}
                </DataCell.Secondary>
            ),
        },
        {
            accessorKey: "uom_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const type = row.getValue("uom_type") as string
                const config: Record<string, { status: string, label: string }> = {
                    'REFERENCE': { status: 'INFO', label: 'Referencia' },
                    'BIGGER': { status: 'SUCCESS', label: 'Mayor' },
                    'SMALLER': { status: 'WARNING', label: 'Menor' }
                }
                return (
                    <div className="flex justify-center w-full">
                        <StatusBadge
                            status={config[type]?.status || 'NEUTRAL'}
                            label={config[type]?.label || type}
                            size="sm"
                        />
                    </div>
                )
            },
        },
        {
            accessorKey: "ratio",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ratio" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Number
                    value={row.getValue("ratio")}
                    decimals={2}
                    className="text-center w-full"
                />
            ),
        },
        createActionsColumn<UoM>({
            renderActions: (item) => (
                <>
                    <DataCell.Action icon={Pencil} title="Editar" onClick={() => { setCurrentUoM(item); setIsUoMModalOpen(true) }} />
                    <DataCell.Action icon={Trash2} title="Eliminar" className="text-destructive" onClick={() => handleDelete(item.id)} />
                </>
            ),
        }),
    ], [])

    const selectedUoMs = useMemo(() => {
        return uoms.filter((_, index) => selectedRows[index])
    }, [selectedRows, uoms])

    const handleBulkDelete = async () => {
        if (selectedUoMs.length === 0) return
        if (!confirm(`¿Está seguro de que desea eliminar ${selectedUoMs.length} unidades de medida?`)) return

        try {
            await Promise.all(selectedUoMs.map(u => api.delete(`/inventory/uoms/${u.id}/`)))
            toast.success(`${selectedUoMs.length} unidades eliminadas`)
            setSelectedRows({})
            fetchData()
        } catch (error) {
            toast.error("Error al eliminar las unidades")
        }
    }


    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={uoms}
                isLoading={loading}
                cardMode
                filterColumn="name"
                searchPlaceholder="Buscar unidad..."
                useAdvancedFilter={true}
                onRowSelectionChange={setSelectedRows}
                batchActions={
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive-foreground hover:bg-destructive/20 gap-2"
                        onClick={handleBulkDelete}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                    </Button>
                }
                globalFilterFields={["name", "category_name"]}
                facetedFilters={[
                    {
                        column: "uom_type",
                        title: "Tipo",
                        options: [
                            { label: "Referencia", value: "REFERENCE" },
                            { label: "Mayor", value: "BIGGER" },
                            { label: "Menor", value: "SMALLER" },
                        ],
                    },
                ]}
            />

            <BaseModal
                open={isUoMModalOpen || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsUoMModalOpen(true)
                    }
                }}
                size={currentUoM.id ? "lg" : "md"}
                title={
                    <div className="flex items-center gap-3">
                        <Ruler className="h-5 w-5 text-muted-foreground" />
                        <span>{currentUoM.id ? "Editar Unidad de Medida" : "Nueva Unidad de Medida"}</span>
                    </div>
                }
                description={currentUoM.id ? "Modifique los parámetros de conversión y consulte el historial." : "Configure el nombre, categoría y ratio de conversión."}
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="outline" onClick={() => setIsUoMModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveUoM} disabled={isSaving}>
                            {isSaving ? "Guardando..." : "Guardar Unidad"}
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-1 overflow-hidden min-h-[400px]">
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <div className="space-y-2">
                            <Label className={FORM_STYLES.label}>Nombre</Label>
                            <Input
                                className={FORM_STYLES.input}
                                placeholder="Ej: Kilogramo, Metro, Litro"
                                value={currentUoM.name || ''}
                                onChange={e => setCurrentUoM({ ...currentUoM, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>Categoría</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn("w-full justify-between font-normal", FORM_STYLES.input)}
                                        >
                                            {currentUoM.category
                                                ? categories.find(cat => cat.id === currentUoM.category)?.name
                                                : "Seleccionar categoría"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="col-span-3 w-[var(--radix-popover-trigger-width)] p-0">
                                        <div className="p-2">
                                            <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                <input
                                                    className={cn("flex h-9 w-full rounded-md bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground")}
                                                    placeholder="Buscar categoría..."
                                                    onChange={(e) => {
                                                        const val = e.target.value.toLowerCase()
                                                        const items = document.querySelectorAll('.category-item')
                                                        items.forEach((el) => {
                                                            if (el.textContent?.toLowerCase().includes(val)) {
                                                                (el as HTMLElement).style.display = 'flex'
                                                            } else {
                                                                (el as HTMLElement).style.display = 'none'
                                                            }
                                                        })
                                                    }}
                                                />
                                            </div>
                                            <div className="max-h-[200px] overflow-y-auto space-y-1">
                                                {categories.map((cat) => (
                                                    <div
                                                        key={cat.id}
                                                        className={cn(
                                                            "category-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                            currentUoM.category === cat.id && "bg-accent"
                                                        )}
                                                        onClick={() => {
                                                            setCurrentUoM({ ...currentUoM, category: cat.id })
                                                            document.body.click()
                                                        }}
                                                    >
                                                        <span>{cat.name}</span>
                                                        {currentUoM.category === cat.id && (
                                                            <Check className="ml-auto h-4 w-4 opacity-100" />
                                                        )}
                                                    </div>
                                                ))}
                                                {categories.length === 0 && (
                                                    <div className="p-4 text-sm text-center text-muted-foreground">
                                                        No hay categorías
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>Tipo</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn("w-full justify-between font-normal", FORM_STYLES.input)}
                                        >
                                            {currentUoM.uom_type === 'REFERENCE' ? 'Referencia (Base de la categoría)' :
                                                currentUoM.uom_type === 'BIGGER' ? 'Más Grande que la base' :
                                                    currentUoM.uom_type === 'SMALLER' ? 'Más Pequeña que la base' :
                                                        "Seleccionar tipo"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="col-span-3 w-[var(--radix-popover-trigger-width)] p-0">
                                        <div className="p-2">
                                            <div className="flex items-center px-3 border rounded-md mb-2 bg-background">
                                                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                <input
                                                    className={cn("flex h-9 w-full rounded-md bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground")}
                                                    placeholder="Buscar tipo..."
                                                    onChange={(e) => {
                                                        const val = e.target.value.toLowerCase()
                                                        const items = document.querySelectorAll('.type-item')
                                                        items.forEach((el) => {
                                                            if (el.textContent?.toLowerCase().includes(val)) {
                                                                (el as HTMLElement).style.display = 'flex'
                                                            } else {
                                                                (el as HTMLElement).style.display = 'none'
                                                            }
                                                        })
                                                    }}
                                                />
                                            </div>
                                            <div className="max-h-[200px] overflow-y-auto space-y-1">
                                                {[
                                                    { value: 'REFERENCE', label: 'Referencia (Base de la categoría)' },
                                                    { value: 'BIGGER', label: 'Más Grande que la base' },
                                                    { value: 'SMALLER', label: 'Más Pequeña que la base' }
                                                ].map((opt) => (
                                                    <div
                                                        key={opt.value}
                                                        className={cn(
                                                            "type-item relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                                            currentUoM.uom_type === opt.value && "bg-accent"
                                                        )}
                                                        onClick={() => {
                                                            setCurrentUoM({ ...currentUoM, uom_type: opt.value as any })
                                                            document.body.click()
                                                        }}
                                                    >
                                                        <span>{opt.label}</span>
                                                        {currentUoM.uom_type === opt.value && (
                                                            <Check className="ml-auto h-4 w-4 opacity-100" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        {currentUoM.uom_type !== 'REFERENCE' && (
                            <div className="space-y-2">
                                <Label className={FORM_STYLES.label}>Ratio</Label>
                                <Input
                                    className={FORM_STYLES.input}
                                    type="number"
                                    step="0.00001"
                                    value={currentUoM.ratio || ''}
                                    onChange={e => setCurrentUoM({ ...currentUoM, ratio: e.target.value })}
                                />
                                <p className="text-[10px] text-muted-foreground italic">
                                    {currentUoM.uom_type === 'BIGGER'
                                        ? 'Cuántas unidades base equivalen a esta unidad'
                                        : 'Cuántas unidades de estas equivalen a la unidad base'}
                                </p>
                            </div>
                        )}
                    </div>

                    {currentUoM.id && (
                        <ActivitySidebar
                                entityId={currentUoM.id}
                                entityType="uom"
                            />
                    )}
                </div>
            </BaseModal>

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Unidad de Medida"
                description="¿Seguro que deseas eliminar esta unidad de medida?"
                variant="destructive"
            />
        </div>
    )
}
