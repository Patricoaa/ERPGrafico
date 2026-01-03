"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"

const workOrderSchema = z.object({
    description: z.string().min(1, "La descripción es requerida"),
    sale_order: z.string().optional().or(z.literal("")),
    status: z.string(),
    specifications: z.string().optional(),
    qty_planned: z.number().min(0.01, "La cantidad planeada debe ser mayor a 0"),
    qty_produced: z.number().min(0),
    start_date: z.date().optional().nullable(),
    due_date: z.date().optional().nullable(),
})

type WorkOrderFormValues = z.infer<typeof workOrderSchema>

interface WorkOrderFormProps {
    onSuccess?: () => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function WorkOrderForm({ onSuccess, initialData, open: openProp, onOpenChange }: WorkOrderFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [saleOrders, setSaleOrders] = useState<any[]>([])

    const form = useForm<WorkOrderFormValues>({
        resolver: zodResolver(workOrderSchema),
        defaultValues: initialData ? {
            ...initialData,
            sale_order: initialData.sale_order?.toString() || "",
            status: initialData.status || "PLANNED",
            qty_planned: parseFloat(initialData.qty_planned) || 0,
            qty_produced: parseFloat(initialData.qty_produced) || 0,
            start_date: initialData.start_date ? new Date(initialData.start_date) : null,
            due_date: initialData.due_date ? new Date(initialData.due_date) : null,
        } : {
            description: "",
            sale_order: "",
            status: "PLANNED",
            specifications: "",
            qty_planned: 0,
            qty_produced: 0,
            start_date: null,
            due_date: null,
        },
    })

    const fetchSaleOrders = async () => {
        try {
            const response = await api.get('/sales/orders/')
            setSaleOrders(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching sale orders:", error)
        }
    }

    useEffect(() => {
        if (open) {
            fetchSaleOrders()
            if (initialData) {
                form.reset({
                    ...initialData,
                    sale_order: initialData.sale_order?.id?.toString() || initialData.sale_order?.toString() || "",
                    status: initialData.status || "PLANNED",
                    qty_planned: parseFloat(initialData.qty_planned) || 0,
                    qty_produced: parseFloat(initialData.qty_produced) || 0,
                    start_date: initialData.start_date ? new Date(initialData.start_date) : null,
                    due_date: initialData.due_date ? new Date(initialData.due_date) : null,
                })
            } else {
                form.reset({
                    description: "",
                    sale_order: "",
                    status: "PLANNED",
                    specifications: "",
                    qty_planned: 0,
                    qty_produced: 0,
                    start_date: null,
                    due_date: null,
                })
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: WorkOrderFormValues) {
        setLoading(true)
        // Format dates for API
        const formattedData = {
            ...data,
            start_date: data.start_date ? format(data.start_date, 'yyyy-MM-dd') : null,
            due_date: data.due_date ? format(data.due_date, 'yyyy-MM-dd') : null,
            sale_order: (data.sale_order === "" || data.sale_order === "__none__" || data.sale_order === "none") ? null : data.sale_order
        }

        try {
            if (initialData) {
                await api.put(`/production/orders/${initialData.id}/`, formattedData)
                toast.success("Orden de Trabajo actualizada correctamente")
            } else {
                await api.post('/production/orders/', formattedData)
                toast.success("Orden de Trabajo creada correctamente")
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving work order:", error)
            toast.error(error.response?.data?.detail || "Error al guardar la Orden de Trabajo")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!initialData && (
                <DialogTrigger asChild>
                    <Button>Nueva Orden de Trabajo</Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Orden de Trabajo" : "Crear Orden de Trabajo"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los datos de la OT." : "Ingrese los detalles de la nueva OT."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción / Título</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Impresión Folletos 1000u" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="sale_order"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nota de Venta (Opcional)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Vínculo con Venta" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="__none__">Sin Nota de Venta</SelectItem>
                                                {saleOrders.filter(so => so.id).map((so) => (
                                                    <SelectItem key={so.id} value={so.id.toString()}>
                                                        NV-{so.number} - {so.customer_name}
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
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Estado</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Estado OT" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="PLANNED">Planificada</SelectItem>
                                                <SelectItem value="IN_PROGRESS">En Proceso</SelectItem>
                                                <SelectItem value="FINISHED">Terminada</SelectItem>
                                                <SelectItem value="CANCELLED">Anulada</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="qty_planned"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cant. Planificada</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="1"
                                                {...field}
                                                onChange={(e) => field.onChange(Math.ceil(parseFloat(e.target.value) || 0))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="qty_produced"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cant. Producida</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="1"
                                                {...field}
                                                onChange={(e) => field.onChange(Math.ceil(parseFloat(e.target.value) || 0))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="start_date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Fecha Inicio</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>Elegir fecha</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value || undefined}
                                                    onSelect={field.onChange}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="due_date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Fecha Entrega</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>Elegir fecha</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value || undefined}
                                                    onSelect={field.onChange}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="specifications"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Especificaciones Técnicas</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Detalles sobre materiales, colores, acabados..."
                                            className="h-24"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear OT"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
