"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { Plus, Minus, RefreshCw, History, ArrowRightLeft } from "lucide-react"

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"
import { ProductSelector } from "@/components/selectors/ProductSelector"

// Interfaces
interface StockMove {
    id: number
    date: string
    product_name: string
    product_code: string
    warehouse_name: string
    quantity: string
    description: string
    uom_name: string
    created_at: string
}

interface Warehouse {
    id: number
    name: string
}

// Schema
const adjustmentSchema = z.object({
    product_id: z.string().min(1, "Seleccione un producto"),
    warehouse_id: z.string().min(1, "Seleccione un almacén"),
    type: z.enum(["IN", "OUT"]),
    quantity: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Debe ser mayor a 0"),
    unit_cost: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Debe ser mayor o igual a 0"),
    adjustment_reason: z.string().min(1, "Seleccione un motivo"),
    description: z.string().optional(),
})

interface AdjustmentListProps {
    preSelectedProduct?: string
    preSelectedWarehouse?: string
    onSuccess?: () => void
}

export function AdjustmentList({ preSelectedProduct, preSelectedWarehouse, onSuccess }: AdjustmentListProps = {}) {
    const [moves, setMoves] = useState<StockMove[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Fetch Data
    const fetchData = async () => {
        setIsLoading(true)
        try {
            // Fetch Adjustments
            const movesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/moves/?move_type=ADJ`)
            if (movesRes.ok) setMoves(await movesRes.json())

            // Fetch Warehouses
            const warehouseRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/warehouses/`)
            if (warehouseRes.ok) setWarehouses(await warehouseRes.json())

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

    const form = useForm<z.infer<typeof adjustmentSchema>>({
        resolver: zodResolver(adjustmentSchema),
        defaultValues: {
            type: "IN",
            description: "",
            quantity: "",
            unit_cost: "0",
            adjustment_reason: "CORRECTION",
            product_id: preSelectedProduct || "",
            warehouse_id: preSelectedWarehouse || ""
        }
    })

    // Auto-fill unit_cost when product changes
    const selectedProductId = form.watch("product_id")
    useEffect(() => {
        if (selectedProductId) {
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/products/${selectedProductId}/`)
                .then(res => res.json())
                .then(data => {
                    if (data.cost_price !== undefined) {
                        form.setValue("unit_cost", data.cost_price.toString())
                    }
                })
        }
    }, [selectedProductId, form])

    const onSubmit = async (values: z.infer<typeof adjustmentSchema>) => {
        try {
            const qty = Number(values.quantity)
            const finalQty = values.type === 'OUT' ? -qty : qty

            const payload = {
                product_id: values.product_id,
                warehouse_id: values.warehouse_id,
                quantity: finalQty,
                unit_cost: Number(values.unit_cost),
                adjustment_reason: values.adjustment_reason,
                description: values.description || "Ajuste Manual"
            }

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/inventory/moves/adjust/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || "Error al crear ajuste")
            }

            toast.success("Ajuste creado exitosamente")
            form.reset()
            fetchData()
            setIsDialogOpen(false)
            onSuccess?.()

        } catch (error: any) {
            toast.error(error.message)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-muted-foreground text-sm">
                        Historial y creación de salidas/entradas manuales de stock.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Actualizar
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                Nuevo Ajuste
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Crear Ajuste Manual</DialogTitle>
                                <DialogDescription>
                                    Registra una entrada o salida manual de stock. Afectará la contabilidad automáticamente.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                    <FormField
                                        control={form.control}
                                        name="product_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Producto</FormLabel>
                                                <FormControl>
                                                    <ProductSelector
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        placeholder="Seleccionar producto..."
                                                        disabled={!!preSelectedProduct}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="warehouse_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Almacén</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                            name="type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Tipo Movimiento</FormLabel>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant={field.value === 'IN' ? 'default' : 'outline'}
                                                            className="w-full"
                                                            onClick={() => field.onChange('IN')}
                                                        >
                                                            <Plus className="mr-2 h-4 w-4" /> Entrada
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={field.value === 'OUT' ? 'destructive' : 'outline'}
                                                            className="w-full"
                                                            onClick={() => field.onChange('OUT')}
                                                        >
                                                            <Minus className="mr-2 h-4 w-4" /> Salida
                                                        </Button>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="quantity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Cantidad</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.01" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="unit_cost"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Costo Unitario ($)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.01" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="adjustment_reason"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Motivo Especial</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Seleccionar motivo..." />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="CORRECTION">Corrección de Inventario</SelectItem>
                                                            <SelectItem value="INITIAL">Inventario Inicial</SelectItem>
                                                            <SelectItem value="LOSS">Merma / Pérdida</SelectItem>
                                                            <SelectItem value="GAIN">Sobrante / Ganancia</SelectItem>
                                                            <SelectItem value="REVALUATION">Revalorización</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Motivo / Descripción</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Ej: Merma, Conteo inicial..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <DialogFooter>
                                        <Button type="submit">Guardar Ajuste</Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Separator />

            <Card className="border-none shadow-none">
                <CardHeader className="px-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <History className="h-4 w-4" />
                        Historial de Ajustes
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead>Almacén</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead className="text-right">Cantidad</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Cargando...</TableCell>
                                </TableRow>
                            ) : moves.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No hay ajustes registrados
                                    </TableCell>
                                </TableRow>
                            ) : (
                                moves.map((move) => (
                                    <TableRow key={move.id}>
                                        <TableCell>{format(new Date(move.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{move.product_code}</div>
                                            <div className="text-xs text-muted-foreground">{move.product_name}</div>
                                        </TableCell>
                                        <TableCell>{move.warehouse_name}</TableCell>
                                        <TableCell>{move.description}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={Number(move.quantity) > 0 ? "default" : "secondary"} className={Number(move.quantity) < 0 ? "bg-red-100 text-red-800 hover:bg-red-100" : ""}>
                                                {Number(move.quantity) > 0 ? "+" : ""}{Number(move.quantity).toFixed(2)} {move.uom_name}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
