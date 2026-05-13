"use client"

import { useEffect, useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useWindowWidth } from "@/hooks/useWindowWidth"
import { useFormWithToast } from "@/hooks/use-form-with-toast"
import * as z from "zod"
import { BaseModal } from "@/components/shared/BaseModal"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,

} from "@/components/ui/form"
import { SubmitButton, CancelButton } from "@/components/shared/ActionButtons"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import api from "@/lib/api"
import { Contact, InsightsData } from "../types"
import { Order } from "../../orders/types"
import { toast } from "sonner"
import { formatRUT, validateRUT } from "@/lib/utils/format"
import { useContactMutations, useContactInsights } from "@/features/contacts"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ShoppingCart, Package, Wand2, User, Banknote, Scale, Truck, Receipt, ClipboardList, LayoutDashboard, Calendar, ArrowRight, Mail, MapPin } from "lucide-react"
import { OrderCard } from "@/features/orders/components/OrderCard"

import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { Separator } from "@/components/ui/separator"
import { DataTable } from "@/components/ui/data-table"
import { OrderHubStatus } from "@/features/orders/components/OrderHubStatus"
import { ColumnDef } from "@tanstack/react-table"
import { Card, CardContent } from "@/components/ui/card"
import { getHubStatuses } from '@/features/orders/utils/status'
import { TableSkeleton, LabeledInput, FormTabs, FormTabsContent, type FormTabItem, FormFooter, FormSection, FormSplitLayout } from "@/components/shared"

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

interface ContactModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact?: Contact | null
    onSuccess: (contact?: Contact) => void
}

export default function ContactModal({ open, onOpenChange, contact, onSuccess }: ContactModalProps) {
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

    const { data: defaultCustomer } = useQuery({
        queryKey: ['defaultCustomer'],
        queryFn: async () => {
            const res = await api.get("/contacts/?is_default_customer=true")
            return res.data.results?.[0] || res.data?.[0] || null
        },
        enabled: open
    })

    const { data: defaultVendor } = useQuery({
        queryKey: ['defaultVendor'],
        queryFn: async () => {
            const res = await api.get("/contacts/?is_default_vendor=true")
            return res.data.results?.[0] || res.data?.[0] || null
        },
        enabled: open
    })

    const { data: contactDetails } = useQuery({
        queryKey: ['contactDetails', c?.id],
        queryFn: async () => {
            const res = await api.get(`/contacts/${c?.id}/`)
            return res.data
        },
        enabled: open && !!c?.id && !c.name
    })

    useEffect(() => {
        if (contactDetails) {
            form.reset({
                name: contactDetails.name || "",
                tax_id: contactDetails.tax_id || "",
                email: contactDetails.email || "",
                phone: contactDetails.phone || "",
                address: contactDetails.address || "",
                city: contactDetails.city || "",
                payment_terms: contactDetails.payment_terms || "CONTADO",
                is_default_customer: !!contactDetails.is_default_customer,
                is_default_vendor: !!contactDetails.is_default_vendor,
            })
        }
    }, [contactDetails, form])

    const { data: ledgerData = [], isLoading: loadingLedger, refetch: fetchLedger } = useQuery({
        queryKey: ['contactLedger', c?.id],
        queryFn: async () => {
            const res = await api.get(`/contacts/${c?.id}/credit_ledger/`)
            return res.data
        },
        enabled: open && !!c?.id && activeTab === "credit"
    })

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
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={c ? "Editar Contacto" : "Nuevo Contacto"}
            size="xl"
            className="h-[90vh]"
            headerClassName="sr-only"
            hideScrollArea={true}
            allowOverflow={true}
            contentClassName="p-0"
            footer={
                <FormFooter 
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting} />
                            <SubmitButton form="contact-form" loading={form.formState.isSubmitting}>
                                {c ? "Guardar Cambios" : "Crear Contacto"}
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>

                <form id="contact-form" onSubmit={form.handleSubmit(onSubmit)} className="flex-1 w-full h-full flex flex-col min-h-0 overflow-visible">
                    <FormTabs
                        items={tabItems}
                        value={activeTab}
                        onValueChange={setActiveTab}
                        orientation="vertical"
                        header={
                            <div className="flex flex-col p-6 pb-2">
                                <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-3">
                                    <User className="h-6 w-6 text-primary" />
                                    {c ? "Editar Contacto" : "Nuevo Contacto"}
                                </h1>
                                <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
                                    Ficha Maestra <span className="opacity-30">|</span> CRM & Finanzas
                                </div>
                            </div>
                        }
                        className="flex-1"
                        contentClassName="bg-transparent"
                    >
                                <FormTabsContent value="profile" className="h-full w-full flex-1 flex flex-col m-0 p-0 border-0 outline-none">
                                    <FormSplitLayout
                                        sidebar={contact?.id ? <ActivitySidebar entityId={contact.id.toString()} entityType="contact" /> : undefined}
                                        showSidebar={!!contact?.id}
                                    >
                                        <div className="space-y-6 px-4 pb-4 pt-2">
                                            <div className="space-y-4">
                                                <FormSection title="Estado y Roles" icon={Scale} />
                                                <div className="flex items-center gap-8 p-6 bg-muted/5 rounded-md border border-primary/5">
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
                                    </FormSplitLayout>
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
                </form>
            </Form>

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
        </BaseModal>
    )
}

