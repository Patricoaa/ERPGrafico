"use client"

import { useEffect, useState, useMemo } from "react"
import { useFormWithToast } from "@/hooks/useFormWithToast"
import * as z from "zod"
import { Drawer } from "@/components/shared"
import { formDrawerWidth } from "@/lib/form-widths"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,

} from "@/components/ui/form"
import { ActionSlideButton, CancelButton } from "@/components/shared"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useContact, useContactCreditLedger } from "../hooks/useContacts"
import { Contact, InsightsData } from "../types"
import { Order } from "../../orders/types"
import { formatRUT, validateRUT } from "@/lib/utils/format"
import { useContactMutations, useContactInsights } from "@/features/contacts"
import { useDefaultCustomer, useDefaultVendor } from "../hooks/useContactDefaults"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { ActivitySidebar } from "@/features/audit/components"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ShoppingCart, Package, Wand2, User, Banknote, Scale, Truck, Receipt, ClipboardList, LayoutDashboard, Calendar, ArrowRight, Mail, MapPin } from "lucide-react"
import { createDomainCardView } from "@/lib/view-helpers"
import { DataCell, createActionsColumn, EmptyState, Chip } from '@/components/shared'
import { Separator } from "@/components/ui/separator"
import { DataTable } from '@/components/shared'
import { DomainHubStatus } from "@/components/shared/HubStatus"
import { ColumnDef } from "@tanstack/react-table"
import { StatCard } from "@/components/shared/StatCard"
import { getHubStatuses } from '@/features/orders/utils/status'
import { LabeledInput, FormTabs, FormTabsContent, type FormTabItem, FormFooter, FormSection, FormSplitLayout, SkeletonShell } from "@/components/shared"
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
    roles: z.array(z.string()).default([]),
})

interface ContactDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact?: Contact | null
    onSuccess: (contact?: Contact) => void
}

