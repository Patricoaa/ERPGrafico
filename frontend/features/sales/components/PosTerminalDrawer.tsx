"use client"

import { useState } from "react"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { showApiError } from "@/lib/errors"
import { toast } from "sonner"
import {Banknote, CreditCard, Landmark, Smartphone, FileCheck, CircleHelp, Link2, Lock, Settings2, type LucideIcon} from "lucide-react"
import { usePaymentMethods, useTerminalDevices, type Terminal, type TerminalCreatePayload, type TerminalUpdatePayload } from "@/features/treasury"
import { treasuryApi } from "@/features/treasury"
import { Form, FormField } from "@/components/ui/form"
import { Drawer, Banner, CancelButton, LabeledInput, LabeledSelect, FormFooter, DrawerLayout, FormSelectionGroup, SubmitButton, Section } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { EntitySidebar } from "@/features/comments"
import { DocumentRelationsTab, useDocumentRelations, type DocumentDomain } from "@/features/documents"
import { useDrawerIdentity, useDrawerMode, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"

/** Etiqueta documental del modelo POSTerminal en el backend (relaciones con sus sesiones). */
const TERMINAL_RELATIONS_LABEL = "treasury.posterminal"

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
    const { mode, isView } = useDrawerMode({ mode: modeProp, initialData: terminal })
    // Con una sesión POS abierta la caja no se modifica ni se archiva (el backend lo rechaza igual).
    const sessionLocked = !!terminal?.pos_session_locked
    const { printRef, handlePrint } = usePrintableDrawer()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState("config")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)
    const { data: relations } = useDocumentRelations(TERMINAL_RELATIONS_LABEL, terminal?.id ?? null)
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

    useInitializeDrawerForm({
        form,
        open,
        initialData: terminal,
        mapData: (data) => {
            setSelectedMethodIds(data.allowed_payment_methods?.map(m => m.id) ?? [])
            return {
                name: data.name,
                code: data.code,
                location: data.location || "",
                serial_number: data.serial_number || "",
                ip_address: data.ip_address || "",
                device_id: (() => {
                    const dId = data.payment_terminal_device;
                    return typeof dId === 'object' && dId !== null ? (dId as { id: number }).id.toString() : dId?.toString() || "";
                })(),
            }
        },
        defaultValues: () => {
            setSelectedMethodIds([])
            return {
                name: "",
                code: "",
                location: "",
                serial_number: "",
                ip_address: "",
                device_id: "",
            }
        },
    })

    const handlePaymentMethodsChange = (methodIds: Array<string | number>) => {
        const nextIds = methodIds.map(Number)
        const selectedCashMethods = allMethods.filter(method =>
            nextIds.includes(method.id) && method.method_type === 'CASH'
        )
        if (selectedCashMethods.length > 1) {
            toast.warning("Solo se puede seleccionar 1 método de EFECTIVO (Caja) por punto de venta.")
            return
        }
        setSelectedMethodIds(nextIds)
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
                toast.success("Punto de Venta actualizado correctamente")
            } else {
                await treasuryApi.createTerminal(payload as unknown as TerminalCreatePayload)
                toast.success("Punto de Venta creado correctamente")
            }
            onSuccess?.()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al guardar el punto de venta")
        } finally {
            setIsSubmitting(false)
        }
    }

    const typeOrder = ['CASH', 'CARD', 'TRANSFER', 'CHECK', 'OTHER']
    const typeIcons: Record<string, LucideIcon> = {
        CASH: Banknote,
        TERMINAL: Smartphone,
        CARD: CreditCard,
        TRANSFER: Landmark,
        CHECK: FileCheck,
        OTHER: CircleHelp,
    }

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'CASH': 'Efectivo',
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
                <span>{terminal ? "Modifique la configuración del punto de venta y revise su historial." : "Configuración del punto de venta y asignación de métodos de pago."}</span>
            </div>
        ),
        onPrint: handlePrint,
        printable: !!terminal?.id && (mode === 'view' || mode === 'edit'),
    })

    return (
        <>
            {terminal?.id && (mode === 'view' || mode === 'edit') && (
                <PrintableLayout
                    ref={printRef}
                    title="Terminal"
                    displayId={terminal.code ? `#${terminal.code}` : `#${terminal.id}`}
                >
                    <div className="text-4xs space-y-1 mb-2">
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
                fillContent
                contentClassName="p-0"
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("complex", !!terminal)}
                mode={mode}
                title={identity.title}
                icon={identity.icon}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} />
                                <SubmitButton type="submit" form="terminal-form" loading={isSubmitting} disabled={isSubmitting || sessionLocked}>
                                    {mode === 'create' ? "Crear Punto de Venta" : "Guardar Cambios"}
                                </SubmitButton>
                            </>
                        }
                    />
                )}
            >
                <Form {...form}>
                    <form id="terminal-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 w-full h-full flex flex-col min-h-0 overflow-visible">
                        <DrawerLayout
                            contentDisabled={isView || sessionLocked}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            rightRail={terminal?.id ? (
                                <EntitySidebar
                                    entityType="terminal"
                                    entityId={terminal.id}
                                    className="h-full border-none"
                                    title="Historial"
                                />
                            ) : undefined}
                            rightRailCollapsible
                            rightRailStorageKey="erpgrafico.drawer.sidebar.terminal_pos"
                            className="min-w-0 h-full overflow-hidden"
                            tabs={[
                                {
                                    value: "config",
                                    label: "Configuración",
                                    icon: Settings2,
                                    content: (
                                        <div className="space-y-6 p-6">
                                            {sessionLocked && (
                                                <Banner tone="warning" icon={Lock} bleed="lg" title="Sesión POS abierta">
                                                    Esta caja no se puede modificar ni archivar hasta cerrar su sesión. Lo mismo vale para sus
                                                    métodos de pago, cuentas de tesorería y cuentas contables vinculadas.
                                                </Banner>
                                            )}
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <LabeledInput
                                                label="Nombre"
                                                required
                                                {...field}
                                                placeholder="Ej: Mostrador Principal"
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
                                    
                                    <FormField
                                            control={form.control}
                                            name="device_id"
                                            render={({ field }) => (
                                                <LabeledSelect
                                                    label="Terminal de cobro"
                                                    placeholder="Sin terminal de cobro"
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


                                <div className="space-y-6">
                                    <Section.Header spaced title="Métodos de Pago Permitidos" icon={CreditCard} />

                                    <div className="space-y-6">
                                        {typeOrder.map(type => {
                                            const groupMethods = methodsGrouped[type] || []
                                            if (groupMethods.length === 0) return null

                                            const TypeIcon = typeIcons[type]
                                            return (
                                                <FormSelectionGroup
                                                    key={type}
                                                    mode="multiple"
                                                    label={getTypeLabel(type)}
                                                    icon={TypeIcon ? <TypeIcon className="h-4 w-4" /> : undefined}
                                                    columns={2}
                                                    value={selectedMethodIds}
                                                    onChange={handlePaymentMethodsChange}
                                                    disabled={isView}
                                                    items={groupMethods.map((method) => ({
                                                        value: method.id,
                                                        label: method.name,
                                                        eyebrow: `Cta: ${method.treasury_account_name}`,
                                                    }))}
                                                />
                                            )
                                        })}
                                    </div>
                                </div>
                                        </div>
                                    ),
                                },
                                ...(terminal?.id ? [{
                                    value: "relations",
                                    label: "Relaciones",
                                    icon: Link2,
                                    badge: relations?.relations.length,
                                    content: (
                                        <DocumentRelationsTab
                                            label={TERMINAL_RELATIONS_LABEL}
                                            id={terminal.id}
                                            sectionActions={{}}
                                            rowActions={() => []}
                                            domain={domain}
                                            onDomainChange={setDomain}
                                        />
                                    ),
                                }] : []),
                            ]}
                        />
                    </form>
                </Form>
            </Drawer>
        </>
    )
}

export default PosTerminalDrawer
