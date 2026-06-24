"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useFormWithToast } from "@/hooks/useFormWithToast"
import * as z from "zod"
import { ActionConfirmModal, DomainHubStatus, Drawer, StatCard, StatusBadge } from '@/components/shared'
import { formDrawerWidth } from "@/lib/form-widths"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { ActionSlideButton, CancelButton } from "@/components/shared"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useContact, useContactCreditLedger } from "../hooks/useContacts"
import { Contact, InsightsData } from "../types"
import { formatRUT, validateRUT } from "@/lib/utils/format"
import { useContactMutations, useContactInsights } from "@/features/contacts"
import { useDefaultCustomer, useDefaultVendor } from "../hooks/useContactDefaults"

import { ActivitySidebar } from "@/features/audit/components"

import {ShoppingCart, Package, Wand2, User, Banknote, Scale, Truck, Receipt, ClipboardList, Mail, MapPin, Printer} from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared/transaction-drawer"
import type { DrawerMode } from "@/features/_shared/drawer/types"
import { createDomainCardView } from "@/lib/view-helpers"
import { DataCell, EmptyState, Chip } from '@/components/shared'
import { contactDocumentActions, type ContactDocumentActionsCtx } from './contactDocumentActions'

import { DataTable } from '@/components/shared'

import { ColumnDef } from "@tanstack/react-table"

import { getHubStatuses } from '@/features/orders/utils/status'
import { LabeledInput, LabeledContainer, LabeledCheckboxGroup, TabBar, TabBarContent, type TabItem, FormFooter, FormSection, FormSplitLayout, SkeletonShell } from "@/components/shared"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/money"

const contactSchema = z.object({
    name: z.string().min(2, "El nombre es requerido"),
    tax_id: z.string().min(1, "El RUT es requerido").refine(validateRUT, "RUT inválido"),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),

    is_default_customer: z.boolean(),
    is_default_vendor: z.boolean(),
    payment_terms: z.string().optional(),
})

interface ContactDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact?: Contact | null
    onSuccess: (contact?: Contact) => void
    mode?: DrawerMode
}

