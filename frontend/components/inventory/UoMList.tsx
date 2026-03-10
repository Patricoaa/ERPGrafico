"use client"

import React, { useEffect, useState } from "react"
import api from "@/lib/api"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2, Search, ChevronsUpDown, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { BaseModal } from "@/components/shared/BaseModal"
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
    const [isUoMModalOpen, setIsUoMModalOpen] = useState(false)
    const [currentUoM, setCurrentUoM] = useState<Partial<UoM>>({})
    const [isSaving, setIsSaving] = useState(false)

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

    useEffect(() => {
        if (externalOpen) {
            setCurrentUoM({ active: true, ratio: "1.00000", rounding: "0.01000", uom_type: "REFERENCE" })
            setIsUoMModalOpen(true)
        }
    }, [externalOpen])

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

    const handleDelete = async (id: number) => {
        if (!confirm("¿Eliminar unidad de medida?")) return
        try {
            await api.delete(`/inventory/uoms/${id}/`)
            toast.success("Eliminada correctamente")
            fetchData()
        } catch (error) {
            toast.error("No se puede eliminar (puede estar en uso)")
        }
    }

    const columns: ColumnDef<UoM>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            cell: ({ row }) => <div className="font-medium">{row.getValue("name")}</div>,
        },
        {
            accessorKey: "category_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Categoría" />,
            cell: ({ row }) => <div className="text-sm">{row.getValue("category_name")}</div>,
        },
        {
            accessorKey: "uom_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
            cell: ({ row }) => {
                const type = row.getValue("uom_type")
                return (
                    <div>
                        {type === 'REFERENCE' && <Badge variant="default" className="text-[10px]">Referencia</Badge>}
                        {type === 'BIGGER' && <Badge variant="secondary" className="text-[10px]">Mayor</Badge>}
                        {type === 'SMALLER' && <Badge variant="outline" className="text-[10px]">Menor</Badge>}
                    </div>
                )
            },
        },
        {
            accessorKey: "ratio",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ratio" className="justify-end" />,
            cell: ({ row }) => <div className="text-right font-mono text-xs tabular-nums text-muted-foreground">{parseFloat(row.getValue("ratio")).toString()}</div>,
        },
        {
            id: "actions",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Acciones" className="text-center" />,
            cell: ({ row }) => (
                <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCurrentUoM(row.original); setIsUoMModalOpen(true) }}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(row.original.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={uoms}
                filterColumn="name"
                searchPlaceholder="Buscar unidad..."
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
                useAdvancedFilter={true}
            />

            <BaseModal
                open={isUoMModalOpen}
                onOpenChange={(open) => {
                    setIsUoMModalOpen(open)
                    if (!open) onExternalOpenChange?.(false)
                }}
                title={`${currentUoM.id ? 'Editar' : 'Crear'} Unidad de Medida`}
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="outline" onClick={() => setIsUoMModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveUoM} disabled={isSaving}>
                            {isSaving ? "Guardando..." : "Guardar Unidad"}
                        </Button>
                    </div>
                }
            >
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Nombre</Label>
                        <Input
                            className="col-span-3"
                            placeholder="Ej: Kilogramo, Metro, Litro"
                            value={currentUoM.name || ''}
                            onChange={e => setCurrentUoM({ ...currentUoM, name: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Categoría</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className="col-span-3 justify-between font-normal"
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
                                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                            placeholder="Buscar categoría..."
                                            onChange={(e) => {
                                                const val = e.target.value.toLowerCase()
                                                const inputs = document.querySelectorAll('.category-item')
                                                inputs.forEach((el) => {
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
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Tipo</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    className="col-span-3 justify-between font-normal"
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
                                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                            placeholder="Buscar tipo..."
                                            onChange={(e) => {
                                                const val = e.target.value.toLowerCase()
                                                const inputs = document.querySelectorAll('.type-item')
                                                inputs.forEach((el) => {
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
                    {currentUoM.uom_type !== 'REFERENCE' && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Ratio</Label>
                            <Input
                                className="col-span-3"
                                type="number"
                                step="0.00001"
                                value={currentUoM.ratio || ''}
                                onChange={e => setCurrentUoM({ ...currentUoM, ratio: e.target.value })}
                            />
                            <p className="col-start-2 col-span-3 text-[10px] text-muted-foreground italic">
                                {currentUoM.uom_type === 'BIGGER'
                                    ? 'Cuántas unidades base equivalen a esta unidad'
                                    : 'Cuántas unidades de estas equivalen a la unidad base'}
                            </p>
                        </div>
                    )}
                </div>
            </BaseModal>
        </div>
    )
}
