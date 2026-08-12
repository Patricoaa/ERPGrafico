 
"use client"

import { showApiError } from "@/lib/errors"
import { useState } from "react"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { type WarehouseInitialData } from "@/types/forms"
import * as z from "zod"
import { Drawer, CancelButton, LabeledInput, FormFooter, FormSplitLayout } from "@/components/shared"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { useWarehouseMutations } from "../hooks/useWarehouseMutations"
import { ActionSlideButton } from "@/components/shared"
import { ActivitySidebar } from "@/features/audit"
import { formDrawerWidth } from "@/lib/form-widths"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"

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
    mode?: DrawerMode
}

export function WarehouseDrawer({ onSuccess, initialData, open: openProp, onOpenChange, inline = false, onLoadingChange, mode: modeProp }: WarehouseDrawerProps) {
    const [openState, setOpenState] = useState(false)
    const open = openProp !== undefined ? openProp : openState
    const setOpen = onOpenChange || setOpenState

    const mode: DrawerMode = modeProp ?? (initialData ? 'edit' : 'create')
    const isView = mode === 'view'
    const { printRef, handlePrint } = usePrintableDrawer()

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

    useInitializeDrawerForm({
        form,
        open,
        initialData,
        defaultValues: () => ({
            name: "",
            code: "",
            address: "",
        }),
    })

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
                    className="space-y-6 px-4 pb-4 pt-4"
                >
                    <fieldset disabled={isView} className="contents">

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
                    </fieldset>
                </form>
            </Form>
        </FormSplitLayout>
    )

    const identity = useDrawerIdentity('inventory.warehouse', mode, initialData, {
        overrideTitle: isView
            ? `Ficha de Almacén${initialData?.id ? ` #${initialData.id}` : ""}`
            : mode === 'create' ? "Nuevo Almacén" : "Editar Almacén",
        overrideSubtitle: form.watch("name")
            ? `${form.watch("code") ? `${form.watch("code")} | ` : ""}${form.watch("name")}`
            : (initialData ? undefined : "Nuevo Almacén"),
        onPrint: handlePrint,
        printable: (mode === 'view' || mode === 'edit') && !!initialData?.id,
    })

    if (inline) {
        return <>{formContent}</>
    }

    return (
        <>
            {!isView && openProp === undefined && !initialData && (
                <Button onClick={() => setOpen(true)}>Nuevo Almacén</Button>
            )}
            {(mode === 'view' || mode === 'edit') && initialData?.id && (
                <PrintableLayout
                    ref={printRef}
                    title="Warehouse"
                    displayId={`#${initialData.id}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{initialData?.name ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Código:</span>
                            <span>{initialData?.code ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                fillContent
                open={open}
                onOpenChange={setOpen}
                side="left"
                defaultSize={width}
                mode={mode}
                icon={identity.icon}
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => setOpen(false)} />
                                <ActionSlideButton type="submit" form="warehouse-form" loading={loading}>
                                    {mode === 'create' ? "Crear Almacén" : "Guardar Cambios"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                {formContent}
            </Drawer>
        </>
    )
}
