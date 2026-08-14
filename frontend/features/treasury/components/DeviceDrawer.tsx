"use client"

import { useState } from "react"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Smartphone } from "lucide-react"
import { useTerminalDevices, useTerminalProviders, type PaymentTerminalProvider, type PaymentTerminalDevice } from "@/features/treasury"
import { Form, FormField } from "@/components/ui/form"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"
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
    device?: PaymentTerminalDevice | null
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
    const { printRef, handlePrint } = usePrintableDrawer()
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

    useInitializeDrawerForm({
        form,
        open,
        initialData: device,
        defaultValues: () => ({
            name: "",
            provider: "",
            serial_number: "",
            model: "",
            supported_payment_methods: ["1", "2"],
        }),
        mapData: (data) => ({
            name: data.name,
            provider: data.provider.toString(),
            serial_number: data.serial_number,
            model: data.model || "",
            supported_payment_methods: (data.supported_payment_methods || []).map((m: number) => m.toString()),
        })
    })

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

    const identity = useDrawerIdentity('treasury.terminaldevice', mode, device, {
        overrideTitle: mode === 'create' ? "Registrar Nuevo Hardware" : undefined,
        overrideSubtitle: "Vincule una terminal física con un proveedor de servicios.",
        printable: (mode === 'view' || mode === 'edit') && !!device?.id,
        onPrint: handlePrint,
    })

    return (
        <>
            {(mode === 'view' || mode === 'edit') && device?.id && (
                <PrintableLayout ref={printRef} title="Dispositivo" displayId={`#${device.id}`}>
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{device?.name ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                fillContent
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("medium", !!device)}
                mode={mode}
                icon={identity.icon}
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
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
                                <div className="space-y-4">
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