interface InsightsTableProps {
    data: any[]
    type: 'sale' | 'purchase' | 'work_order'
    title: string
    icon: React.ElementType
    onActionSuccess?: () => void
}

function InsightsTable({ data, type, title, icon: Icon, onActionSuccess }: InsightsTableProps) {
    const { openWorkOrder } = useGlobalModals()
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
                
                return <DataCell.DocumentId label={label} data={row.original} />;
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
                return <OrderHubStatus order={item} />
            }
        },
        createActionsColumn<Record<string, unknown>>({
            renderActions: (item) => (
                <DataCell.Action
                    icon={LayoutDashboard}
                    title="Gestionar Documento"
                    onClick={() => {
                        const i = item as any
                        if (type === 'work_order') {
                            openWorkOrder(i.id)
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
                {/* 1. Total Card (Available for all types) */}
                <Card
                    className={`cursor-pointer transition-all hover:bg-muted/50 border-none shadow-sm rounded-md ${activeFilter === 'all' ? 'ring-2 ring-primary ring-offset-2' : 'bg-muted/5'}`}
                    onClick={() => setActiveFilter('all')}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Total</p>
                            <p className="text-2xl font-bold">{metrics.total}</p>
                        </div>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                </Card>

                {/* Sales/Purchase Specific Cards */}
                {type !== 'work_order' && (
                    <>
                        {/* 2. Financial Card (Accounts Receivable/Payable) */}
                        <Card
                            className={`cursor-pointer transition-all hover:bg-destructive/10/50 border-none shadow-sm rounded-md ${activeFilter === 'financial' ? 'ring-2 ring-destructive ring-offset-2' : 'bg-destructive/10/20'}`}
                            onClick={() => setActiveFilter('financial')}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-destructive/70 tracking-wider mb-1">
                                        {type === 'sale' ? 'Por Cobrar' : 'Por Pagar'}
                                    </p>
                                    <p className="text-lg font-bold text-destructive">
                                        ${metrics.totalPendingMoney.toLocaleString()}
                                    </p>
                                    <p className="text-[9px] text-destructive/60 font-medium">
                                        {metrics.pendingPaymentCount} documentos
                                    </p>
                                </div>
                                <Banknote className="h-4 w-4 text-muted-foreground" />
                            </CardContent>
                        </Card>

                        {/* 3. Logistics Card */}
                        <Card
                            className={`cursor-pointer transition-all hover:bg-warning/10/50 border-none shadow-sm rounded-md ${activeFilter === 'logistics' ? 'ring-2 ring-warning ring-offset-2' : 'bg-white'}`}
                            onClick={() => setActiveFilter('logistics')}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-warning/70 tracking-wider mb-1">
                                        {type === 'sale' ? 'Despacho Pdte.' : 'Recepción Pdte.'}
                                    </p>
                                    <p className="text-2xl font-bold text-warning">
                                        {metrics.pendingLogisticsCount}
                                    </p>
                                </div>
                                <Truck className="h-4 w-4 text-muted-foreground" />
                            </CardContent>
                        </Card>

                        {/* 4. Billing Card */}
                        <Card
                            className={`cursor-pointer transition-all hover:bg-primary/10/50 border-none shadow-sm rounded-md ${activeFilter === 'billing' ? 'ring-2 ring-primary ring-offset-2' : 'bg-white'}`}
                            onClick={() => setActiveFilter('billing')}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-primary/70 tracking-wider mb-1">
                                        Facturación Pdte.
                                    </p>
                                    <p className="text-2xl font-bold text-primary">
                                        {metrics.pendingBillingCount}
                                    </p>
                                </div>
                                <Receipt className="h-4 w-4 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </>
                )}

                {/* Work Order Specific Card */}
                {type === 'work_order' && (
                    <Card
                        className={`cursor-pointer transition-all hover:bg-primary/10/50 border-none shadow-sm rounded-md ${activeFilter === 'pending' ? 'ring-2 ring-primary ring-offset-2' : 'bg-primary/10/20'}`}
                        onClick={() => setActiveFilter('pending')}
                    >
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold uppercase text-primary/70 tracking-wider mb-1">
                                    En Proceso / Pdte
                                </p>
                                <p className="text-2xl font-bold text-primary">
                                    {metrics.pendingWOCount}
                                </p>
                            </div>
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        </CardContent>
                    </Card>
                )}
            </div>

            <FormSection title={title} icon={Icon} className="pb-6" />
            <div className="flex-1 overflow-hidden p-0">
                <DataTable
                    columns={columns}
                    data={filteredData}
                    defaultPageSize={10}
                    globalFilterFields={["display_id", "number"]}
                    showToolbarSort={true}
                    renderCustomView={(table) => (
                        <div className="grid gap-3 pt-2">
                            {table.getRowModel().rows.map((row: any) => (
                                <OrderCard
                                    key={row.original.id}
                                    item={row.original}
                                    type={type}
                                    onActionClick={() => {
                                        if (type === 'work_order') {
                                            openWorkOrder(row.original.id)
                                        } else {
                                            openHub({ orderId: row.original.id, type: type === 'purchase' ? 'purchase' : 'sale', onActionSuccess })
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    )}
                />
            </div>
        </div>
    )
}

function CreditLedgerTable({ data, loading, onActionSuccess }: { data: Order[], loading: boolean, onActionSuccess?: () => void }) {
    const { openHub } = useHubPanel()

    if (loading) {
        return <TableSkeleton rows={5} columns={4} />
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12 bg-muted/5 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">No hay documentos con deuda pendiente.</p>
            </div>
        )
    }

    const columns: ColumnDef<Order>[] = [
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => <DataCell.Date value={row.original.date} />,
        },
        {
            accessorKey: "number",
            header: "Número",
            cell: ({ row }) => <DataCell.DocumentId label="sales.saleorder" data={row.original} />,
        },
        {
            accessorKey: "balance",
            header: "Saldo",
            cell: ({ row }) => <DataCell.Currency value={row.original.balance} className="text-left font-bold text-destructive" />,
        },
        {
            id: "status",
            header: "Estados",
            cell: ({ row }) => <OrderHubStatus order={row.original} />
        }
    ]

    return (
        <div className="space-y-4">


            <div className="flex-1 overflow-hidden p-0">
                <DataTable
                    columns={columns}
                    data={data}
                    defaultPageSize={10}
                    globalFilterFields={["display_id", "number"]}
                    showToolbarSort={true}
                    renderCustomView={(table) => (
                        <div className="grid gap-3 pt-2">
                            {table.getRowModel().rows.map((row) => (
                                <OrderCard
                                    key={row.id as string}
                                    item={row.original as Order}
                                    type="ledger"
                                    onActionClick={() => openHub({ orderId: (row.original as Order).id, type: 'sale', onActionSuccess })}
                                />
                            ))}
                        </div>
                    )}
                />
            </div>
        </div>
    )
}
