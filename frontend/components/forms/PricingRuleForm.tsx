"use client"

import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import api from "@/lib/api"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { PricingUtils } from "@/lib/pricing"
import { ProductSelector } from "@/components/selectors/ProductSelector"

const formSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    product: z.number().nullable().optional(),
    // category: removed as requested
    uom: z.number().nullable().optional(),
    operator: z.enum(["GT", "LT", "EQ", "GE", "LE", "BT"]),
    min_quantity: z.string().or(z.number()),
    max_quantity: z.string().or(z.number()).nullable().optional(),
    rule_type: z.enum(["FIXED", "DISCOUNT_PERCENTAGE", "PACKAGE_FIXED"]),
    fixed_price: z.string().or(z.number()).nullable().optional(),
    discount_percentage: z.string().or(z.number()).nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    priority: z.number(),
    active: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

interface PricingRuleFormProps {
    initialData?: any
    onSuccess?: () => void
    open: boolean
    onOpenChange: (open: boolean) => void
    productId?: number
    productName?: string
}

export function PricingRuleForm({ initialData, onSuccess, open, onOpenChange, productId, productName }: PricingRuleFormProps) {
    // const [categories, setCategories] = useState<any[]>([]) // Removed
    const [uoms, setUoms] = useState<any[]>([])

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            rule_type: "FIXED",
            min_quantity: "1",
            priority: 0,
            active: true,
            product: productId || null,
            uom: null,
            operator: "GE",
            max_quantity: null,
            fixed_price: null,
            discount_percentage: null,
            start_date: null,
            end_date: null,
        },
    })

    const ruleType = form.watch("rule_type")
    const operator = form.watch("operator")

    useEffect(() => {
        if (open) {
            // Reset form when dialog opens
            if (initialData) {
                form.reset({
                    name: initialData.name || "",
                    rule_type: initialData.rule_type || "FIXED",
                    operator: initialData.operator ?? "GE",
                    min_quantity: initialData.min_quantity !== undefined ? String(initialData.min_quantity) : "1",
                    max_quantity: initialData.max_quantity ? String(initialData.max_quantity) : null,
                    fixed_price: initialData.fixed_price ? String(initialData.fixed_price) : null,
                    discount_percentage: initialData.discount_percentage ? String(initialData.discount_percentage) : null,
                    priority: initialData.priority ?? 0,
                    active: initialData.active ?? true,
                    product: initialData.product || productId || null,
                    uom: initialData.uom || null,
                    start_date: initialData.start_date || null,
                    end_date: initialData.end_date || null,
                })
            } else {
                form.reset({
                    name: "",
                    rule_type: "FIXED",
                    min_quantity: "1",
                    priority: 0,
                    active: true,
                    product: productId || null,
                    uom: null,
                    operator: "GE",
                    max_quantity: null,
                    fixed_price: null,
                    discount_percentage: null,
                    start_date: null,
                    end_date: null,
                })
            }
        }
    }, [open, initialData, productId, form])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const uomRes = await api.get('/inventory/uoms/')
                setUoms(uomRes.data.results || uomRes.data)
            } catch (error) {
                console.error("Error fetching data", error)
            }
        }
        if (open) {
            fetchData()
        }
    }, [open])

    async function onSubmit(values: FormValues) {
        try {
            // Clean up null values or strings that should be null
            const payload = { ...values }
            if (payload.product === null) delete payload.product
            // if (payload.category === null) delete payload.category
            if (payload.uom === null) delete payload.uom
            if (payload.operator !== "BT") delete payload.max_quantity

            if (initialData) {
                await api.put(`/inventory/pricing-rules/${initialData.id}/`, payload)
                toast.success("Regla actualizada correctamente")
            } else {
                await api.post("/inventory/pricing-rules/", payload)
                toast.success("Regla creada correctamente")
            }
            onSuccess?.()
            onOpenChange?.(false)
        } catch (error: any) {
            console.error(error)
            toast.error("Error al guardar la regla")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Regla" : "Nueva Regla de Precio"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre de la Regla</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Descuento Mayorista" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 gap-4">
                            <FormField
                                control={form.control}
                                name="product"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Producto</FormLabel>
                                        <FormControl>
                                            <ProductSelector
                                                value={field.value?.toString() || null}
                                                onChange={(val) => field.onChange(val ? parseInt(val) : null)}
                                                disabled={!!productId}
                                                placeholder="Seleccione un producto (Si no selecciona, se aplicaran a todos"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="operator"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Condición (Operador)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="GE">Mayor o Igual ( {">"}= )</SelectItem>
                                                <SelectItem value="GT">Mayor que ( {">"} )</SelectItem>
                                                <SelectItem value="LE">Menor o Igual ( {"<"}= )</SelectItem>
                                                <SelectItem value="LT">Menor que ( {"<"} )</SelectItem>
                                                <SelectItem value="EQ">Igual a ( = )</SelectItem>
                                                <SelectItem value="BT">Entre (Rango)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prioridad</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                        </FormControl>
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
                                        <FormLabel>{operator === "BT" ? "Desde" : "Cantidad"}</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="uom"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unidad de Medida (Opcional)</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))}
                                            value={field.value?.toString() || "none"}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Base del producto" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Base del producto</SelectItem>
                                                {uoms.map((u) => (
                                                    <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {operator === "BT" && (
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="max_quantity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Hasta</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="rule_type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo de Regla</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione tipo" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="FIXED">Precio Fijo (Unitario)</SelectItem>
                                                <SelectItem value="PACKAGE_FIXED">Precio Paquete (Total Fijo)</SelectItem>
                                                <SelectItem value="DISCOUNT_PERCENTAGE">Porcentaje de Descuento</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {ruleType === "FIXED" || ruleType === "PACKAGE_FIXED" ? (
                                <FormField
                                    control={form.control}
                                    name="fixed_price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Precio Fijo (Neto)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} value={field.value || ""} />
                                            </FormControl>
                                            {field.value && !isNaN(parseFloat(field.value.toString())) && (
                                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5 border rounded p-2 bg-muted/50">
                                                    {ruleType === "PACKAGE_FIXED" && (
                                                        <div className="flex justify-between text-amber-600 font-medium pb-1 mb-1 border-b border-amber-200">
                                                            <span>Tipo:</span>
                                                            <span>Precio TOTAL por el rango</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between">
                                                        <span>Neto:</span>
                                                        <span>{parseInt(field.value.toString()).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>IVA (19%):</span>
                                                        <span>{PricingUtils.calculateTax(parseInt(field.value.toString())).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                                                    </div>
                                                    <div className="flex justify-between font-bold border-t pt-1 mt-1">
                                                        <span>Total (Bruto):</span>
                                                        <span>{PricingUtils.netToGross(parseInt(field.value.toString())).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                                                    </div>
                                                    {ruleType === "PACKAGE_FIXED" && form.watch('min_quantity') && (
                                                        <div className="pt-2 mt-1 border-t border-dashed text-xs text-slate-500">
                                                            <p>Precio Unitario (aprox) para {form.watch('min_quantity')} unidades:</p>
                                                            <p className="font-mono text-right">
                                                                {Math.round(parseInt(field.value.toString()) / parseFloat(form.watch('min_quantity') as string)).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })} c/u
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ) : (
                                <FormField
                                    control={form.control}
                                    name="discount_percentage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Descuento (%)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} value={field.value || ""} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="start_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha Inicio</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="end_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fecha Fin</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="active"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Regla Activa</FormLabel>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <Button type="submit" className="w-full">
                            {initialData ? "Actualizar" : "Crear"} Regla
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
