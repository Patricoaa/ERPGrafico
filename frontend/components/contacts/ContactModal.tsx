import { useEffect, useState } from "react"
import { useFormWithToast } from "@/hooks/use-form-with-toast"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
import { showWarningToast } from "@/lib/utils/toast-utils"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

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

    useEffect(() => {
        if (!open) return
        fetchDefaults()

        if (contact) {
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
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{contact ? "Editar Contacto" : "Nuevo Contacto"}</DialogTitle>
                        <DialogDescription>
                            Complete la información del contacto
                        </DialogDescription>
                    </DialogHeader>

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
                </DialogContent>
            </Dialog>

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
