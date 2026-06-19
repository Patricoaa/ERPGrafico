"use client"

import { useState, useEffect, useRef } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Smartphone, Printer } from "lucide-react"
import { useTerminalDevices, useTerminalProviders, type PaymentTerminalProvider } from "@/features/treasury"
import { Form, FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import type { DrawerMode } from "@/features/_shared/drawer/types"
import { Drawer, CancelButton, ActionSlideButton, LabeledInput, LabeledSelect, FormSection, FormFooter, FormSplitLayout, MultiSelectTagInput } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { toast } from "sonner"

const deviceSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    provider: z.string().min(1, "El proveedor es requerido"),
    serial_number: z.string().min(1, "El número de serie es requerido"),
    model: z.string().optional(),
    supported_payment_methods: z.array(z.string()).optional(),
})

type DeviceFormValues = z.infer<typeof deviceSchema>

interface DeviceDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    device?: any | null
    providers?: PaymentTerminalProvider[]
    onSuccess?: () => void
    mode?: DrawerMode
}

export function DeviceDrawer({ open, onOpenChange, device, providers: providersProp, onSuccess, mode: modeProp }: DeviceDrawerProps) {
    const { createDevice, updateDevice } = useTerminalDevices()
    const { providers: fetchedProviders } = useTerminalProviders()
    const providers = providersProp ?? fetchedProviders
    const mode: DrawerMode = modeProp ?? (device ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })
    const [loading, setLoading] = useState(false)

    const form = useForm<DeviceFormValues>({
        resolver: zodResolver(deviceSchema),
        defaultValues: {
            name: "",
            provider: "",
            serial_number: "",
            model: "",
            supported_payment_methods: ["1", "2"],
        }
    })

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                if (device) {
                    form.reset({
                        name: device.name,
                        provider: device.provider.toString(),
                        serial_number: device.serial_number,
                        model: device.model || "",
                        supported_payment_methods: (device.supported_payment_methods || []).map((m: number) => m.toString()),
                    })
                } else {
                    form.reset({
                        name: "",
                        provider: "",
                        serial_number: "",
                        model: "",
                        supported_payment_methods: ["1", "2"],
                    })
                }
            })
        }
    }, [open, device, form])

    const onSubmit = async (values: DeviceFormValues) => {
        if (!values.provider) {
            toast.error("Seleccione un proveedor")
            return
        }

        setLoading(true)
        try {
            const data = {
                name: values.name,
                provider: parseInt(values.provider),
                serial_number: values.serial_number,
                model: values.model || undefined,
                supported_payment_methods: (values.supported_payment_methods || []).map(v => parseInt(v)),
                is_active: true,
            }

            if (device) {
                await updateDevice({ id: device.id, data })
            } else {
                await createDevice(data)
            }
            onSuccess?.()
            onOpenChange(false)
        } catch {
            // Error handled by hook
        } finally {
            setLoading(false)
        }
    }

    const drawerTitle = isView
        ? `Ficha de Dispositivo${device?.id ? ` #${device.id}` : ""}`
        : mode === 'create'
            ? "Registrar Nuevo Hardware"
            : "Editar Dispositivo"

    return (
        <>
            {(mode === 'view' || mode === 'edit') && device?.id && (
                <PrintableLayout ref={printRef} title="Dispositivo" displayId={`#${device.id}`}>
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{device?.name ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("medium", !!device)}
                mode={mode}
                title={<span>{drawerTitle}</span>}
                headerActions={(mode === 'view' || mode === 'edit') && device?.id && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle="Vincule una terminal física con un proveedor de servicios."
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} />
                                <ActionSlideButton type="submit" loading={loading} onClick={form.handleSubmit(onSubmit)}>
                                    {mode === 'create' ? "Registrar" : "Guardar Cambios"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                <Form {...form}>
                    <FormSplitLayout>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                            <fieldset disabled={isView} className="contents">
                                <FormSection title="Información General" icon={Smartphone} />
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <LabeledInput
                                            label="Nombre descriptivo"
                                            required
                                            {...field}
                                            placeholder="Ej: Maquinita TUU 01"
                                        />
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="provider"
                                    render={({ field }) => (
                                        <LabeledSelect
                                            label="Proveedor"
                                            required
                                            value={field.value || ""}
                                            onChange={(v) => field.onChange(v)}
                                            placeholder="Seleccione..."
                                            options={providers.map(p => ({ value: p.id.toString(), label: p.name }))}
                                        />
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="serial_number"
                                    render={({ field }) => (
                                        <LabeledInput
                                            label="Número de Serie / TID"
                                            required
                                            {...field}
                                            placeholder="Número serie físico"
                                        />
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="model"
                                    render={({ field }) => (
                                        <LabeledInput
                                                    label="Modelo (opcional)"
                                            {...field}
                                            placeholder="Ej: Pax A920"
                                        />
                                    )}
                                />

                                <div className="space-y-3 pt-2">
                                    <Controller
                                        control={form.control}
                                        name="supported_payment_methods"
                                        render={({ field }) => (
                                            <MultiSelectTagInput
                                                label="Capacidades del Hardware"
                                                options={[
                                                    { label: "DÉBITO", value: "2" },
                                                    { label: "CRÉDITO", value: "1" }
                                                ]}
                                                value={field.value || []}
                                                onChange={field.onChange}
                                                placeholder="Seleccione capacidades..."
                                                hint="Marque solo los métodos que su terminal física permite procesar."
                                            />
                                        )}
                                    />
                                </div>
                            </fieldset>
                        </form>
                    </FormSplitLayout>
                </Form>
            </Drawer>
        </>
    )
}

export default DeviceDrawer
