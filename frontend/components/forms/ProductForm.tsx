"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
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
import { Plus } from "lucide-react"
import api from "@/lib/api"
import { CategoryForm } from "./CategoryForm"

const productSchema = z.object({
    code: z.string().min(1, "El código es requerido"),
    name: z.string().min(1, "El nombre es requerido"),
    category: z.string().min(1, "La categoría es requerida"),
    product_type: z.enum(["STORABLE", "CONSUMABLE", "SERVICE"]),
    sale_price: z.string().min(0),
    cost_price: z.string().min(0),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormProps {
    onSuccess?: () => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function ProductForm({ onSuccess, initialData, open: openProp, onOpenChange }: ProductFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)
    const [categories, setCategories] = useState<any[]>([])
    const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false)

    const fetchCategories = async () => {
        try {
            const response = await api.get('/inventory/categories/')
            setCategories(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch categories", error)
        }
    }

    useEffect(() => {
        if (open) fetchCategories()
    }, [open])

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: initialData ? {
            ...initialData,
            category: initialData.category?.toString() || "",
        } : {
            code: "",
            name: "",
            product_type: "STORABLE",
            sale_price: "0",
            cost_price: "0",
        },
    })

    // Reset form when initialData changes or modal opens
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset({
                    ...initialData,
                    category: initialData.category?.id?.toString() || initialData.category?.toString() || "",
                })
            } else {
                form.reset({
                    code: "",
                    name: "",
                    product_type: "STORABLE",
                    sale_price: "0",
                    cost_price: "0",
                })
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: ProductFormValues) {
        setLoading(true)
        try {
            if (initialData) {
                await api.put(`/inventory/products/${initialData.id}/`, data)
            } else {
                await api.post('/inventory/products/', data)
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving product:", error)
            alert(error.response?.data?.detail || "Error al guardar el producto")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!initialData && (
                <DialogTrigger asChild>
                    <Button>Nuevo Producto</Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Producto" : "Crear Producto"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los datos del producto." : "Ingrese los datos del nuevo producto."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Código/SKU</FormLabel>
                                    <FormControl>
                                        <Input placeholder="PROD-001" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Papel A4" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría</FormLabel>
                                    <div className="flex gap-2">
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="flex-1">
                                                    <SelectValue placeholder="Seleccione categoría" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {categories.filter(cat => cat.id).map((cat) => (
                                                    <SelectItem key={cat.id} value={cat.id.toString()}>
                                                        {cat.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setIsCategoryFormOpen(true)}
                                            title="Nueva Categoría"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <CategoryForm
                                        open={isCategoryFormOpen}
                                        onOpenChange={setIsCategoryFormOpen}
                                        onSuccess={fetchCategories}
                                    />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="product_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="STORABLE">Almacenable</SelectItem>
                                            <SelectItem value="CONSUMABLE">Consumible</SelectItem>
                                            <SelectItem value="SERVICE">Servicio</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="cost_price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Costo</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="0" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="sale_price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Precio Venta</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="0" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex justify-end space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Producto"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
