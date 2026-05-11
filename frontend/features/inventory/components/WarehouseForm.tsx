"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { WarehouseInitialData } from "@/types/forms"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import { CancelButton, LabeledInput, FormFooter, FormSplitLayout } from "@/components/shared"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { List } from "lucide-react"
import { SubmitButton } from "@/components/shared/ActionButtons"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"

const warehouseSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().min(1, "El código es requerido"),
    address: z.string().optional(),
})

type WarehouseFormValues = z.infer<typeof warehouseSchema>

interface WarehouseFormProps {
    sidebar?: React.ReactNode
    onSuccess?: () => void
    initialData?: WarehouseInitialData
    open?: boolean
    onOpenChange?: (open: boolean) => void
    inline?: boolean
    onLoadingChange?: (loading: boolean) => void
}

export function WarehouseForm({ sidebar, onSuccess, initialData, open: openProp, onOpenChange, inline = false, onLoadingChange }: WarehouseFormProps) {
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

    const lastResetId = useRef<number | undefined>(undefined)
    const wasOpen = useRef(false)

    // Reset form when initialData changes or modal opens
    useEffect(() => {
        if (!open) {
            wasOpen.current = false
            return
        }

        const currentId = initialData?.id
        const isNewOpen = !wasOpen.current
        const isNewData = currentId !== lastResetId.current

        if (isNewOpen || isNewData) {
            if (initialData) {
                form.reset(initialData)
            } else {
                form.reset({
                    name: "",
                    code: "",
                    address: "",
                })
            }
            lastResetId.current = currentId
            wasOpen.current = true
        }
    }, [open, initialData, form])

    async function onSubmit(data: WarehouseFormValues) {
        setLoading(true)
        if (onLoadingChange) onLoadingChange(true)
        try {
            if (initialData) {
                await api.put(`/inventory/warehouses/${initialData.id}/`, data)
            } else {
                await api.post('/inventory/warehouses/', data)
            }
            form.reset()
            setOpen(false)
            if (onSuccess) onSuccess()
        } catch (error: unknown) {
            console.error("Error saving warehouse:", error)
            showApiError(error, "Error al guardar el almacén")
        } finally {
            setLoading(false)
            if (onLoadingChange) onLoadingChange(false)
        }
    }

    const formContent = (
        <FormSplitLayout
            sidebar={initialData?.id ? (
                <ActivitySidebar 
                    entityId={initialData.id} 
                    entityType="warehouse" 
                />
            ) : undefined}
            showSidebar={!!initialData?.id}
        >
            <Form {...form}>
                <form 
                    id="warehouse-form" 
                    onSubmit={form.handleSubmit(onSubmit)} 
                    className="space-y-6 px-4 pb-4 pt-2"
                >

                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Nombre de Bodega"
                                                required
                                                placeholder="Ej: Bodega Central"
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <FormField
                                        control={form.control}
                                        name="code"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Código Interno"
                                                required
                                                placeholder="Ej: BOD-01"
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />
                                </div>

                                <div className="col-span-4">
                                    <FormField
                                        control={form.control}
                                        name="address"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Dirección Física"
                                                placeholder="Ej: Av. Industrial 1234, Santiago"
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                </form>
            </Form>
        </FormSplitLayout>
    )

    if (inline) {
        return <>{formContent}</>
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
                hideScrollArea={true}
                contentClassName="p-0"
                title={
                    <div className="flex items-center gap-3">
                        <List className="h-5 w-5 text-muted-foreground" />
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
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} />
                                <SubmitButton form="warehouse-form" loading={loading}>
                                    {initialData ? "Guardar Cambios" : "Crear Almacén"}
                                </SubmitButton>
                            </>
                        }
                    />
                }
            >
                {formContent}
            </BaseModal>
        </>
    )
}
