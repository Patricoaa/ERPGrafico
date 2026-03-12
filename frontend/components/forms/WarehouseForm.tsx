"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, BookOpen, Tag } from "lucide-react"
import { BaseModal } from "@/components/shared/BaseModal"
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
import { List, Warehouse } from "lucide-react"

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
        <>
            {openProp === undefined && !initialData && (
                <Button onClick={() => setOpen(true)}>Nuevo Almacén</Button>
            )}
            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size={initialData ? "lg" : "md"}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <List className="h-5 w-5 text-primary" />
                        </div>
                        <span>{initialData ? "Editar Almacén" : "Nuevo Almacén"}</span>
                    </div>
                }
                description={
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        {initialData?.code && (
                            <>
                                <span>{initialData.code}</span>
                                <span className="opacity-30">|</span>
                            </>
                        )}
                        <span>{form.watch("name") || "Nuevo Almacén"}</span>
                    </div>
                }
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button form="warehouse-form" type="submit" disabled={loading}>
                            {loading ? "Guardando..." : initialData ? "Guardar Cambios" : "Crear Almacén"}
                        </Button>
                    </div>
                }
            >
                <div className="flex-1 flex overflow-hidden min-h-[400px]">
                    <div className="flex-1 flex flex-col overflow-y-auto pt-4 scrollbar-thin">
                        <Form {...form}>
                            <form id="warehouse-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4 pl-1 pb-4">
                        <div className="grid grid-cols-2 gap-4">
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
                        </div>
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
                    </form>
                </Form>
                </div>

                {initialData?.id && (
                    <div className="w-72 border-l bg-muted/5 flex flex-col pt-4 hidden lg:flex">
                        <ActivitySidebar
                            entityId={initialData.id}
                            entityType="warehouse"
                        />
                    </div>
                )}
            </div>
            </BaseModal>
        </>
    )
}
