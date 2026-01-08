"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Plus, Trash2, Save, Loader2, Info } from "lucide-react"
import { ProductSelector } from "@/components/selectors/ProductSelector"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"

// Schema
const bomSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    active: z.boolean().default(true),
    notes: z.string().optional(),
    lines: z.array(z.object({
        component: z.string().min(1, "Componente requerido"), // ID as string
        component_code: z.string().optional(), // For display
        component_name: z.string().optional(), // For display
        quantity: z.coerce.number().min(0.0001, "Cantidad debe ser mayor a 0"),
        unit: z.string().default("UN"),
        notes: z.string().optional()
    })).min(1, "Debe agregar al menos un componente")
})

// Explicit type to avoid inference mismatches
type BOMFormValues = {
    name: string
    active: boolean
    notes?: string
    lines: {
        component: string
        component_code?: string
        component_name?: string
        quantity: number
        unit: string
        notes?: string
    }[]
}

interface BOMFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: any
    bomToEdit?: any
    onSuccess: () => void
}

export function BOMFormDialog({
    open,
    onOpenChange,
    product,
    bomToEdit,
    onSuccess
}: BOMFormDialogProps) {
    const [loading, setLoading] = useState(false)

    // Form
    const form = useForm<BOMFormValues>({
        resolver: zodResolver(bomSchema) as any, // Cast to any to bypass strict type mismatch between zod and rhf versions
        defaultValues: {
            name: "",
            active: true,
            notes: "",
            lines: []
        }
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines"
    })

    // Reset form when dialog opens/closes or bomToEdit changes
    useEffect(() => {
        if (open) {
            if (bomToEdit) {
                form.reset({
                    name: bomToEdit.name,
                    active: bomToEdit.active,
                    notes: bomToEdit.notes || "",
                    lines: bomToEdit.lines.map((l: any) => ({
                        component: l.component.toString(),
                        component_code: l.component_code,
                        component_name: l.component_name,
                        quantity: l.quantity,
                        unit: l.unit,
                        notes: l.notes || ""
                    }))
                })
            } else {
                form.reset({
                    name: "Nueva Lista de Materiales",
                    active: true,
                    notes: "",
                    lines: []
                })
            }
        }
    }, [open, bomToEdit, form])

    const onSubmit = async (data: BOMFormValues) => {
        if (!product) return
        setLoading(true)
        try {
            const payload = {
                product: product.id,
                ...data,
                lines: data.lines.map(l => ({
                    component: parseInt(l.component),
                    quantity: l.quantity,
                    unit: l.unit, // Simplified, ideally select from Component UoMs
                    notes: l.notes
                }))
            }

            if (bomToEdit) {
                await api.patch(`/production/bom/${bomToEdit.id}/`, payload)
                toast.success("BOM actualizada correctamente")
            } else {
                await api.post("/production/bom/", payload)
                toast.success("BOM creada correctamente")
            }
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error saving BOM:", error)
            toast.error("Error al guardar BOM: " + (error.response?.data?.detail || error.message))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        {bomToEdit ? `Editar BOM: ${bomToEdit.name}` : "Crear Nueva Lista de Materiales"}
                    </DialogTitle>
                    <DialogDescription>
                        {product?.name} ({product?.code})
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-1">
                    <Form {...form}>
                        <form id="bom-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">

                            {/* Header Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre de la Lista</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Versión Estándar 2024" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="active"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between rounded-lg border p-3 mt-1">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Activa</FormLabel>
                                                    <FormDescription>
                                                        Solo una BOM activa por producto.
                                                    </FormDescription>
                                                </div>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notas</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Instrucciones especiales..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Components Table */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold flex items-center gap-2">
                                        <Info className="h-4 w-4" />
                                        Componentes y Materias Primas
                                    </h3>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => append({ component: "", quantity: 1, unit: "UN", notes: "" })}
                                        className="gap-2"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Agregar Componente
                                    </Button>
                                </div>

                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[40%]">Componente</TableHead>
                                                <TableHead className="w-[20%]">Cantidad</TableHead>
                                                <TableHead className="w-[15%]">Unidad</TableHead>
                                                <TableHead>Notas</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {fields.map((field, index) => (
                                                <TableRow key={field.id}>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`lines.${index}.component`}
                                                            render={({ field: propField }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <ProductSelector
                                                                            value={propField.value}
                                                                            onChange={(val) => propField.onChange(val)}
                                                                            placeholder="Buscar componente..."
                                                                            allowedTypes={['STORABLE', 'CONSUMABLE', 'MANUFACTURABLE']}
                                                                        // Avoid circular dependency if possible, but basic list is ok
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`lines.${index}.quantity`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input type="number" step="0.0001" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`lines.${index}.unit`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input {...field} placeholder="Unidad" />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormField
                                                            control={form.control}
                                                            name={`lines.${index}.notes`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <Input {...field} placeholder="Opcional" />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => remove(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {fields.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                        No hay componentes definidos. Agregue uno para comenzar.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                                {form.formState.errors.lines && (
                                    <p className="text-sm font-medium text-destructive">
                                        {form.formState.errors.lines.root?.message || "Error en las líneas"}
                                    </p>
                                )}
                            </div>
                        </form>
                    </Form>
                </div>

                <DialogFooter className="py-4 border-t mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button form="bom-form" type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Guardar BOM
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
