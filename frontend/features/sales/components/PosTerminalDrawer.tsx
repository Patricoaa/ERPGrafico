"use client"

import { useState, useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { showApiError } from "@/lib/errors"
import { toast } from "sonner"
import { MonitorSmartphone, Banknote, CreditCard, Landmark, Smartphone, Printer, FileCheck } from "lucide-react"
import { usePaymentMethods, useTerminalDevices, type Terminal, type TerminalCreatePayload, type TerminalUpdatePayload } from "@/features/treasury"
import { treasuryApi } from "@/features/treasury/api/treasuryApi"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Form, FormField } from "@/components/ui/form"
import { Drawer, CancelButton, LabeledInput, LabeledSelect, FormSection, FormFooter, FormSplitLayout, ActionSlideButton } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { ActivitySidebar } from "@/features/audit/components"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import { useDrawerIdentity, type DrawerMode } from "@/features/_shared/drawer"

const terminalSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    code: z.string().min(1, "El código es requerido"),
    location: z.string().optional(),
    serial_number: z.string().optional(),
    ip_address: z.string().optional(),
    device_id: z.string().optional(),
})

type TerminalFormValues = z.infer<typeof terminalSchema>

interface PosTerminalDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    terminal?: Terminal | null
    onSuccess?: () => void
    mode?: DrawerMode
}

