"use client"

import { useEffect, useState, useMemo } from "react"
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
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatRUT, validateRUT } from "@/lib/utils/format"
import { useContactMutations, useContactInsights } from "@/features/contacts"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingCart, Package, Factory, User, BarChart3, Clock, Scale, Banknote, Truck, Receipt, ClipboardList, CreditCard } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from "@/components/ui/data-table-cells"
import { Separator } from "@/components/ui/separator"
import { DataTable } from "@/components/ui/data-table"
import { OrderHubStatus } from "@/components/orders/OrderHubStatus"
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"
import { ColumnDef } from "@tanstack/react-table"
import { LayoutDashboard, Wand2 } from "lucide-react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
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

    credit_enabled: z.boolean().optional(),
    credit_limit: z.coerce.number().nullable().optional(),
    credit_days: z.coerce.number().nullable().optional(),
    credit_blocked: z.boolean().default(false),
})

interface ContactModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact?: any
    onSuccess: () => void
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
    const { data: insightsData, isLoading: loadingInsights } = useContactInsights(contact?.id)

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
            credit_enabled: !!contact.credit_enabled,
            credit_limit: contact.credit_limit || null,
            credit_days: contact.credit_days || 30,
            credit_blocked: !!contact.credit_blocked,
        } : {
            name: "",
            tax_id: "",
            email: "",
            phone: "",
            address: "",
            city: "",
            is_default_customer: false,
            is_default_vendor: false,
            credit_enabled: false,
            credit_limit: null,
            credit_days: 30,
            credit_blocked: false,
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
                        credit_enabled: !!res.data.credit_enabled,
                        credit_limit: res.data.credit_limit || null,
                        credit_days: res.data.credit_days || 30,
                        credit_blocked: !!res.data.credit_blocked,
                    })
                })
                .catch(err => {
                    console.error("Error fetching contact details:", err)
                    toast.error("Error al cargar detalles del contacto")
                })
        }
    }, [open, contact?.id, contact?.name])

    useEffect(() => {
        if (open && contact?.id && activeTab === "credit") {
            setLoadingLedger(true)
            api.get(`/contacts/${contact.id}/credit_ledger/`)
                .then(res => setLedgerData(res.data))
                .catch(err => {
                    console.error("Error fetching credit ledger:", err)
                    toast.error("Error al cargar el historial crediticio")
                })
                .finally(() => setLoadingLedger(false))
        }
    }, [open, contact?.id, activeTab])

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
                credit_enabled: !!contact.credit_enabled,
                credit_limit: contact.credit_limit || null,
                credit_days: contact.credit_days || 30,
                credit_blocked: !!contact.credit_blocked,
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
                credit_enabled: false,
                credit_limit: null,
                credit_days: 30,
                credit_blocked: false,
            })
        }
    }, [contact, open, form.reset])

    const saveContact = async (values: z.infer<typeof contactSchema>) => {
        try {
            if (contact) {
                await updateContact({ id: contact.id, payload: values })
            } else {
                await createContact(values as any)
            }
            onSuccess()
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
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                        <span>Ficha de Contacto</span>
                    </div>
                }
                description={
                    contact ? (
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <span>{contact.display_id}</span>
                            <span className="opacity-30">|</span>
                            <span>{contact.name}</span>
                            {contact.tax_id && (
                                <>
                                    <span className="opacity-30">|</span>
                                    <span>{formatRUT(contact.tax_id)}</span>
                                </>
                            )}
                        </div>
                    ) : (
                        "Complete la información del contacto"
                    )
                }
                size="full"
                hideScrollArea={true}
                footer={
                    <div className="flex justify-end gap-3 w-full px-6 py-3 border-t border-border/40">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
                            {contact ? "Guardar Cambios" : "Crear Contacto"}
                        </Button>
                    </div>
                }
            >
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

                                    <TabsTrigger
                                        value="credit"
                                        className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent font-bold flex items-center gap-2"
                                    >
                                        <CreditCard className="h-4 w-4" />
                                        Línea de Crédito
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 flex overflow-hidden min-h-0">
                                <div className="flex-1 flex flex-col min-w-0 border-r overflow-y-auto scrollbar-thin">
                                    <TabsContent value="profile" className="h-full m-0 p-0 border-0 outline-none">
                                        <div className="p-8 pb-32">
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="md:col-span-2 flex items-center gap-8 p-4 bg-primary/5 rounded-2xl border border-dashed border-primary/10">
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
                                                                        <FormLabel className="text-sm font-semibold text-primary/80">
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
                                                                        <FormLabel className="text-sm font-semibold text-primary/80">
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

                                    <TabsContent value="credit" className="h-full m-0 p-0 border-0 outline-none">
                                        <div className="p-8 pb-32">
                                            <div className="space-y-8">
                                                {/* Status Banner */}
                                                {form.watch("credit_blocked") && (
                                                    <div className="bg-red-600 p-6 rounded-2xl flex items-center gap-4 animate-in zoom-in-95 duration-300">
                                                        <div className="p-3 bg-white/20 rounded-xl">
                                                            <Banknote className="h-8 w-8 text-white" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-white font-black text-lg uppercase tracking-tight">Crédito Restringido</h3>
                                                            <p className="text-white/80 text-sm font-medium">Este contacto tiene prohibido el uso de crédito. **Requiere pago inmediato en caja.**</p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-1 gap-4">
                                                    {/* Blocker Switch */}
                                                    <div className="p-4 bg-red-500/5 rounded-2xl border border-dashed border-red-500/10 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-red-100 rounded-lg">
                                                                <Scale className="h-4 w-4 text-red-600" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-red-900 text-sm">Bloquear Crédito</h4>
                                                                <p className="text-[10px] text-red-700/70">Prohibe cualquier tipo de crédito (aprobado o fallback).</p>
                                                            </div>
                                                        </div>
                                                        <FormField
                                                            control={form.control}
                                                            name="credit_blocked"
                                                            render={({ field }) => (
                                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                                    <FormControl>
                                                                        <div className="flex items-center space-x-2">
                                                                            <Checkbox
                                                                                id="credit_blocked"
                                                                                checked={field.value}
                                                                                onCheckedChange={field.onChange}
                                                                                className="h-5 w-5 border-red-200 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                                                            />
                                                                            <label htmlFor="credit_blocked" className="text-xs font-bold leading-none cursor-pointer text-red-700">
                                                                                {field.value ? "BLOQUEADO" : "LIBRE"}
                                                                            </label>
                                                                        </div>
                                                                    </FormControl>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Conditional Fields */}
                                                {!form.watch("credit_blocked") && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-1">
                                                        <FormField
                                                            control={form.control}
                                                            name="credit_limit"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className={FORM_STYLES.label}>Límite de Crédito ($)</FormLabel>
                                                                    <FormControl>
                                                                        <div className="relative">
                                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                                                                            <Input
                                                                                type="number"
                                                                                placeholder="Ej: 500000"
                                                                                className={`pl-8 ${FORM_STYLES.input}`}
                                                                                {...field}
                                                                                value={field.value || ""}
                                                                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                                                            />
                                                                        </div>
                                                                    </FormControl>
                                                                    <p className="text-[11px] text-muted-foreground mt-1">Monto máximo que el cliente puede adeudar.</p>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        <FormField
                                                            control={form.control}
                                                            name="credit_days"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className={FORM_STYLES.label}>Días de Plazo</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="number"
                                                                            placeholder="Ej: 30"
                                                                            className={FORM_STYLES.input}
                                                                            {...field}
                                                                            value={field.value || ""}
                                                                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                                                        />
                                                                    </FormControl>
                                                                    <p className="text-[11px] text-muted-foreground mt-1">Plazo estándar de pago (Ej: 30 días, 45 días).</p>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        {contact && (
                                                            <div className="md:col-span-2 mt-4">
                                                                <h4 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">Estado Actual</h4>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex flex-col items-center justify-center">
                                                                        <span className="text-xs font-semibold text-emerald-600/70 uppercase mb-1">Disponible</span>
                                                                        <span className="text-xl font-bold text-emerald-700">
                                                                            ${Number(contact.credit_available || 0).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl flex flex-col items-center justify-center">
                                                                        <span className="text-xs font-semibold text-red-600/70 uppercase mb-1">Deuda Pendiente (Usado)</span>
                                                                        <span className="text-xl font-bold text-red-700">
                                                                            ${Number(contact.credit_balance_used || 0).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-8">
                                                                    <CreditLedgerTable
                                                                        data={ledgerData}
                                                                        loading={loadingLedger}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="sales" className="h-full m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                        <InsightsTable
                                            data={insightsData?.sales?.orders || []}
                                            type="sale"
                                            title="Historial de Ventas (NV)"
                                            icon={ShoppingCart}
                                        />
                                    </TabsContent>

                                    <TabsContent value="purchases" className="h-full m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                        <InsightsTable
                                            data={insightsData?.purchases?.orders || []}
                                            type="purchase"
                                            title="Historial de Compras (OC)"
                                            icon={Package}
                                        />
                                    </TabsContent>

                                    <TabsContent value="work_orders" className="h-full m-0 border-0 outline-none overflow-hidden flex flex-col p-6">
                                        <InsightsTable
                                            data={insightsData?.work_orders?.orders || []}
                                            type="work_order"
                                            title="Historial de OTs"
                                            icon={Wand2}
                                        />
                                    </TabsContent>
                                </div>

                                <div className="w-72 flex flex-col bg-muted/5 border-l overflow-hidden">
                                    {contact ? (
                                        <ActivitySidebar entityId={contact.id} entityType="contact" />
                                    ) : (
                                        <div className="h-full p-8 flex items-center justify-center text-center bg-muted/10 rounded-xl border border-dashed m-6">
                                            <p className="text-xs text-muted-foreground italic">
                                                El historial de actividad estará disponible una vez que se cree el contacto.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Tabs>
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
            </BaseModal >
        </>
    )
}

interface InsightsTableProps {
    data: any[]
    type: 'sale' | 'purchase' | 'work_order'
    title: string
    icon: any
}

function InsightsTable({ data, type, title, icon: Icon }: InsightsTableProps) {
    const { openCommandCenter, openWorkOrder } = useGlobalModals()
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
            header: "Estado Hub",
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
                    className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => {
                        if (type === 'work_order') {
                            openWorkOrder(row.original.id)
                        } else {
                            openCommandCenter(row.original.id, type === 'purchase' ? 'purchase' : 'sale')
                        }
                    }}
                >
                    <LayoutDashboard className="h-4 w-4 mr-1" />
                    Gestionar
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
                    className={`cursor-pointer transition-all hover:bg-muted/50 border-none shadow-sm ${activeFilter === 'all' ? 'ring-2 ring-primary ring-offset-2' : 'bg-white'}`}
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
                            className={`cursor-pointer transition-all hover:bg-red-50/50 border-none shadow-sm ${activeFilter === 'financial' ? 'ring-2 ring-red-500 ring-offset-2' : 'bg-red-50/20'}`}
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
                            className={`cursor-pointer transition-all hover:bg-amber-50/50 border-none shadow-sm ${activeFilter === 'logistics' ? 'ring-2 ring-amber-500 ring-offset-2' : 'bg-amber-50/20'}`}
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
                            className={`cursor-pointer transition-all hover:bg-blue-50/50 border-none shadow-sm ${activeFilter === 'billing' ? 'ring-2 ring-blue-500 ring-offset-2' : 'bg-blue-50/20'}`}
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
                            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                                <ClipboardList className="h-4 w-4 text-purple-600" />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="pb-4 flex items-center justify-between">
                <h4 className="text-sm font-bold flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {title}
                    {activeFilter !== 'all' && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                            Filtrado
                        </Badge>
                    )}
                </h4>
            </div>
            <div className="flex-1 overflow-hidden p-0">
                <DataTable
                    columns={columns}
                    data={filteredData}
                    defaultPageSize={10}
                />
            </div>
        </div>
    )
}

function CreditLedgerTable({ data, loading }: { data: any[], loading: boolean }) {
    const { openCommandCenter } = useGlobalModals()

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
            <div className="text-center py-12 bg-muted/5 rounded-2xl border border-dashed">
                <p className="text-sm text-muted-foreground">No hay documentos con deuda pendiente.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Detalle de Deuda (Facturas/Ventas a Crédito)
            </h4>

            <div className="rounded-xl border overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead className="text-xs font-bold uppercase">Documento</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-right">Monto Total</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-right">Pagado</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-right">Saldo Pendiente</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-center">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((order) => (
                            <TableRow key={order.id} className="hover:bg-muted/5">
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">NV-{order.number.toString().padStart(6, '0')}</span>
                                        <span className="text-[10px] text-muted-foreground">{format(new Date(order.date), "dd MMM yyyy", { locale: es })}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DataCell.Currency value={order.effective_total} className="text-xs font-medium" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <DataCell.Currency value={order.paid_amount} className="text-xs text-emerald-600 font-medium" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <DataCell.Currency value={order.balance} className="text-sm font-bold text-red-600" />
                                </TableCell>
                                <TableCell className="text-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2"
                                        onClick={() => openCommandCenter(order.id, 'sale')}
                                    >
                                        <LayoutDashboard className="h-4 w-4 mr-1" />
                                        Ver
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