export default function ContactDrawer({ open, onOpenChange, contact, onSuccess }: ContactDrawerProps) {
    const [confirmReplacement, setConfirmReplacement] = useState<{ type: 'customer' | 'vendor' | null, name: string }>({ type: null, name: "" })
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [pendingValues, setPendingValues] = useState<z.infer<typeof contactSchema> | null>(null)

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
            roles: (c as any).roles || [],
        } : {
            name: "",
            tax_id: "",
            email: "",
            phone: "",
            address: "",
            city: "",
            is_default_customer: false,
            is_default_vendor: false,
            roles: [],
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
                roles: (contactDetails as any).roles || [],
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
                    roles: (c as any).roles || [],
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
                    roles: [],
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
        } catch (error) {
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

    const tabItems: FormTabItem[] = [
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

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            icon={User}
            title={c ? "Editar Contacto" : "Nuevo Contacto"}
            subtitle="Ficha Maestra • CRM & Finanzas"
            defaultSize={formDrawerWidth("master", !!c)}
            className="h-[90vh]"
            contentClassName="p-0"
            side="left"
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting} />
                            <ActionSlideButton type="submit" form="contact-form" loading={form.formState.isSubmitting}>
                                {c ? "Guardar Cambios" : "Crear Contacto"}
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <SkeletonShell isLoading={isFetchingInitialData} ariaLabel="Cargando ficha de contacto" className="flex-1 flex flex-col h-full">
                <Form {...form}>

                    <form id="contact-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 w-full h-full flex flex-col min-h-0 overflow-visible">
                        <FormSplitLayout
                            showSidebar={!!contact?.id}
                            sidebar={contact?.id ? (
                                <ActivitySidebar entityId={contact.id.toString()} entityType="contact" />
                            ) : undefined}
                            className="min-w-0 h-full overflow-hidden p-0"
                        >
                            <FormTabs
                                items={tabItems}
                                value={activeTab}
                                onValueChange={setActiveTab}
                                orientation="horizontal"
                                variant="underline"
                                className="flex-1"
                                contentClassName="bg-transparent"
                            >
                                <FormTabsContent
                                    value="profile"
                                    className="mt-0 pt-6 px-6 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin"
                                >
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <FormSection title="Estado y Roles" icon={Scale} />

                                            {/* Defaults Section */}
                                            <div className="flex items-center gap-8 p-4 bg-muted/5 rounded-md border border-primary/5">
                                                <FormField
                                                    control={form.control}
                                                    name="is_default_customer"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 group cursor-pointer">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <div className="space-y-0.5">
                                                                <FormLabel className="text-[11px] font-black uppercase tracking-widest cursor-pointer group-hover:text-primary transition-colors">
                                                                    Cliente por defecto
                                                                </FormLabel>
                                                            </div>
                                                        </FormItem>
                                                    )}
                                                />
                                                <Separator orientation="vertical" className="h-8" />
                                                <FormField
                                                    control={form.control}
                                                    name="is_default_vendor"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 group cursor-pointer">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <div className="space-y-0.5">
                                                                <FormLabel className="text-[11px] font-black uppercase tracking-widest cursor-pointer group-hover:text-primary transition-colors">
                                                                    Proveedor por defecto
                                                                </FormLabel>
                                                            </div>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            {/* Manual Roles Selection */}
                                            <FormField
                                                control={form.control}
                                                name="roles"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-2">
                                                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                                            Roles Manuales Asignados
                                                        </FormLabel>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                            {[
                                                                { id: "CUSTOMER", label: "Cliente", desc: "Permite emitir notas de venta y facturas" },
                                                                { id: "SUPPLIER", label: "Proveedor", desc: "Permite emitir órdenes de compra" },
                                                                { id: "RELATED", label: "Relacionado", desc: "Contacto para órdenes de trabajo" },
                                                                { id: "PARTNER", label: "Socio", desc: "Socio aportador de capital" },
                                                                { id: "CARRIER", label: "Transportista", desc: "Empresa de transportes o despacho" },
                                                            ].map((role) => {
                                                                const checked = field.value?.includes(role.id)
                                                                return (
                                                                    <div
                                                                        key={role.id}
                                                                        className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${checked
                                                                                ? "border-primary bg-primary/5 shadow-sm"
                                                                                : "border-muted hover:border-muted-foreground/30 bg-card"
                                                                            }`}
                                                                        onClick={() => {
                                                                            const nextValue = checked
                                                                                ? field.value.filter((v: string) => v !== role.id)
                                                                                : [...(field.value || []), role.id]
                                                                            field.onChange(nextValue)
                                                                        }}
                                                                    >
                                                                        <Checkbox
                                                                            id={`role-${role.id}`}
                                                                            checked={checked}
                                                                            onCheckedChange={(isChecked) => {
                                                                                const nextValue = isChecked
                                                                                    ? [...(field.value || []), role.id]
                                                                                    : field.value.filter((v: string) => v !== role.id)
                                                                                field.onChange(nextValue)
                                                                            }}
                                                                        />
                                                                        <div className="space-y-1 leading-none">
                                                                            <label
                                                                                htmlFor={`role-${role.id}`}
                                                                                className="text-sm font-semibold cursor-pointer"
                                                                            >
                                                                                {role.label}
                                                                            </label>
                                                                            <p className="text-[11px] text-muted-foreground">
                                                                                {role.desc}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* System/Dynamic Active Roles (Read-Only) */}
                                            {c?.active_roles && c.active_roles.some(r => r === 'USER' || r === 'EMPLOYEE') && (
                                                <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg bg-muted/20 border border-muted/50 mt-2">
                                                    <span className="text-xs text-muted-foreground font-semibold">Roles del sistema (automáticos):</span>
                                                    {c.active_roles.includes('USER') && (
                                                        <Chip.Category domain="contact_type" value="USER" size="xs" />
                                                    )}
                                                    {c.active_roles.includes('EMPLOYEE') && (
                                                        <Chip.Category domain="contact_type" value="EMPLOYEE" size="xs" />
                                                    )}
                                                </div>
                                            )}
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
                                                                    label="Email"
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
                                                                    label="Teléfono"
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
                                                                    label="Dirección"
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
                                                                    label="Ciudad / Comuna"
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
                                </FormTabsContent>

                                <FormTabsContent value="sales" className="h-full w-full flex-1 m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <InsightsTable
                                        data={insightsData?.sales?.orders || []}
                                        type="sale"
                                        title="Historial de Ventas (NV)"
                                        icon={ShoppingCart}
                                        onActionSuccess={handleActionSuccess}
                                    />
                                </FormTabsContent>

                                <FormTabsContent value="purchases" className="h-full w-full flex-1 m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <InsightsTable
                                        data={insightsData?.purchases?.orders || []}
                                        type="purchase"
                                        title="Historial de Compras (OC)"
                                        icon={Package}
                                        onActionSuccess={handleActionSuccess}
                                    />
                                </FormTabsContent>

                                <FormTabsContent value="work_orders" className="h-full w-full flex-1 m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <InsightsTable
                                        data={insightsData?.work_orders?.orders || []}
                                        type="work_order"
                                        title="Historial de Órdenes de Trabajo"
                                        icon={Wand2}
                                        onActionSuccess={handleActionSuccess}
                                    />
                                </FormTabsContent>
                                <FormTabsContent value="credit" className="h-full w-full flex-1 m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <CreditLedgerTable data={ledgerData} loading={loadingLedger} onActionSuccess={handleActionSuccess} />
                                </FormTabsContent>
                            </FormTabs>
                        </FormSplitLayout>
                    </form>
                </Form>
            </SkeletonShell>

            <ActionConfirmModal
                open={isConfirmModalOpen}
                onOpenChange={setIsConfirmModalOpen}
                title="Cambiar contacto por defecto"
                variant="warning"
                onConfirm={() => {
                    if (pendingValues) saveContact(pendingValues)
                    setIsConfirmModalOpen(false)
                }}
                confirmText="Confirmar cambio"
                description={
                    <div className="space-y-2">
                        <p>
                            El contacto <strong>{confirmReplacement.name}</strong> es actualmente el {confirmReplacement.type === 'customer' ? 'cliente' : 'proveedor'} por defecto.
                        </p>
                        <p>
                            Si continúa, el nuevo contacto pasará a ser el predeterminado y el anterior dejará de serlo.
                        </p>
                    </div>
                }
            />
        </Drawer>
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
        createActionsColumn<Record<string, unknown>>({
            renderActions: (item) => (
                <DataCell.Action
                    action="hub"
                    onClick={() => {
                        const i = item as any
                        if (type === 'work_order') {
                            openEntity('production.workorder', i.id)
                        } else {
                            openHub({ orderId: i.id, type: type === 'purchase' ? 'purchase' : 'sale' })
                        }
                    }}
                />
            )
        })
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
                    globalFilterFields={["display_id", "number"]}
                    showToolbarSort={true}
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
                        globalFilterFields={["display_id", "number"]}
                        showToolbarSort={true}
                        renderCustomView={createDomainCardView('sales.saleorder', {
                            onRowClick: (data: any) => openHub({ orderId: data.id, type: 'sale', onActionSuccess }),
                        })}
                    />
                </div>
            </div>
        </SkeletonShell>
    )
}
