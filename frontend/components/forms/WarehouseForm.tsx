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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { ActivitySidebar } from "../audit/ActivitySidebar"
import { FORM_STYLES } from "@/lib/styles"

const warehouseSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().min(1, "El código es requerido"),
    address: z.string().optional(),
})

type WarehouseFormValues = z.infer<typeof warehouseSchema>

interface WarehouseFormProps {
    onSuccess?: () => void
    initialData?: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function WarehouseForm({ onSuccess, initialData, open: openProp, onOpenChange }: WarehouseFormProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const [loading, setLoading] = useState(false)

    const form = useForm<WarehouseFormValues>({
        resolver: zodResolver(warehouseSchema),
        defaultValues: initialData || {
            name: "",
            code: "",
            address: "",
        },
    })

    // Reset form when initialData changes or modal opens
    useEffect(() => {
        if (open) {
            if (initialData) {
                form.reset(initialData)
            } else {
                form.reset({
                    name: "",
                    code: "",
                    address: "",
                })
            }
        }
    }, [open, initialData, form])

    async function onSubmit(data: WarehouseFormValues) {
        setLoading(true)
        try {
            if (initialData) {
                await api.put(`/inventory/warehouses/${initialData.id}/`, data)
            } else {
                await api.post('/inventory/warehouses/', data)
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: any) {
            console.error("Error saving warehouse:", error)
            alert(error.response?.data?.detail || "Error al guardar el almacén")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {openProp === undefined && !initialData && (
                <DialogTrigger asChild>
                    <Button>Nuevo Almacén</Button>
                </DialogTrigger>
            )}
            <DialogContent size="sm">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Almacén" : "Crear Almacén"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Modifique los datos del almacén." : "Ingrese los datos del nuevo almacén."}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Nombre</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Bodega Principal" className={FORM_STYLES.input} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Código</FormLabel>
                                    <FormControl>
                                        <Input placeholder="BOD01" className={FORM_STYLES.input} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={FORM_STYLES.label}>Dirección</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Av. Principal 123" className={FORM_STYLES.input} {...field} />
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
                                {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Almacén"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