export function PosTerminalDrawer({ open, onOpenChange, terminal, onSuccess, mode: modeProp }: PosTerminalDrawerProps) {
    const mode: DrawerMode = modeProp ?? (terminal ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedMethodIds, setSelectedMethodIds] = useState<number[]>([])

    const { methods: allPaymentMethods } = usePaymentMethods()
    const { devices: allDevices } = useTerminalDevices()

    const allMethods = allPaymentMethods.filter(m => m.is_active && m.allow_for_sales === true)

    const form = useForm<TerminalFormValues>({
        resolver: zodResolver(terminalSchema),
        defaultValues: {
            name: "",
            code: "",
            location: "",
            serial_number: "",
            ip_address: "",
            device_id: "",
        }
    })

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                if (terminal) {
                    form.reset({
                        name: terminal.name,
                        code: terminal.code,
                        location: terminal.location || "",
                        serial_number: terminal.serial_number || "",
                        ip_address: terminal.ip_address || "",
                        device_id: (() => {
                            const dId = terminal.payment_terminal_device;
                            return typeof dId === 'object' && dId !== null ? (dId as { id: number }).id.toString() : dId?.toString() || "";
                        })(),
                    })
                    setSelectedMethodIds(terminal.allowed_payment_methods.map(m => m.id))
                } else {
                    form.reset({
                        name: "",
                        code: "",
                        location: "",
                        serial_number: "",
                        ip_address: "",
                        device_id: "",
                    })
                    setSelectedMethodIds([])
                }
            })
        }
    }, [open, terminal, form])

    const toggleMethod = (methodId: number) => {
        if (isView) return
        setSelectedMethodIds(prev => {
            const isSelected = prev.includes(methodId)
            if (isSelected) {
                return prev.filter(id => id !== methodId)
            } else {
                const methodToAdd = allMethods.find(m => m.id === methodId)
                if (methodToAdd?.method_type === 'CASH') {
                    const existingCash = allMethods.find(m =>
                        prev.includes(m.id) && m.method_type === 'CASH'
                    )
                    if (existingCash) {
                        toast.warning("Solo se puede seleccionar 1 método de EFECTIVO (Caja) por terminal.")
                        return prev
                    }
                }
                return [...prev, methodId]
            }
        })
    }

    const onSubmit = async (values: TerminalFormValues) => {
        setIsSubmitting(true)
        try {
            const selectedCashMethod = allMethods.find(m =>
                selectedMethodIds.includes(m.id) && m.method_type === 'CASH'
            )
            const defaultAccount = selectedCashMethod ? selectedCashMethod.treasury_account : null

            const payload = {
                name: values.name,
                code: values.code,
                location: values.location || "",
                serial_number: values.serial_number || "",
                ip_address: values.ip_address || null,
                payment_terminal_device: (values.device_id === "none" || !values.device_id) ? null : Number(values.device_id),
                allowed_payment_method_ids: selectedMethodIds,
                default_treasury_account: defaultAccount
            }

            if (terminal) {
                await treasuryApi.updateTerminal(terminal.id, payload as unknown as TerminalUpdatePayload)
                toast.success("Caja POS actualizada correctamente")
            } else {
                await treasuryApi.createTerminal(payload as unknown as TerminalCreatePayload)
                toast.success("Caja POS creada correctamente")
            }
            onSuccess?.()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al guardar la caja POS")
        } finally {
            setIsSubmitting(false)
        }
    }

    const typeOrder = ['CASH', 'CARD', 'TRANSFER', 'CHECK', 'OTHER']

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'CASH': 'Efectivo (Cajas)',
            'CARD': 'Tarjetas (Débito / Crédito)',
            'TRANSFER': 'Transferencias',
            'CHECK': 'Cheques',
            'OTHER': 'Otros'
        }
        return labels[type] || type
    }

    const methodsGrouped = allMethods.reduce((acc, method) => {
        let type = method.method_type
        if (type === 'DEBIT_CARD' || type === 'CREDIT_CARD') {
            type = 'CARD'
        }
        if (!acc[type]) acc[type] = []
        acc[type].push(method)
        return acc
    }, {} as Record<string, Array<{ id: number; name: string; treasury_account_name: string; method_type: string }>>)

    const identity = useDrawerIdentity('pos.terminal', mode, terminal, {
        feminine: true,
        overrideSubtitle: (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {terminal?.code && (
                    <>
                        <span>{terminal.code}</span>
                        <span className="opacity-30">|</span>
                    </>
                )}
                <span>{terminal ? "Modifique la configuración de la caja POS y revise su historial." : "Configuración de la caja POS y asignación de métodos de pago."}</span>
            </div>
        ),
    })

    return (
        <>
            {terminal?.id && (mode === 'view' || mode === 'edit') && (
                <PrintableLayout
                    ref={printRef}
                    title="Terminal"
                    displayId={terminal.code ? `#${terminal.code}` : `#${terminal.id}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{terminal?.name ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Código:</span>
                            <span>{terminal?.code ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Ubicación:</span>
                            <span>{terminal?.location ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("complex", !!terminal)}
                mode={mode}
                title={identity.title}
                icon={identity.icon}
                headerActions={terminal?.id && (mode === 'view' || mode === 'edit') && (
                    <Button variant="ghost" size="icon" onClick={() => handlePrint()}>
                        <Printer className="h-4 w-4" />
                    </Button>
                )}
                subtitle={identity.subtitle}
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} />
                                <ActionSlideButton type="submit" form="terminal-form" loading={isSubmitting} disabled={isSubmitting}>
                                    {mode === 'create' ? "Crear Caja POS" : "Guardar Cambios"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
                <FormSplitLayout
                    showSidebar={!!terminal?.id}
                    sidebar={terminal?.id ? (
                        <ActivitySidebar
                            entityType="terminal"
                            entityId={terminal.id}
                            className="h-full border-none"
                            title="Historial"
                        />
                    ) : undefined}
                >
                    <Form {...form}>
                        <form id="terminal-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-6 pb-6 pt-6">
                            <fieldset disabled={isView} className="contents">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <LabeledInput
                                                label="Nombre"
                                                required
                                                {...field}
                                                placeholder="Ej: Caja 1"
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="code"
                                        render={({ field }) => (
                                            <LabeledInput
                                                label="Código"
                                                required
                                                {...field}
                                                placeholder="TERM-01"
                                                className="uppercase"
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="location"
                                        render={({ field }) => (
                                            <LabeledInput
                                                label="Ubicación"
                                                {...field}
                                                placeholder="Ej: Entrada"
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="ip_address"
                                        render={({ field }) => (
                                            <LabeledInput
                                                    label="IP (opcional)"
                                                {...field}
                                                placeholder="192.168.1.100"
                                            />
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <FormField
                                            control={form.control}
                                            name="device_id"
                                            render={({ field }) => (
                                                <LabeledSelect
                                                    label="Dispositivo de Terminal"
                                                    placeholder="Sin dispositivo integrado"
                                                    value={field.value || ""}
                                                    onChange={field.onChange}
                                                    options={[
                                                        { value: "none", label: "Ninguno (Manual)" },
                                                        ...allDevices.map(dev => ({
                                                            value: dev.id.toString(),
                                                            label: `${dev.name} (${dev.provider_name})`
                                                        }))
                                                    ]}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <FormSection title="Métodos de Pago Permitidos" icon={CreditCard} />

                                    <div className="px-2 lg:px-6 space-y-4">
                                        {typeOrder.map(type => {
                                            const groupMethods = methodsGrouped[type] || []
                                            if (groupMethods.length === 0) return null

                                            return (
                                                <div key={type} className="space-y-4">
                                                    <div className="flex items-center gap-3 text-muted-foreground/70 pl-1">
                                                        {type === 'CASH' && <Banknote className="h-4 w-4" />}
                                                        {type === 'TERMINAL' && <Smartphone className="h-4 w-4" />}
                                                        {type === 'CARD' && <CreditCard className="h-4 w-4" />}
                                                        {type === 'TRANSFER' && <Landmark className="h-4 w-4" />}
                                                        {type === 'CHECK' && <FileCheck className="h-4 w-4" />}
                                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em]">
                                                            {getTypeLabel(type)}
                                                        </h4>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {groupMethods.map((method) => {
                                                            const isSelected = selectedMethodIds.includes(method.id)
                                                            return (
                                                                <div
                                                                    key={method.id}
                                                                    onClick={() => toggleMethod(method.id)}
                                                                    className={cn(
                                                                        "flex items-center space-x-3 p-3 rounded-md border transition-all group",
                                                                        isView ? "cursor-default opacity-70" : "cursor-pointer",
                                                                        isSelected
                                                                            ? "bg-primary/5 border-primary/40 shadow-card ring-1 ring-primary/20"
                                                                            : "bg-background hover:bg-muted/30 border-border/60 hover:border-border"
                                                                    )}
                                                                >
                                                                    <Checkbox
                                                                        checked={isSelected}
                                                                        disabled={isView}
                                                                        onCheckedChange={() => toggleMethod(method.id)}
                                                                        variant="circle"
                                                                    />
                                                                    <div className="flex flex-col">
                                                                        <span className={cn(
                                                                            "text-sm font-semibold transition-colors",
                                                                            isSelected ? "text-foreground" : "text-muted-foreground"
                                                                        )}>
                                                                            {method.name}
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-foreground/70 font-medium">
                                                                            {`Cta: ${method.treasury_account_name}`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </fieldset>
                        </form>
                    </Form>
                </FormSplitLayout>
            </Drawer>
        </>
    )
}

export default PosTerminalDrawer
