"use client"

// Dashboard unificado para la gestión de reabastecimiento: reglas y propuestas.

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Pencil, Trash2, RefreshCw, PlayCircle, Settings2, ShoppingCart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import api from "@/lib/api"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { ProposalsList } from "@/components/inventory/ProposalsList"

// Interfaces
interface ReorderingRule {
    id: number
    product: number
    product_name: string
    product_code: string
    warehouse: number
    warehouse_name: string
    min_quantity: string
    max_quantity: string
    active: boolean
}

interface ReplenishmentProposal {
    id: number
    product: number
    product_name: string
    product_code: string
    warehouse: number
    warehouse_name: string
    qty_to_order: string
    status: string
    status_display: string
    supplier: number | null
    supplier_name: string | null
    created_at: string
    uom_name: string
}

interface Warehouse {
    id: number
    name: string
}

// Schema
const ruleSchema = z.object({
    product: z.string().min(1, "Seleccione un producto"),
    warehouse: z.string().min(1, "Seleccione un almacén"),
    min_quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Debe ser mayor o igual a 0"),
    max_quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Debe ser mayor o igual a 0"),
    active: z.boolean(),
}).refine(data => Number(data.max_quantity) >= Number(data.min_quantity), {
    message: "La cantidad máxima debe ser mayor o igual a la mínima",
    path: ["max_quantity"],
})

type FormValues = z.infer<typeof ruleSchema>

