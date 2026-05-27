"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { WarehouseInitialData } from "@/types/forms"
import * as z from "zod"
import { Drawer, CancelButton, LabeledInput, FormFooter, FormSplitLayout } from "@/components/shared"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { useWarehouseMutations } from "../hooks/useWarehouseMutations"
import { List } from "lucide-react"
import { ActionSlideButton } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit/components"
import { formDrawerWidth } from "@/lib/form-widths"

const warehouseSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().min(1, "El código es requerido"),
    address: z.string().optional(),
})

type WarehouseFormValues = z.infer<typeof warehouseSchema>

interface WarehouseDrawerProps {
    onSuccess?: () => void
    initialData?: WarehouseInitialData
    open?: boolean
    onOpenChange?: (open: boolean) => void
    inline?: boolean
    onLoadingChange?: (loading: boolean) => void
}

export function WarehouseDrawer({ onSuccess, initialData, open: openProp, onOpenChange, inline = false, onLoadingChange }: WarehouseDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const { saveWarehouse } = useWarehouseMutations()
    const [loading, setLoading] = useState(false)

    const width = formDrawerWidth("simple", !!initialData)

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
            // saveWarehouse invalida WAREHOUSES_KEYS.all (lista + detalle).
            // El toast de éxito y markLocalMutation() los hace el hook.
            await saveWarehouse({ id: initialData?.id ?? null, payload: { ...data, address: data.address || "" } })
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
            <Drawer
                open={open}
                
                side="left"
                defaultSize={width}
                contentClassName="p-0"
                icon={List}
                title={initialData ? "Editar Almacén" : "Nuevo Almacén"}
                subtitle={
                    form.watch("name")
                        ? `${form.watch("code") ? `${form.watch("code")} | ` : ""}${form.watch("name")}`
                        : (initialData ? undefined : "Nuevo Almacén")
                }
                footer={
                    <FormFooter>
                        <CancelButton onClick={() => setOpen(false)} />
                        <ActionSlideButton type="submit" form="warehouse-form" loading={loading}>
                            {initialData ? "Guardar Cambios" : "Crear Almacén"}
                        </ActionSlideButton>
                    </FormFooter>
                }
            >
                {formContent}
            </Drawer>
        </>
    )
}