export default function ContactDrawer({ open, onOpenChange, contact, onSuccess, mode: modeProp }: ContactDrawerProps) {
    const [confirmReplacement, setConfirmReplacement] = useState<{ type: 'customer' | 'vendor' | null, name: string }>({ type: null, name: "" })
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [pendingValues, setPendingValues] = useState<z.infer<typeof contactSchema> | null>(null)

    const mode: DrawerMode = modeProp ?? (contact ? 'edit' : 'create')
    const isView = mode === 'view'
    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const [activeTab, setActiveTab] = useState("profile")
    const c = contact
    const { createContact, updateContact } = useContactMutations()
    const { data: insightsData, isLoading: loadingInsights, refetch: refetchInsights } = useContactInsights(c?.id)
    const ins = insightsData as InsightsData | undefined

    const form = useFormWithToast<z.infer<typeof contactSchema>>({
        schema: contactSchema,
        defaultValues: c ? {
            name: (c.name || "") as string,
            tax_id: (c.tax_id || "") as string,
            email: (c.email || "") as string,
            phone: (c.phone || "") as string,
            address: (c.address || "") as string,
            city: (c.city || "") as string,
            payment_terms: (c.payment_terms || "CONTADO") as string,
            is_default_customer: !!c.is_default_customer,
            is_default_vendor: !!c.is_default_vendor,
        } : {
            name: "",
            tax_id: "",
            email: "",
            phone: "",
            address: "",
            city: "",
            is_default_customer: false,
            is_default_vendor: false,
        },
    })

    const { data: defaultCustomer } = useDefaultCustomer(open)
    const { data: defaultVendor } = useDefaultVendor(open)

    const { data: contactDetails, isLoading: isLoadingContact } = useContact(c?.id && !c.name ? c.id : undefined)

    const isFetchingInitialData = open && (loadingInsights || isLoadingContact)

    useEffect(() => {
        if (contactDetails) {
            form.reset({
                name: (contactDetails as any).name || "",
                tax_id: (contactDetails as any).tax_id || "",
                email: (contactDetails as any).email || "",
                phone: (contactDetails as any).phone || "",
                address: (contactDetails as any).address || "",
                city: (contactDetails as any).city || "",
                payment_terms: (contactDetails as any).payment_terms || "CONTADO",
                is_default_customer: !!(contactDetails as any).is_default_customer,
                is_default_vendor: !!(contactDetails as any).is_default_vendor,
            })
        }
    }, [contactDetails, form])

    const { data: ledgerData = [], isLoading: loadingLedger, refetch: fetchLedger } = useContactCreditLedger(c?.id && activeTab === "credit" ? c.id : undefined)

    const handleActionSuccess = () => {
        refetchInsights()
        fetchLedger()
    }

    useEffect(() => {
        if (!open) {
            requestAnimationFrame(() => {
                setActiveTab("profile")
            })
            return
        }
        requestAnimationFrame(() => {
            if (c && c.name) {
                form.reset({
                    name: c.name as string,
                    tax_id: (c.tax_id || "") as string,
                    email: (c.email || "") as string,
                    phone: (c.phone || "") as string,
                    address: (c.address || "") as string,
                    city: (c.city || "") as string,
                    payment_terms: (c.payment_terms || "CONTADO") as string,
                    is_default_customer: !!c.is_default_customer,
                    is_default_vendor: !!c.is_default_vendor,
                })
            } else if (!c?.id) {
                form.reset({
                    name: "",
                    tax_id: "",
                    email: "",
                    phone: "",
                    address: "",
                    city: "",
                    payment_terms: "CONTADO",
                    is_default_customer: false,
                    is_default_vendor: false,
                })
            }
        })
    }, [c, open, form.reset])

    const saveContact = async (values: z.infer<typeof contactSchema>) => {
        try {
            let savedContact;
            if (c?.id) {
                savedContact = await updateContact({ id: c.id as number, payload: values as any })
            } else {
                savedContact = await createContact(values as any)
            }
            onSuccess(savedContact as Contact)
            onOpenChange(false)
        } catch {
            // Error handled by hook
        }
    }

    const onSubmit = async (values: z.infer<typeof contactSchema>) => {
        if (values.is_default_customer && defaultCustomer && (defaultCustomer as any).id !== c?.id) {
            setPendingValues(values)
            setConfirmReplacement({ type: 'customer', name: (defaultCustomer as any).name })
            setIsConfirmModalOpen(true)
            return
        }

        if (values.is_default_vendor && defaultVendor && (defaultVendor as any).id !== c?.id) {
            setPendingValues(values)
            setConfirmReplacement({ type: 'vendor', name: (defaultVendor as any).name })
            setIsConfirmModalOpen(true)
            return
        }

        await saveContact(values)
    }

    const tabItems: TabItem[] = [
        {
            value: "profile",
            label: "Perfil",
            icon: User,
        },
        {
            value: "sales",
            label: "Cliente",
            icon: ShoppingCart,
            badge: insightsData?.sales?.count || 0,
        },
        {
            value: "purchases",
            label: "Proveedor",
            icon: Package,
            badge: insightsData?.purchases?.count || 0,
        },
        {
            value: "work_orders",
            label: "Relacionado",
            icon: Wand2,
            badge: insightsData?.work_orders?.count || 0,
        },
        {
            value: "credit",
            label: "Crédito",
            icon: Banknote,
            hidden: !c?.id,
        },
    ]

    const drawerTitle = isView
        ? `Ficha de Contacto${contact?.id ? ` #${contact.id}` : ""}`
        : mode === 'create'
            ? "Nuevo Contacto"
            : "Editar Contacto"

    return (
        <>
            {contact?.id && (mode === 'view' || mode === 'edit') && (
                <PrintableLayout
                    ref={printRef}
                    title="Contact"
                    displayId={`#${contact.id}`}
                >
                    <div className="text-[9px] space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Nombre:</span>
                            <span>{contact?.name ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>RUT:</span>
                            <span>{contact?.tax_id ?? '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Email:</span>
                            <span>{contact?.email ?? '-'}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                icon={User}
                title={<span>{drawerTitle}</span>}
                headerActions={contact?.id && (mode === 'view' || mode === 'edit') && <Button variant="ghost" size="icon" onClick={() => handlePrint()}><Printer className="h-4 w-4" /></Button>}
                subtitle="Ficha Maestra • CRM & Finanzas"
                defaultSize={formDrawerWidth("master", !!c)}
                className="h-[90vh]"
                contentClassName="p-0"
                mode={mode}
                side="left"
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting} />
                                <ActionSlideButton type="submit" form="contact-form" loading={form.formState.isSubmitting}>
                                    {mode === 'create' ? "Crear Contacto" : "Guardar Cambios"}
                                </ActionSlideButton>
                            </>
                        }
                    />
                )}
            >
            <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando ficha de contacto" className="flex-1 flex flex-col h-full">
                <Form {...form}>

                    <form id="contact-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 w-full h-full flex flex-col min-h-0 overflow-visible">
                        <fieldset disabled={isView} className="contents">
                        <FormSplitLayout
                            showSidebar={!!contact?.id}
                            sidebar={contact?.id ? (
                                <ActivitySidebar entityId={contact.id.toString()} entityType="contact" />
                            ) : undefined}
                            className="min-w-0 h-full overflow-hidden p-0"
                        >
                            <TabBar
                                items={tabItems}
                                value={activeTab}
                                onValueChange={setActiveTab}
                                orientation="horizontal"
                                className="flex-1"
                                contentClassName="bg-transparent"
                            >
                                <TabBarContent
                                    value="profile"
                                    className="mt-0 pt-6 px-6 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin"
                                >
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <FormSection title="Roles" icon={Scale} />

                                            <LabeledContainer label="Preferencias Comerciales">
                                                <div className="py-0.5 space-y-0.5">
                                                    <FormField
                                                        control={form.control}
                                                        name="is_default_customer"
                                                        render={({ field }) => (
                                                            <div className="flex flex-col">
                                                                <div
                                                                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors hover:bg-muted/10"
                                                                    onClick={() => field.onChange(!field.value)}
                                                                >
                                                                    <Checkbox
                                                                        checked={field.value}
                                                                        onCheckedChange={field.onChange}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                    <span className={cn(
                                                                        "text-sm",
                                                                        field.value ? "text-foreground font-bold" : "text-muted-foreground/70"
                                                                    )}>
                                                                        Cliente por defecto
                                                                    </span>
                                                                </div>
                                                                {defaultCustomer && (defaultCustomer as any).id !== c?.id && (
                                                                    <span className="text-xs text-muted-foreground pl-9 pb-1">
                                                                        Actual: <strong>{(defaultCustomer as any).name}</strong>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="is_default_vendor"
                                                        render={({ field }) => (
                                                            <div className="flex flex-col">
                                                                <div
                                                                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors hover:bg-muted/10"
                                                                    onClick={() => field.onChange(!field.value)}
                                                                >
                                                                    <Checkbox
                                                                        checked={field.value}
                                                                        onCheckedChange={field.onChange}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                    <span className={cn(
                                                                        "text-sm",
                                                                        field.value ? "text-foreground font-bold" : "text-muted-foreground/70"
                                                                    )}>
                                                                        Proveedor por defecto
                                                                    </span>
                                                                </div>
                                                                {defaultVendor && (defaultVendor as any).id !== c?.id && (
                                                                    <span className="text-xs text-muted-foreground pl-9 pb-1">
                                                                        Actual: <strong>{(defaultVendor as any).name}</strong>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                            </LabeledContainer>

                                            <LabeledCheckboxGroup
                                                disabled
                                                columns={2}
                                                label="Roles del Contacto"
                                                items={[
                                                    { value: "CUSTOMER", label: "Cliente" },
                                                    { value: "SUPPLIER", label: "Proveedor" },
                                                    { value: "RELATED", label: "Relacionado" },
                                                    { value: "PARTNER", label: "Socio" },
                                                    { value: "EMPLOYEE", label: "Empleado" },
                                                    { value: "USER", label: "Usuario Sistema" },
                                                ]}
                                                value={c?.active_roles?.filter(r => r !== 'NONE') || []}
                                                onChange={() => {}}
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <FormSection title="Identidad del Contacto" icon={User} />
                                            <div className="grid grid-cols-4 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="name"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem className="col-span-2">
                                                            <FormControl>
                                                                <LabeledInput
                                                                    label="Nombre / Razón Social"
                                                                    required
                                                                    placeholder="Ej: Juan Pérez o Empresa SpA"
                                                                    error={fieldState.error?.message}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="tax_id"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem className="col-span-2">
                                                            <FormControl>
                                                                <LabeledInput
                                                                    label="RUT / Tax ID"
                                                                    required
                                                                    placeholder="12.345.678-9"
                                                                    error={fieldState.error?.message}
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(formatRUT(e.target.value))}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <FormSection title="Información de Contacto" icon={Mail} />
                                            <div className="grid grid-cols-4 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="email"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem className="col-span-2">
                                                            <FormControl>
                                                                <LabeledInput
                                                                    label="Email (opcional)"
                                                                    type="email"
                                                                    placeholder="ejemplo@correo.com"
                                                                    error={fieldState.error?.message}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="phone"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem className="col-span-2">
                                                            <FormControl>
                                                                <LabeledInput
                                                                    label="Teléfono (opcional)"
                                                                    placeholder="+56 9 ..."
                                                                    error={fieldState.error?.message}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <FormSection title="Ubicación" icon={MapPin} />
                                            <div className="grid grid-cols-4 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="address"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem className="col-span-3">
                                                            <FormControl>
                                                                <LabeledInput
                                                                    label="Dirección (opcional)"
                                                                    placeholder="Calle, Número, Depto"
                                                                    error={fieldState.error?.message}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="city"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem className="col-span-1">
                                                            <FormControl>
                                                                <LabeledInput
                                                                    label="Ciudad / Comuna (opcional)"
                                                                    placeholder="Santiago"
                                                                    error={fieldState.error?.message}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </TabBarContent>

                                <TabBarContent value="sales" className="h-full w-full flex-1 m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <InsightsTable
                                        data={insightsData?.sales?.orders || []}
                                        type="sale"
                                        title="Historial de Ventas (NV)"
                                        icon={ShoppingCart}
                                        onActionSuccess={handleActionSuccess}
                                    />
                                </TabBarContent>

                                <TabBarContent value="purchases" className="h-full w-full flex-1 m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <InsightsTable
                                        data={insightsData?.purchases?.orders || []}
                                        type="purchase"
                                        title="Historial de Compras (OC)"
                                        icon={Package}
                                        onActionSuccess={handleActionSuccess}
                                    />
                                </TabBarContent>

                                <TabBarContent value="work_orders" className="h-full w-full flex-1 m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <InsightsTable
                                        data={insightsData?.work_orders?.orders || []}
                                        type="work_order"
                                        title="Historial de Órdenes de Trabajo"
                                        icon={Wand2}
                                        onActionSuccess={handleActionSuccess}
                                    />
                                </TabBarContent>
                                <TabBarContent value="credit" className="h-full w-full flex-1 m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <CreditLedgerTable data={ledgerData} loading={loadingLedger} onActionSuccess={handleActionSuccess} />
                                </TabBarContent>
                            </TabBar>
                        </FormSplitLayout>
                    </fieldset>
                    </form>
                </Form>
            </SkeletonShell>

            <ActionConfirmModal
                open={isConfirmModalOpen}
                onOpenChange={setIsConfirmModalOpen}
                title="Cambiar preferencia comercial"
                variant="warning"
                onConfirm={() => {
                    if (pendingValues) saveContact(pendingValues)
                    setIsConfirmModalOpen(false)
                }}
                confirmText="Confirmar cambio"
                description={
                    <div className="space-y-2">
                        <p>
                            <strong>{confirmReplacement.name}</strong> es actualmente el {confirmReplacement.type === 'customer' ? 'cliente' : 'proveedor'} predeterminado.
                        </p>
                        <p>
                            Al guardar, <strong>{c?.name || 'este contacto'}</strong> lo reemplazará como {confirmReplacement.type === 'customer' ? 'cliente' : 'proveedor'} predeterminado.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Esta preferencia controla qué contacto se selecciona automáticamente al crear nuevas {confirmReplacement.type === 'customer' ? 'notas de venta' : 'órdenes de compra'}.
                        </p>
                    </div>
                }
            />
        </Drawer>
        </>
    )
}

interface InsightsTableProps {
    data: any[]
    type: 'sale' | 'purchase' | 'work_order'
    title: string
    icon: any
    onActionSuccess?: () => void
}

function InsightsTable({ data, type, title, icon: Icon, onActionSuccess }: InsightsTableProps) {
    const { openEntity } = useGlobalModals()
    const { openHub } = useHubPanel()
    const [activeFilter, setActiveFilter] = useState<'all' | 'financial' | 'logistics' | 'billing' | 'pending'>('all')

    // Metrics Calculation
    const metrics = useMemo(() => {
        const total = data.length

        // Financial (Pending Payment)
        const pendingPaymentItems = data.filter(item => parseFloat((item as any).pending_amount || "0") > 0)
        const totalPendingMoney = pendingPaymentItems.reduce((acc, item) => acc + parseFloat((item as any).pending_amount || "0"), 0)

        // Logistics (Pending Delivery/Receipt)
        // Uses simplified check: not fully delivered/received if items exist
        const pendingLogisticsItems = data.filter(item => {
            const status = getHubStatuses(item as any)
            return status.logistics === 'active' || status.logistics === 'neutral'
        })

        // Billing (Pending Invoice)
        const pendingBillingItems = data.filter(item => {
            const status = getHubStatuses(item)
            return status.billing !== 'success'
        })

        // Work Orders (Pending Completion)
        const pendingWorkOrders = data.filter(item => (item as any).status !== 'COMPLETED')

        return {
            total,
            pendingPaymentCount: pendingPaymentItems.length,
            totalPendingMoney,
            pendingLogisticsCount: pendingLogisticsItems.length,
            pendingBillingCount: pendingBillingItems.length,
            pendingWOCount: pendingWorkOrders.length
        }
    }, [data])

    // Filter Data
    const filteredData = useMemo(() => {
        switch (activeFilter) {
            case 'financial':
                return data.filter(item => parseFloat((item as any).pending_amount || "0") > 0)
            case 'logistics':
                return data.filter(item => {
                    const status = getHubStatuses(item)
                    return status.logistics === 'active' || status.logistics === 'neutral'
                })
            case 'billing':
                return data.filter(item => {
                    const status = getHubStatuses(item)
                    return status.billing !== 'success'
                })
            case 'pending': // For Work Orders
                return data.filter(item => (item as any).status !== 'COMPLETED')
            case 'all':
            default:
                return data
        }
    }, [data, activeFilter])

    const cardView = useMemo(() => {
        const label = type === 'sale' ? 'sales.saleorder' : type === 'purchase' ? 'purchasing.purchaseorder' : 'production.workorder'
        return createDomainCardView(label, {
            onRowClick: (data: any) => {
                if (type === 'work_order') {
                    openEntity('production.workorder', data.id)
                } else {
                    openHub({ orderId: data.id, type: type === 'purchase' ? 'purchase' : 'sale', onActionSuccess })
                }
            },
        })
    }, [type, openEntity, openHub, onActionSuccess])

    const contactDocumentActionsCtx: ContactDocumentActionsCtx = {
        onHub: (item) => {
            const i = item as any
            if (type === 'work_order') {
                openEntity('production.workorder', i.id)
            } else {
                openHub({ orderId: i.id, type: type === 'purchase' ? 'purchase' : 'sale' })
            }
        },
    }

    const columns: ColumnDef<Record<string, unknown>>[] = [
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => <DataCell.Date value={(row.original as any).date} />,
        },
        {
            accessorKey: "display_id",
            header: "Número",
            cell: ({ row }) => {
                let label = 'sales.saleorder';
                if (type === 'purchase') label = 'purchasing.purchaseorder';
                else if (type === 'work_order') label = 'production.workorder';

                return <DataCell.Entity label={label} data={row.original} />;
            },
        },
        ...(type !== 'work_order' ? [
            {
                accessorKey: "total",
                header: "Total",
                cell: ({ row }: { row: { original: any } }) => <DataCell.Currency value={row.original.total} className="text-left font-bold" />,
            }
        ] : []),
        {
            id: "status",
            header: "Estados",
            cell: ({ row }) => {
                const item = row.original as any
                if (type === 'work_order') {
                    return (
                        <StatusBadge status={item.status} size="sm" />
                    )
                }
                return <DomainHubStatus data={item} label={type === 'purchase' ? 'purchasing.purchaseorder' : 'sales.saleorder'} />
            }
        },
        contactDocumentActions.column(contactDocumentActionsCtx)
    ]

    return (
        <div className="flex flex-col h-full">
            {/* Summary Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <StatCard
                    label="Total"
                    value={metrics.total}
                    icon={Icon}
                    onClick={() => setActiveFilter('all')}
                    active={activeFilter === 'all'}
                    accent="primary"
                />
                {type !== 'work_order' && (
                    <>
                        <StatCard
                            label={type === 'sale' ? 'Por Cobrar' : 'Por Pagar'}
                            value={formatCurrency(metrics.totalPendingMoney)}
                            icon={Banknote}
                            subtext={`${metrics.pendingPaymentCount} documentos`}
                            onClick={() => setActiveFilter('financial')}
                            active={activeFilter === 'financial'}
                            accent="destructive"
                            valueSize="md"
                        />
                        <StatCard
                            label={type === 'sale' ? 'Despacho Pdte.' : 'Recepción Pdte.'}
                            value={metrics.pendingLogisticsCount}
                            icon={Truck}
                            onClick={() => setActiveFilter('logistics')}
                            active={activeFilter === 'logistics'}
                            accent="warning"
                        />
                        <StatCard
                            label="Facturación Pdte."
                            value={metrics.pendingBillingCount}
                            icon={Receipt}
                            onClick={() => setActiveFilter('billing')}
                            active={activeFilter === 'billing'}
                            accent="primary"
                        />
                    </>
                )}
                {type === 'work_order' && (
                    <StatCard
                        label="En Proceso / Pdte"
                        value={metrics.pendingWOCount}
                        icon={ClipboardList}
                        onClick={() => setActiveFilter('pending')}
                        active={activeFilter === 'pending'}
                        accent="primary"
                    />
                )}
            </div>

            <FormSection title={title} icon={Icon} className="pb-6" />
            <div className="flex-1 overflow-hidden p-0">
                    <DataTable
                        columns={columns}
                        data={filteredData}
                        variant="embedded"
                        defaultPageSize={10}
                        currentView="card"
                        renderCustomView={cardView}
                    />
            </div>
        </div>
    )
}

function CreditLedgerTable({ data, loading, onActionSuccess }: { data: any[], loading: boolean, onActionSuccess?: () => void }) {
    const { openHub } = useHubPanel()

    // Placeholder tipado para el ledger - sigue el patrón del contrato
    const LEDGER_SKELETON: any[] = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        display_id: "————————————",
        number: "————————————",
        date: "",
        total: 0,
        pending_amount: 0,
        balance: 0,
        status: "pending" as const,
        customer: { id: 0, name: "————————————" },
        supplier: { id: 0, name: "————————————" },
        customer_name: "————————————",
        supplier_name: "————————————",
        customer_id: 0,
        supplier_id: 0,
        lines: [],
        related_documents: {
            invoices: [],
            payments: [],
            deliveries: [],
            receptions: [],
            work_orders: [],
            returns: [],
            stock_moves: [],
            notes: []
        }
    }));

    if (!loading && !data.length) {
        return (
            <EmptyState
                context="finance"
                title="Sin documentos pendientes"
                description="No hay documentos con deuda pendiente para este contacto."
            />
        )
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => <DataCell.Date value={row.original.date} />,
        },
        {
            accessorKey: "number",
            header: "Número",
            cell: ({ row }) => <DataCell.Entity label="sales.saleorder" data={row.original} />,
        },
        {
            accessorKey: "balance",
            header: "Saldo",
            cell: ({ row }) => <DataCell.Currency value={row.original.balance} className="text-left font-bold text-destructive" />,
        },
        {
            id: "status",
            header: "Estados",
            cell: ({ row }) => <DomainHubStatus data={row.original} label="sales.saleorder" />
        }
    ]

    return (
        <SkeletonShell isLoading={loading} ariaLabel="Cargando libro de cuenta">
            <div className="space-y-4">
                <div className="flex-1 overflow-hidden p-0">
                    <DataTable
                        columns={columns}
                        data={loading ? LEDGER_SKELETON : data}
                        variant="embedded"
                        defaultPageSize={10}
                        currentView="card"
                        renderCustomView={createDomainCardView('sales.saleorder', {
                            onRowClick: (data: any) => openHub({ orderId: data.id, type: 'sale', onActionSuccess }),
                        })}
                    />
                </div>
            </div>
        </SkeletonShell>
    )
}
