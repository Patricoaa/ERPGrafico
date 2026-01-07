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

const formSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    product: z.number().nullable().optional(),
    category: z.number().nullable().optional(),
    min_quantity: z.string().or(z.number()),
    rule_type: z.enum(["FIXED", "DISCOUNT_PERCENTAGE"]),
    fixed_price: z.string().or(z.number()).nullable().optional(),
    discount_percentage: z.string().or(z.number()).nullable().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    priority: z.number().default(0),
    active: z.boolean().default(true),
})

export function PricingRuleForm({ initialData, onSuccess, open, onOpenChange }: any) {
    const [products, setProducts] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: initialData ? {
            ...initialData,
            min_quantity: String(initialData.min_quantity),
            fixed_price: initialData.fixed_price ? String(initialData.fixed_price) : null,
            discount_percentage: initialData.discount_percentage ? String(initialData.discount_percentage) : null,
        } : {
            name: "",
            rule_type: "FIXED",
            min_quantity: "1",
            priority: 0,
            active: true,
        },
    })

    const ruleType = form.watch("rule_type")

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [prodRes, catRes] = await Promise.all([
                    api.get('/inventory/products/'),
                    api.get('/inventory/categories/')
                ])
                setProducts(prodRes.data.results || prodRes.data)
                setCategories(catRes.data.results || catRes.data)
            } catch (error) {
                console.error("Error fetching data", error)
            }
        }
        fetchData()
    }, [])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            // Clean up null values or strings that should be null
            const payload = { ...values }
            if (payload.product === null) delete payload.product
            if (payload.category === null) delete payload.category

            if (initialData) {
                await api.put(`/inventory/pricing-rules/${initialData.id}/`, payload)
                toast.success("Regla actualizada correctamente")
            } else {
                await api.post("/inventory/pricing-rules/", payload)
                toast.success("Regla creada correctamente")
            }
            onSuccess?.()
            onOpenChange?.(false)
        } catch (error) {
            console.error(error)
            toast.error("Error al guardar la regla")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {!initialData && (
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Nueva Regla
                    </Button>
                </DialogTrigger>
            )}
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

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="product"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Producto (Opcional)</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))}
                                            value={field.value?.toString() || "none"}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione un producto" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Todos los productos</SelectItem>
                                                {products.map((p) => (
                                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Categoría (Opcional)</FormLabel>
                                        <Select
                                            onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))}
                                            value={field.value?.toString() || "none"}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccione una categoría" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Todas las categorías</SelectItem>
                                                {categories.map((c) => (
                                                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
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
                                        <FormLabel>Cantidad Mínima</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
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
                                                <SelectItem value="FIXED">Precio Fijo</SelectItem>
                                                <SelectItem value="DISCOUNT_PERCENTAGE">Porcentaje de Descuento</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {ruleType === "FIXED" ? (
                                <FormField
                                    control={form.control}
                                    name="fixed_price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Precio Fijo</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} value={field.value || ""} />
                                            </FormControl>
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
