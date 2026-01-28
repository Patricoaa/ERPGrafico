import { useEffect, useState } from "react"
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
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { ActivitySidebar } from "@/components/audit/ActivitySidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingCart, Package, Factory, User, BarChart3, Clock } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from "@/components/ui/data-table-cells"

const contactSchema = z.object({
    name: z.string().min(2, "El nombre es requerido"),
    tax_id: z.string().min(1, "El RUT es requerido").refine(validateRUT, "RUT inválido"),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    payment_terms: z.string().optional(),
    is_default_customer: z.boolean(),
    is_default_vendor: z.boolean(),
})

interface ContactModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contact?: any
    onSuccess: () => void
}

export function ContactModal({ open, onOpenChange, contact, onSuccess }: ContactModalProps) {
    const [defaultCustomer, setDefaultCustomer] = useState<any>(null)
    const [defaultVendor, setDefaultVendor] = useState<any>(null)
    const [confirmReplacement, setConfirmReplacement] = useState<{ type: 'customer' | 'vendor' | null, name: string }>({ type: null, name: "" })
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
    const [pendingValues, setPendingValues] = useState<z.infer<typeof contactSchema> | null>(null)
    const [insightsData, setInsightsData] = useState<any>(null)
    const [loadingInsights, setLoadingInsights] = useState(false)
    const [activeTab, setActiveTab] = useState("profile")

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
            payment_terms: "CONTADO",
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

            // Only set if they are different from the current contact being edited
            if (cust && cust.id !== contact?.id) setDefaultCustomer(cust)
            else setDefaultCustomer(null)

            if (vend && vend.id !== contact?.id) setDefaultVendor(vend)
            else setDefaultVendor(null)

        } catch (error) {
            console.error("Error fetching default contacts", error)
        }
    }

    const fetchInsights = async (id: number) => {
        setLoadingInsights(true)
        try {
            const res = await api.get(`/contacts/${id}/insights/`)
            setInsightsData(res.data)
        } catch (error) {
            console.error("Error fetching insights", error)
        } finally {
            setLoadingInsights(false)
        }
    }

    useEffect(() => {
        if (!open) {
            setActiveTab("profile")
            setInsightsData(null)
            return
        }
        fetchDefaults()

        if (contact) {
            fetchInsights(contact.id)
            form.reset({
                name: contact.name,
                tax_id: contact.tax_id || "",
                email: contact.email || "",
                phone: contact.phone || "",
                address: contact.address || "",
                city: contact.city || "",
                payment_terms: contact.payment_terms || "CONTADO",
                is_default_customer: !!contact.is_default_customer,
                is_default_vendor: !!contact.is_default_vendor
            })
        } else {
            form.reset({
                name: "",
                tax_id: "",
                email: "",
                phone: "",
                address: "",
                city: "",
                payment_terms: "CONTADO",
                is_default_customer: false,
                is_default_vendor: false
            })
        }
    }, [contact, open, form.reset])

    const saveContact = async (values: z.infer<typeof contactSchema>) => {
        try {
            if (contact) {
                await api.patch(`/contacts/${contact.id}/`, values)
                toast.success("Contacto actualizado exitosamente")
            } else {
                await api.post("/contacts/", values)
                toast.success("Contacto creado exitosamente")
            }
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            console.error(error)
            toast.error("No se pudo guardar el contacto")
        }
    }

    const onSubmit = async (values: z.infer<typeof contactSchema>) => {
        // Check if we are setting a new default and there's already one
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
                title={contact ? "Editar Contacto" : "Nuevo Contacto"}
                description="Complete la información del contacto"
                size="2xl"
                hideScrollArea={true}
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="px-6 border-b rounded-none bg-transparent h-12 justify-start gap-4">
                        <TabsTrigger
                            value="profile"
                            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-2 pb-2 mt-2 font-bold"
                        >
                            <User className="h-4 w-4 mr-2" />
                            Perfil
                        </TabsTrigger>

                        {insightsData?.sales?.orders?.length > 0 && (
                            <TabsTrigger
                                value="sales"
                                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-2 pb-2 mt-2 font-bold"
                            >
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Cliente
                                <Badge variant="secondary" className="ml-2 py-0 h-4 text-[10px]">
                                    {insightsData.sales.orders.length}
                                </Badge>
                            </TabsTrigger>
                        )}

                        {insightsData?.purchases?.orders?.length > 0 && (
                            <TabsTrigger
                                value="purchases"
                                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-2 pb-2 mt-2 font-bold"
                            >
                                <Package className="h-4 w-4 mr-2" />
                                Proveedor
                                <Badge variant="secondary" className="ml-2 py-0 h-4 text-[10px]">
                                    {insightsData.purchases.orders.length}
                                </Badge>
                            </TabsTrigger>
                        )}

                        {insightsData?.work_orders?.orders?.length > 0 && (
                            <TabsTrigger
                                value="work_orders"
                                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-2 pb-2 mt-2 font-bold"
                            >
                                <Factory className="h-4 w-4 mr-2" />
                                Relacionado
                                <Badge variant="secondary" className="ml-2 py-0 h-4 text-[10px]">
                                    {insightsData.work_orders.orders.length}
                                </Badge>
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="profile" className="flex-1 overflow-hidden m-0 p-0 border-0 outline-none focus-visible:ring-0">
                        <div className="flex h-full overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6">
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                        {contact?.display_id && (
                                            <div className="bg-muted/50 p-2 rounded-md mb-2 flex items-center justify-between">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID de Contacto</span>
                                                <span className="font-mono font-bold text-primary">{contact.display_id}</span>
                                            </div>
                                        )}

                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nombre *</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ej: Empresa Ltda" {...field} />
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
                                                    <FormLabel>RUT / Identificación *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Ej: 12.345.678-9"
                                                            {...field}
                                                            onChange={(e) => field.onChange(formatRUT(e.target.value))}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="email"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Email</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="contacto@empresa.com" {...field} />
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
                                                        <FormLabel>Teléfono</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="+56 9 1234 5678" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="address"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Dirección</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Av. Principal 123" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="flex gap-6 p-1">
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
                                                        <div className="space-y-1 leading-none">
                                                            <FormLabel>
                                                                Cliente por defecto
                                                            </FormLabel>
                                                        </div>
                                                    </FormItem>
                                                )}
                                            />
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
                                                        <div className="space-y-1 leading-none">
                                                            <FormLabel>
                                                                Proveedor por defecto
                                                            </FormLabel>
                                                        </div>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="flex justify-end pt-4 gap-2">
                                            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                                                Cancelar
                                            </Button>
                                            <Button type="submit">
                                                {contact ? "Guardar Cambios" : "Crear Contacto"}
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </div>

                            {contact && (
                                <div className="w-80 border-l bg-muted/5">
                                    <div className="h-full">
                                        <ActivitySidebar
                                            entityId={contact.id}
                                            entityType="contact"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="sales" className="flex-1 overflow-y-auto m-0 p-6 border-0 outline-none">
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold flex items-center gap-2">
                                <ShoppingCart className="h-4 w-4 text-primary" />
                                Historial de Ventas (NV)
                            </h4>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Número</TableHead>
                                            <TableHead>Total</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {insightsData?.sales?.orders?.map((order: any) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="text-xs">
                                                    {format(new Date(order.date), "dd/MM/yyyy", { locale: es })}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="indigo" className="font-bold">
                                                        {order.display_id}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <DataCell.Currency value={order.total} className="text-left font-bold" />
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={order.status === 'PAID' ? 'success' : 'outline'} className="text-[10px]">
                                                        {order.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="purchases" className="flex-1 overflow-y-auto m-0 p-6 border-0 outline-none">
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" />
                                Historial de Compras
                            </h4>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Número</TableHead>
                                            <TableHead>Total</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {insightsData?.purchases?.orders?.map((order: any) => (
                                            <TableRow key={order.id}>
                                                <TableCell className="text-xs">
                                                    {format(new Date(order.date), "dd/MM/yyyy", { locale: es })}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="warning" className="font-bold">
                                                        {order.display_id}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <DataCell.Currency value={order.total} className="text-left font-bold" />
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={order.status === 'RECEIVED' ? 'success' : 'outline'} className="text-[10px]">
                                                        {order.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="work_orders" className="flex-1 overflow-y-auto m-0 p-6 border-0 outline-none">
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold flex items-center gap-2">
                                <Factory className="h-4 w-4 text-primary" />
                                Órdenes de Trabajo (OT)
                            </h4>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Número</TableHead>
                                            <TableHead>Cliente NV</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {insightsData?.work_orders?.orders?.map((ot: any) => (
                                            <TableRow key={ot.id}>
                                                <TableCell className="text-xs">
                                                    {format(new Date(ot.created_at), "dd/MM/yyyy", { locale: es })}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="indigo" className="font-bold">
                                                        {ot.display_id}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {ot.sale_customer_name}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={ot.status === 'COMPLETED' ? 'success' : 'outline'} className="text-[10px]">
                                                        {ot.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </BaseModal>

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
        </>
    )
}