export function ReplenishmentDashboard() {
    const [rules, setRules] = useState<ReorderingRule[]>([])
    const [proposals, setProposals] = useState<ReplenishmentProposal[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<ReorderingRule | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [activeTab, setActiveTab] = useState("rules")

    // Fetch Data
    const fetchData = async () => {
        setIsLoading(true)
        try {
            const [rulesRes, proposalsRes, warehousesRes] = await Promise.all([
                api.get('/inventory/reordering-rules/'),
                api.get('/inventory/replenishment-proposals/'),
                api.get('/inventory/warehouses/')
            ])

            setRules(rulesRes.data.results || rulesRes.data)
            setProposals(proposalsRes.data.results || proposalsRes.data)
            setWarehouses(warehousesRes.data.results || warehousesRes.data)
        } catch (error) {
            console.error("Failed to fetch data", error)
            toast.error("Error al cargar datos")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const form = useForm<FormValues>({
        resolver: zodResolver(ruleSchema),
        defaultValues: {
            active: true,
            min_quantity: "0",
            max_quantity: "0",
            product: "",
            warehouse: ""
        }
    })

    // Auto-fill form when editing
    useEffect(() => {
        if (editingRule) {
            form.reset({
                product: editingRule.product.toString(),
                warehouse: editingRule.warehouse.toString(),
                min_quantity: editingRule.min_quantity,
                max_quantity: editingRule.max_quantity,
                active: editingRule.active
            })
        } else {
            form.reset({
                active: true,
                min_quantity: "0",
                max_quantity: "0",
                product: "",
                warehouse: ""
            })
        }
    }, [editingRule, form])

    const onSubmit = async (values: FormValues) => {
        setIsSaving(true)
        try {
            if (editingRule) {
                await api.put(`/inventory/reordering-rules/${editingRule.id}/`, values)
                toast.success("Regla actualizada")
            } else {
                await api.post('/inventory/reordering-rules/', values)
                toast.success("Regla creada")
            }
            setIsDialogOpen(false)
            setEditingRule(null)
            fetchData()
        } catch (error: any) {
            console.error(error)
            toast.error("Error al guardar regla")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Eliminar esta regla?")) return
        try {
            await api.delete(`/inventory/reordering-rules/${id}/`)
            toast.success("Regla eliminada")
            fetchData()
        } catch (error) {
            toast.error("Error al eliminar")
        }
    }

    const handleRunScheduler = async () => {
        const toastId = toast.loading("Ejecutando planificador...")
        try {
            const response = await api.post('/inventory/replenishment-proposals/run_planifier/')
            toast.success(`Planificación completada: ${response.data.proposals_created_or_updated || 0} propuestas creadas/actualizadas`, { id: toastId })
            fetchData()
            setActiveTab("proposals")
        } catch (error) {
            toast.error("Error en planificación", { id: toastId })
        }
    }

    const columns: ColumnDef<ReorderingRule>[] = [
        {
            accessorKey: "product_code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Producto" />
            ),
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.product_code}</div>
                    <div className="text-xs text-muted-foreground">{row.original.product_name}</div>
                </div>
            ),
        },
        {
            accessorKey: "warehouse_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Almacén" />
            ),
        },
        {
            accessorKey: "min_quantity",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Mínimo" className="justify-end" />
            ),
            cell: ({ row }) => <div className="text-right font-medium text-amber-600">{Number(row.getValue("min_quantity"))}</div>,
        },
        {
            accessorKey: "max_quantity",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Máximo" className="justify-end" />
            ),
            cell: ({ row }) => <div className="text-right font-medium text-blue-600">{Number(row.getValue("max_quantity"))}</div>,
        },
        {
            accessorKey: "active",
            id: "active",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" className="justify-center" />
            ),
            filterFn: (row, id, value: string[]) => {
                if (!value || value.length === 0) return true
                const rowValue = !!row.getValue(id)
                return value.includes(String(rowValue))
            },
            cell: ({ row }) => (
                <div className="flex justify-center">
                    {row.getValue("active") ? (
                        <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200">Activo</Badge>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground">Pausado</Badge>
                    )}
                </div>
            ),
        },
        {
            id: "actions",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Acciones" className="text-right" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setEditingRule(row.original)
                            setIsDialogOpen(true)
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(row.original.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ]

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">
                        Define reglas de stock mínimo/máximo y gestiona propuestas de compra automáticas.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={handleRunScheduler} disabled={isLoading}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Ejecutar Planificador
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open)
                        if (!open) setEditingRule(null)
                    }}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                Nueva Regla
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>{editingRule ? 'Editar Regla' : 'Nueva Regla de Reabastecimiento'}</DialogTitle>
                                <DialogDescription>
                                    Configura los niveles de stock para activar alertas de compra.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="product"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Producto</FormLabel>
                                                    <FormControl>
                                                        <ProductSelector
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            disabled={!!editingRule}
                                                            placeholder="Seleccionar producto..."
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="warehouse"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Almacén</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Seleccionar almacén..." />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {warehouses.map((w) => (
                                                                <SelectItem key={w.id} value={w.id.toString()}>
                                                                    {w.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="min_quantity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Stock Mínimo</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.01" {...field} />
                                                    </FormControl>
                                                    <FormDescription className="text-[10px]">
                                                        Punto de reorden.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="max_quantity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Stock Máximo</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.01" {...field} />
                                                    </FormControl>
                                                    <FormDescription className="text-[10px]">
                                                        Objetivo de stock.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="active"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-sm">Regla Activa</FormLabel>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <DialogFooter>
                                        <Button type="submit" disabled={isSaving}>
                                            {isSaving && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                            Guardar
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="rules" className="gap-2">
                        <Settings2 className="h-4 w-4" />
                        Reglas de Stock
                    </TabsTrigger>
                    <TabsTrigger value="proposals" className="gap-2 relative">
                        <ShoppingCart className="h-4 w-4" />
                        Propuestas Pendientes
                        {proposals.filter(p => p.status === 'PENDING').length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                                {proposals.filter(p => p.status === 'PENDING').length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="rules" className="space-y-4">
                    <DataTable
                        columns={columns}
                        data={rules}
                        filterColumn="product_code"
                        searchPlaceholder="Buscar por producto..."
                        facetedFilters={[
                            {
                                column: "active",
                                title: "Estado",
                                options: [
                                    { label: "Activo", value: "true" },
                                    { label: "Pausado", value: "false" },
                                ],
                            },
                        ]}
                        useAdvancedFilter={true}
                        initialColumnVisibility={{ active: false }}
                    />
                </TabsContent>

                <TabsContent value="proposals" className="space-y-4">
                    <ProposalsList
                        data={proposals}
                        onRefresh={fetchData}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
