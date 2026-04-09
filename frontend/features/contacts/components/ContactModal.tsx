"use client"

import { useEffect, useState, useMemo } from "react"
import { useWindowWidth } from "@/hooks/useWindowWidth"
import { useFormWithToast } from "@/hooks/use-form-with-toast"
import * as z from "zod"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatRUT, validateRUT } from "@/lib/utils/format"
import { useContactMutations, useContactInsights } from "@/features/contacts"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Package, Wand2, User, Banknote, Scale, Truck, Receipt, ClipboardList, LayoutDashboard, Calendar, ArrowRight, X } from "lucide-react"
import { OrderCard } from "@/features/orders/components/OrderCard"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from "@/components/ui/data-table-cells"
import { Separator } from "@/components/ui/separator"
import { DataTable } from "@/components/ui/data-table"
import { OrderHubStatus } from "@/features/orders/components/OrderHubStatus"
import { ColumnDef } from "@tanstack/react-table"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { CollapsibleSheet } from "@/components/shared/CollapsibleSheet"
import { Card, CardContent } from "@/components/ui/card"
import { getHubStatuses } from "@/lib/order-status-utils"
import { FORM_STYLES } from "@/lib/styles"

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
    contact?: any
    onSuccess: (contact?: any) => void
}

export default function ContactModal({ open, onOpenChange, contact, onSuccess }: ContactModalProps) {
    const [defaultCustomer, setDefaultCustomer] = useState<any>(null)
    const [defaultVendor, setDefaultVendor] = useState<any>(null)
    const [confirmReplacement, setConfirmReplacement] = useState<{ type: 'customer' | 'vendor' | null, name: string }>({ type: null, name: "" })
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [pendingValues, setPendingValues] = useState<z.infer<typeof contactSchema> | null>(null)

    const [activeTab, setActiveTab] = useState("profile")
    const [ledgerData, setLedgerData] = useState<any[]>([])
    const [loadingLedger, setLoadingLedger] = useState(false)

    const { createContact, updateContact } = useContactMutations()
    const { data: insightsData, isLoading: loadingInsights, refetch: refetchInsights } = useContactInsights(contact?.id)
    const { isSheetCollapsed } = useGlobalModals()
    const { closeHub } = useHubPanel()

    const windowWidth = useWindowWidth(150, open)

    const handleOpenChangeProxy = (newOpen: boolean) => {
        if (newOpen && isSheetCollapsed("CONTACT_DETAIL")) {
            // Jump behavior: Close Hub if we are opening from a collapsed tab
            closeHub()
        }
        onOpenChange(newOpen)
    }

    const fullWidth = Math.min(windowWidth * 0.90, 1600) // Match the 90vw logic

    const form = useFormWithToast<z.infer<typeof contactSchema>>({
        schema: contactSchema,
        defaultValues: contact ? {
            name: contact.name || "",
            tax_id: contact.tax_id || "",
            email: contact.email || "",
            phone: contact.phone || "",
            address: contact.address || "",
            city: contact.city || "",
            payment_terms: contact.payment_terms || "CONTADO",
            is_default_customer: !!contact.is_default_customer,
            is_default_vendor: !!contact.is_default_vendor,
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

    const fetchDefaults = async () => {
        try {
            const [custRes, vendRes] = await Promise.all([
                api.get("/contacts/?is_default_customer=true"),
                api.get("/contacts/?is_default_vendor=true")
            ])

            const cust = custRes.data.results?.[0] || custRes.data?.[0]
            const vend = vendRes.data.results?.[0] || vendRes.data?.[0]

            if (cust && cust.id !== contact?.id) setDefaultCustomer(cust)
            else setDefaultCustomer(null)

            if (vend && vend.id !== contact?.id) setDefaultVendor(vend)
            else setDefaultVendor(null)

        } catch (error) {
            console.error("Error fetching default contacts", error)
        }
    }

    useEffect(() => {
        if (open && contact?.id && !contact.name) {
            api.get(`/contacts/${contact.id}/`)
                .then(res => {
                    form.reset({
                        name: res.data.name || "",
                        tax_id: res.data.tax_id || "",
                        email: res.data.email || "",
                        phone: res.data.phone || "",
                        address: res.data.address || "",
                        city: res.data.city || "",
                        payment_terms: res.data.payment_terms || "CONTADO",
                        is_default_customer: !!res.data.is_default_customer,
                        is_default_vendor: !!res.data.is_default_vendor,
                    })
                })
                .catch(err => {
                    console.error("Error fetching contact details:", err)
                    toast.error("Error al cargar detalles del contacto")
                })
        }
    }, [open, contact?.id, contact?.name])

    const fetchLedger = () => {
        if (!contact?.id) return
        setLoadingLedger(true)
        api.get(`/contacts/${contact.id}/credit_ledger/`)
            .then(res => setLedgerData(res.data))
            .catch(err => {
                console.error("Error fetching credit ledger:", err)
                toast.error("Error al cargar el historial crediticio")
            })
            .finally(() => setLoadingLedger(false))
    }

    useEffect(() => {
        if (open && contact?.id && activeTab === "credit") {
            fetchLedger()
        }
    }, [open, contact?.id, activeTab])

    const handleActionSuccess = () => {
        refetchInsights()
        fetchLedger()
    }

    useEffect(() => {
        if (!open) {
            setActiveTab("profile")
            setLedgerData([])
            return
        }
        fetchDefaults()

        if (contact && contact.name) {
            form.reset({
                name: contact.name,
                tax_id: contact.tax_id || "",
                email: contact.email || "",
                phone: contact.phone || "",
                address: contact.address || "",
                city: contact.city || "",
                payment_terms: contact.payment_terms || "CONTADO",
                is_default_customer: !!contact.is_default_customer,
                is_default_vendor: !!contact.is_default_vendor,
            })
        } else if (!contact?.id) {
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
    }, [contact, open, form.reset])

    const saveContact = async (values: z.infer<typeof contactSchema>) => {
        try {
            let savedContact;
            if (contact) {
                savedContact = await updateContact({ id: contact.id, payload: values })
            } else {
                savedContact = await createContact(values as any)
            }
            onSuccess(savedContact)
            onOpenChange(false)
        } catch (error) {
            // Error handled by hook
        }
    }

    const onSubmit = async (values: z.infer<typeof contactSchema>) => {
        if (values.is_default_customer && defaultCustomer && defaultCustomer.id !== contact?.id) {
            setPendingValues(values)
            setConfirmReplacement({ type: 'customer', name: defaultCustomer.name })
            setIsConfirmModalOpen(true)
            return
        }

        if (values.is_default_vendor && defaultVendor && defaultVendor.id !== contact?.id) {
            setPendingValues(values)
            setConfirmReplacement({ type: 'vendor', name: defaultVendor.name })
            setIsConfirmModalOpen(true)
            return
        }

        await saveContact(values)
    }

    return (
        <CollapsibleSheet
            sheetId="CONTACT_DETAIL"
            open={open}
            onOpenChange={handleOpenChangeProxy}
            tabLabel="FICHA CONTACTO"
            tabIcon={User}
            size="xl"
            className="max-w-[95vw] w-[95vw]"
        >
            <SheetHeader className="p-6 pb-4 border-b bg-background sticky top-0 z-50">
                <div className="flex items-center justify-between w-full pr-12 text-left">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg text-primary shadow-sm border border-primary/5 hidden sm:block">
                            <User className="h-6 w-6" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-3">
                                <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                                    Ficha de Contacto
                                </SheetTitle>
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 gap-1 px-2 py-0 text-[10px] sm:text-xs font-bold shrink-0 uppercase tracking-widest h-5">
                                    {contact?.display_id ? contact.display_id : "Nuevo"}
                                </Badge>
                            </div>
                            <SheetDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                                {form.watch("name") || "Nuevo Contacto"} {form.watch("tax_id") ? `• ${formatRUT(form.watch("tax_id"))}` : ""}
                            </SheetDescription>
                        </div>
                    </div>
                </div>
            </SheetHeader>

            {/* Custom Close Button for Sheet (Top Right Corner) */}
            <div className="absolute top-4 right-4 z-[60]">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-slate-50/50 backdrop-blur-sm border shadow-sm text-muted-foreground hover:bg-white hover:text-rose-500 transition-all"
                    onClick={() => onOpenChange(false)}
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="h-full w-full flex flex-col overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 border-b bg-muted/5">
                            <TabsList className="h-12 w-full justify-start gap-4 bg-transparent p-0">
                                <TabsTrigger
                                    value="profile"
                                    className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent font-bold flex items-center gap-2"
                                >
                                    <User className="h-4 w-4" />
                                    Perfil
                                </TabsTrigger>

                                <TabsTrigger
                                    value="sales"
                                    className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                                >
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4" />
                                        Cliente
                                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                            {insightsData?.sales?.count || 0}
                                        </Badge>
                                    </div>
                                </TabsTrigger>

                                <TabsTrigger
                                    value="purchases"
                                    className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                                >
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4" />
                                        Proveedor
                                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                            {insightsData?.purchases?.count || 0}
                                        </Badge>
                                    </div>
                                </TabsTrigger>

                                <TabsTrigger
                                    value="work_orders"
                                    className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent"
                                >
                                    <div className="flex items-center gap-2">
                                        <Wand2 className="h-4 w-4" />
                                        Relacionado
                                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                            {insightsData?.work_orders?.count || 0}
                                        </Badge>
                                    </div>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 flex overflow-hidden min-h-0">
                            <div className="flex-1 flex flex-col min-w-0 border-r overflow-y-auto scrollbar-thin">
                                <TabsContent value="profile" className="h-full m-0 p-0 border-0 outline-none">
                                    <div className="p-8 pb-32">
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="md:col-span-2 flex items-center gap-8 p-4 bg-muted/5 rounded-lg border-none">
                                                    <FormField
                                                        control={form.control}
                                                        name="is_default_customer"
                                                        render={({ field }) => (
                                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value}
                                                                        onCheckedChange={field.onChange}
                                                                    />
                                                                </FormControl>
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-sm font-semibold text-primary/80 cursor-pointer">
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
                                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value}
                                                                        onCheckedChange={field.onChange}
                                                                    />
                                                                </FormControl>
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-sm font-semibold text-primary/80 cursor-pointer">
                                                                        Proveedor por defecto
                                                                    </FormLabel>
                                                                </div>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <FormField
                                                    control={form.control}
                                                    name="name"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className={FORM_STYLES.label}>Nombre / Razón Social</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Ej: Juan Pérez o Empresa SpA" {...field} className={FORM_STYLES.input} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="tax_id"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className={FORM_STYLES.label}>RUT / Tax ID</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="12.345.678-9"
                                                                    {...field}
                                                                    onChange={(e) => field.onChange(formatRUT(e.target.value))}
                                                                    className={FORM_STYLES.input}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="email"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className={FORM_STYLES.label}>Email</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="ejemplo@correo.com" {...field} className={FORM_STYLES.input} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="phone"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className={FORM_STYLES.label}>Teléfono</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="+56 9 ..." {...field} className={FORM_STYLES.input} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                                <div className="md:col-span-2">
                                                    <FormField
                                                        control={form.control}
                                                        name="address"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className={FORM_STYLES.label}>Dirección</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="Calle, Número, Depto" {...field} className={FORM_STYLES.input} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                <FormField
                                                    control={form.control}
                                                    name="city"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className={FORM_STYLES.label}>Ciudad / Comuna</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Santiago" {...field} className={FORM_STYLES.input} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="sales" className="h-full m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <InsightsTable
                                        data={insightsData?.sales?.orders || []}
                                        type="sale"
                                        title="Historial de Ventas (NV)"
                                        icon={ShoppingCart}
                                        onActionSuccess={handleActionSuccess}
                                    />
                                </TabsContent>

                                <TabsContent value="purchases" className="h-full m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <InsightsTable
                                        data={insightsData?.purchases?.orders || []}
                                        type="purchase"
                                        title="Historial de Compras (OC)"
                                        icon={Package}
                                        onActionSuccess={handleActionSuccess}
                                    />
                                </TabsContent>

                                <TabsContent value="work_orders" className="h-full m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <InsightsTable
                                        data={insightsData?.work_orders?.orders || []}
                                        type="work_order"
                                        title="Historial de Órdenes de Trabajo"
                                        icon={Wand2}
                                        onActionSuccess={handleActionSuccess}
                                    />
                                </TabsContent>
                                <TabsContent value="credit" className="h-full m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                    <CreditLedgerTable data={ledgerData} loading={loadingLedger} onActionSuccess={handleActionSuccess} />
                                </TabsContent>
                            </div>


                            {contact?.id && (
                                <div className="w-72 flex flex-col bg-muted/5 border-l overflow-hidden hidden lg:flex">
                                    <ActivitySidebar entityId={contact.id} entityType="contact" />
                                </div>
                            )}
                        </div>
                    </Tabs>
                </form>
            </Form>

            <div className="flex justify-end gap-3 w-full px-6 py-4 border-t border-border/40 bg-background/80 backdrop-blur-md sticky bottom-0 z-50 mt-auto">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg text-xs font-bold border-primary/20 hover:bg-primary/5">
                    Cancelar
                </Button>
                <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting} className="rounded-lg text-xs font-bold">
                    {contact ? "Guardar Cambios" : "Crear Contacto"}
                </Button>
            </div>

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
        </CollapsibleSheet>
    )
}

interface InsightsTableProps {
    data: any[]
    type: 'sale' | 'purchase' | 'work_order'
    icon: any
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
        const pendingPaymentItems = data.filter(item => parseFloat(item.pending_amount) > 0)
        const totalPendingMoney = pendingPaymentItems.reduce((acc, item) => acc + parseFloat(item.pending_amount), 0)

        // Logistics (Pending Delivery/Receipt)
        // Uses simplified check: not fully delivered/received if items exist
        const pendingLogisticsItems = data.filter(item => {
            const status = getHubStatuses(item)
            return status.logistics === 'active' || status.logistics === 'neutral'
        })

        // Billing (Pending Invoice)
        const pendingBillingItems = data.filter(item => {
            const status = getHubStatuses(item)
            return status.billing !== 'success'
        })

        // Work Orders (Pending Completion)
        const pendingWorkOrders = data.filter(item => item.status !== 'COMPLETED')

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
                return data.filter(item => parseFloat(item.pending_amount) > 0)
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
                return data.filter(item => item.status !== 'COMPLETED')
            case 'all':
            default:
                return data
        }
    }, [data, activeFilter])

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => <DataCell.Date value={row.original.date} />,
        },
        {
            accessorKey: "display_id",
            header: "Número",
            cell: ({ row }) => {
                let prefix = ""
                let variant: any = "outline"
                if (type === 'sale') { prefix = "NV-"; variant = "indigo" }
                else if (type === 'purchase') { prefix = "OC-"; variant = "warning" }
                else if (type === 'work_order') { prefix = "OT-"; variant = "purple" }

                return (
                    <Badge variant={variant} className="font-bold">
                        {row.original.display_id || `${prefix}${row.original.number?.toString().padStart(6, '0')}`}
                    </Badge>
                )
            },
        },
        ...(type !== 'work_order' ? [
            {
                accessorKey: "total",
                header: "Total",
                cell: ({ row }: any) => <DataCell.Currency value={row.original.total} className="text-left font-bold" />,
            }
        ] : []),
        {
            id: "status",
            header: "Estados",
            cell: ({ row }) => {
                if (type === 'work_order') {
                    return (
                        <Badge variant={row.original.status === 'COMPLETED' ? 'success' : 'outline'} className="text-[10px]">
                            {row.original.status}
                        </Badge>
                    )
                }
                return <OrderHubStatus order={row.original} />
            }
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3 text-[10px] font-bold rounded-lg text-primary hover:text-primary hover:bg-primary/10 border border-primary/10"
                    onClick={() => {
                        if (type === 'work_order') {
                            openWorkOrder(row.original.id)
                        } else {
                            openHub({ orderId: row.original.id, type: type === 'purchase' ? 'purchase' : 'sale' })
                        }
                    }}
                >
                    <LayoutDashboard className="h-3 w-3 mr-1.5" />
                    GESTIONAR
                </Button>
            )
        }
    ]

    return (
        <div className="flex flex-col h-full">
            {/* Summary Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* 1. Total Card (Available for all types) */}
                <Card
                    className={`cursor-pointer transition-all hover:bg-muted/50 border-none shadow-sm rounded-lg ${activeFilter === 'all' ? 'ring-2 ring-primary ring-offset-2' : 'bg-muted/5'}`}
                    onClick={() => setActiveFilter('all')}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">Total</p>
                            <p className="text-2xl font-bold">{metrics.total}</p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Icon className="h-4 w-4 text-primary" />
                        </div>
                    </CardContent>
                </Card>

                {/* Sales/Purchase Specific Cards */}
                {type !== 'work_order' && (
                    <>
                        {/* 2. Financial Card (Accounts Receivable/Payable) */}
                        <Card
                            className={`cursor-pointer transition-all hover:bg-red-50/50 border-none shadow-sm rounded-lg ${activeFilter === 'financial' ? 'ring-2 ring-red-500 ring-offset-2' : 'bg-red-50/20'}`}
                            onClick={() => setActiveFilter('financial')}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-red-600/70 tracking-wider mb-1">
                                        {type === 'sale' ? 'Por Cobrar' : 'Por Pagar'}
                                    </p>
                                    <p className="text-lg font-bold text-red-700">
                                        ${metrics.totalPendingMoney.toLocaleString()}
                                    </p>
                                    <p className="text-[9px] text-red-600/60 font-medium">
                                        {metrics.pendingPaymentCount} documentos
                                    </p>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                                    <Banknote className="h-4 w-4 text-red-600" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3. Logistics Card */}
                        <Card
                            className={`cursor-pointer transition-all hover:bg-amber-50/50 border-none shadow-sm rounded-lg ${activeFilter === 'logistics' ? 'ring-2 ring-amber-500 ring-offset-2' : 'bg-white'}`}
                            onClick={() => setActiveFilter('logistics')}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-amber-600/70 tracking-wider mb-1">
                                        {type === 'sale' ? 'Despacho Pdte.' : 'Recepción Pdte.'}
                                    </p>
                                    <p className="text-2xl font-bold text-amber-700">
                                        {metrics.pendingLogisticsCount}
                                    </p>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                                    <Truck className="h-4 w-4 text-amber-600" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* 4. Billing Card */}
                        <Card
                            className={`cursor-pointer transition-all hover:bg-blue-50/50 border-none shadow-sm rounded-lg ${activeFilter === 'billing' ? 'ring-2 ring-blue-500 ring-offset-2' : 'bg-white'}`}
                            onClick={() => setActiveFilter('billing')}
                        >
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-blue-600/70 tracking-wider mb-1">
                                        Facturación Pdte.
                                    </p>
                                    <p className="text-2xl font-bold text-blue-700">
                                        {metrics.pendingBillingCount}
                                    </p>
                                </div>
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Receipt className="h-4 w-4 text-blue-600" />
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                {/* Work Order Specific Card */}
                {type === 'work_order' && (
                    <Card
                        className={`cursor-pointer transition-all hover:bg-purple-50/50 border-none shadow-sm ${activeFilter === 'pending' ? 'ring-2 ring-purple-500 ring-offset-2' : 'bg-purple-50/20'}`}
                        onClick={() => setActiveFilter('pending')}
                    >
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold uppercase text-purple-600/70 tracking-wider mb-1">
                                    En Proceso / Pdte
                                </p>
                                <p className="text-2xl font-bold text-purple-700">
                                    {metrics.pendingWOCount}
                                </p>
                            </div>
                            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                                <ClipboardList className="h-4 w-4 text-purple-600" />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="pb-4 flex items-center gap-2 pt-2 mb-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Icon className="h-3 w-3" />
                    {title}
                    {activeFilter !== 'all' && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">
                            FILTRADO
                        </Badge>
                    )}
                </span>
                <div className="flex-1 h-px bg-border" />
            </div>
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

function CreditLedgerTable({ data, loading, onActionSuccess }: { data: any[], loading: boolean, onActionSuccess?: () => void }) {
    const { openHub } = useHubPanel()

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="h-8 bg-muted/50 animate-pulse rounded" />
                <div className="h-20 bg-muted/20 animate-pulse rounded" />
                <div className="h-20 bg-muted/20 animate-pulse rounded" />
            </div>
        )
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12 bg-muted/5 rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">No hay documentos con deuda pendiente.</p>
            </div>
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
            cell: ({ row }) => (
                <Badge variant="indigo" className="font-bold">
                    NV-{row.original.number?.toString().padStart(6, '0')}
                </Badge>
            ),
        },
        {
            accessorKey: "balance",
            header: "Saldo",
            cell: ({ row }) => <DataCell.Currency value={row.original.balance} className="text-left font-bold text-red-600" />,
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
                            {table.getRowModel().rows.map((row: any) => (
                                <OrderCard
                                    key={row.original.id}
                                    item={row.original}
                                    type="ledger"
                                    onActionClick={() => openHub({ orderId: row.original.id, type: 'sale', onActionSuccess })}
                                />
                            ))}
                        </div>
                    )}
                />
            </div>
        </div>
    )
}
