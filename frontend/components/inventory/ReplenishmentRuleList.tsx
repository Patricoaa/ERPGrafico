"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Pencil, Trash2, RefreshCw, PlayCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
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
import { toast } from "sonner"
import api from "@/lib/api"

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

interface Product {
    id: number
    name: string
    code: string
    internal_code: string
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

export function ReplenishmentRuleList() {
    const [rules, setRules] = useState<ReorderingRule[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<ReorderingRule | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Fetch Data
    const fetchData = async () => {
        setIsLoading(true)
        try {
            const [rulesRes, productsRes, warehousesRes] = await Promise.all([
                api.get('/inventory/reordering-rules/'),
                api.get('/inventory/products/'),
                api.get('/inventory/warehouses/')
            ])

            setRules(rulesRes.data.results || rulesRes.data)
            setProducts(productsRes.data.results || productsRes.data)
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
        toast.info("Iniciando planificador...")
        try {
            // Placeholder for future endpoint
            // await api.post('/inventory/procurement/run/') 
            await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate delay
            toast.success("Planificación completada (Simulada)")
        } catch (error) {
            toast.error("Error en planificación")
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">
                        Define reglas de stock mínimo/máximo para sugerir compras automáticamente.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={handleRunScheduler}>
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
                                    <FormField
                                        control={form.control}
                                        name="product"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Producto</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    value={field.value}
                                                    disabled={!!editingRule} // Disable changing product on edit to simplify
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccionar producto..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {products.map((p) => (
                                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                                {p.internal_code} - {p.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
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

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>Almacén</TableHead>
                            <TableHead className="text-right">Mínimo</TableHead>
                            <TableHead className="text-right">Máximo</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                            </TableRow>
                        ) : rules.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    No hay reglas de reabastecimiento definidas.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rules.map((rule) => (
                                <TableRow key={rule.id}>
                                    <TableCell>
                                        <div className="font-medium">{rule.product_code}</div>
                                        <div className="text-xs text-muted-foreground">{rule.product_name}</div>
                                    </TableCell>
                                    <TableCell>{rule.warehouse_name}</TableCell>
                                    <TableCell className="text-right font-medium text-amber-600">
                                        {Number(rule.min_quantity)}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-blue-600">
                                        {Number(rule.max_quantity)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {rule.active ? (
                                            <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200">Activo</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">Pausado</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setEditingRule(rule)
                                                    setIsDialogOpen(true)
                                                }}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(rule.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
