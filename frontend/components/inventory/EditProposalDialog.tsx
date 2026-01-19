"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import api from "@/lib/api"
import { toast } from "sonner"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"

const formSchema = z.object({
    qty_to_order: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Debe ser mayor a 0"),
    supplier: z.string().optional(),
    warehouse: z.string().min(1, "Seleccione un almacén"),
})

interface EditProposalDialogProps {
    proposal: any
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function EditProposalDialog({ proposal, open, onOpenChange, onSuccess }: EditProposalDialogProps) {
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [isSaving, setIsSaving] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            qty_to_order: "",
            supplier: "",
            warehouse: "",
        },
    })

    useEffect(() => {
        const fetchWarehouses = async () => {
            try {
                const res = await api.get('/inventory/warehouses/')
                setWarehouses(res.data.results || res.data)
            } catch (error) {
                console.error("Error fetching warehouses", error)
            }
        }
        if (open) {
            fetchWarehouses()
        }
    }, [open])

    useEffect(() => {
        if (proposal) {
            form.reset({
                qty_to_order: proposal.qty_to_order.toString(),
                supplier: proposal.supplier ? proposal.supplier.toString() : "",
                warehouse: proposal.warehouse ? proposal.warehouse.toString() : "",
            })
        }
    }, [proposal, form])

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsSaving(true)
        try {
            await api.patch(`/inventory/replenishment-proposals/${proposal.id}/`, {
                qty_to_order: values.qty_to_order,
                supplier: values.supplier || null,
                warehouse: values.warehouse,
            })
            toast.success("Propuesta actualizada")
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            toast.error("Error al actualizar la propuesta")
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Propuesta de Reabastecimiento</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="qty_to_order"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cantidad a Pedir ({proposal?.uom_name || 'Unidades'})</FormLabel>
                                    <FormControl>
                                        <Input {...field} type="number" step="0.01" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="supplier"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Proveedor</FormLabel>
                                    <FormControl>
                                        <AdvancedContactSelector
                                            contactType="SUPPLIER"
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Seleccionar proveedor..."
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
                                    <FormLabel>Almacén de Recepción</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar almacén" />
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
                        <DialogFooter>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
