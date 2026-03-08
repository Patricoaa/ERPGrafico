"use client"

import React, { useEffect, useCallback, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { useCompanySettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Loader2,
    Check,
    CloudUpload,
    Building2,
    RefreshCw,
    Palette,
    Mail,
    Phone,
    MapPin,
    Globe,
    Upload,
    Pencil,
    Trash2
} from "lucide-react"
import ContactModal from "@/features/contacts/components/ContactModal"
import { PageHeader } from "@/components/shared/PageHeader"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import { Button } from "@/components/ui/button"
import { formatRUT, validateRUT } from "@/lib/utils/format"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import api from "@/lib/api"
import { CompanySettings } from "@/features/settings/types"
import { contactsApi } from "@/features/contacts/api/contactsApi"
import { cn } from "@/lib/utils"

const companySchema = z.object({
    name: z.string().optional().or(z.literal("")),
    trade_name: z.string().default(""),
    tax_id: z.string().optional().or(z.literal("")),
    address: z.string().default(""),
    phone: z.string().default(""),
    email: z.string().email("Email inválido").or(z.literal("")).default(""),
    website: z.string().url("URL inválida").or(z.literal("")).default(""),
    logo_url: z.string().default(""),
    logo: z.string().nullable().default(null),
    primary_color: z.string().default("#0f172a"),
    secondary_color: z.string().default("#3b82f6"),
    business_activity: z.string().default(""),
    contact: z.number().nullable().default(null),
}).refine(data => {
    // If no contact is linked, name and tax_id MUST be present
    if (!data.contact) {
        return !!data.name && !!data.tax_id && data.name.length > 0 && data.tax_id.length > 0;
    }
    return true;
}, {
    message: "La razón social y el RUT son obligatorios si no hay contacto vinculado",
    path: ["name"]
});

type CompanyFormValues = z.infer<typeof companySchema>

export function CompanySettingsView({ activeTab }: { activeTab: string }) {
    const { settings, saving, updateSettings } = useCompanySettings()
    const [syncing, setSyncing] = useState(false)
    const [contacts, setContacts] = useState<any[]>([])
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [isEditContactOpen, setIsEditContactOpen] = useState(false)

    const form = useForm<CompanyFormValues>({
        resolver: zodResolver(companySchema) as any,
        defaultValues: {
            name: "",
            trade_name: "",
            tax_id: "",
            address: "",
            phone: "",
            email: "",
            website: "",
            logo_url: "",
            logo: null,
            primary_color: "#0f172a",
            secondary_color: "#3b82f6",
            business_activity: "",
            contact: null,
        }
    })

    useEffect(() => {
        if (settings) {
            form.reset({
                ...settings,
                primary_color: settings.primary_color || "#000000",
                secondary_color: settings.secondary_color || "#ffffff",
                contact: settings.contact || null,
            })
        }
    }, [settings, form])

    useEffect(() => {
        const fetchContacts = async () => {
            try {
                // Use centralized API for robustness (handles paginated/non-paginated)
                const data = await contactsApi.getContacts()
                setContacts(Array.isArray(data) ? data : (data as any).results || [])
            } catch (error) {
                console.error("Error fetching contacts", error)
            }
        }
        fetchContacts()
    }, [])

    const onSubmit = useCallback(async (data: CompanyFormValues) => {
        try {
            await updateSettings(data as Partial<CompanySettings>)
            form.reset(data)
        } catch (error) {
            // Error handled by mutation hook
        }
    }, [updateSettings, form])

    const { isDirty, isSubmitting } = form.formState
    const watchedValues = form.watch()
    const linkedContactId = form.watch("contact")
    const isLinked = !!linkedContactId
    const selectedContact = contacts.find(c => c.id === linkedContactId)

    useEffect(() => {
        if (isDirty && !isSubmitting) {
            const timer = setTimeout(() => {
                form.handleSubmit(onSubmit as any)()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, isDirty, isSubmitting, form, onSubmit])

    const syncFromContact = useCallback(async (customId?: number | null) => {
        const idToSync = customId !== undefined ? customId : form.getValues("contact")
        if (!idToSync) return

        setSyncing(true)
        try {
            const res = await api.get(`/contacts/${idToSync}/`)
            const contact = res.data
            
            form.setValue("name", contact.name || "", { shouldDirty: true, shouldValidate: true })
            form.setValue("tax_id", contact.tax_id || "", { shouldDirty: true, shouldValidate: true })
            form.setValue("email", contact.email || "", { shouldDirty: true, shouldValidate: true })
            form.setValue("phone", contact.phone || "", { shouldDirty: true, shouldValidate: true })
            form.setValue("address", contact.address || "", { shouldDirty: true, shouldValidate: true })
            
            if (customId === undefined) { // Only show toast if triggered manually, not on select change
                toast.success("Datos sincronizados desde el contacto")
            }
        } catch (error) {
            console.error("Error syncing contact:", error)
            if (customId === undefined) {
                toast.error("Error al sincronizar datos")
            }
        } finally {
            setSyncing(false)
        }
    }, [form])

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingLogo(true)
        const formData = new FormData()
        formData.append('logo', file)

        try {
            await updateSettings(formData)
            toast.success("Logo subido correctamente")
        } catch (error) {
            toast.error("Error al subir el logo")
        } finally {
            setUploadingLogo(false)
        }
    }

    const handleRemoveLogo = async () => {
        try {
            await updateSettings({ logo: null, logo_url: "" })
            toast.success("Logo eliminado")
        } catch (error) {
            toast.error("Error al eliminar el logo")
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <PageHeader
                title="Configuración de Empresa"
                description="Gestione la identidad y parámetros globales de su organización"
                icon={Building2}
            >
                <div className="flex items-center gap-3">
                    {saving && (
                        <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-blue-100 italic text-[10px]">
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                            <span>Guardando cambios...</span>
                        </div>
                    )}
                    {!saving && isDirty && (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100 italic text-[10px]">
                            <RefreshCw className="h-3 w-3 animate-pulse" />
                            <span>Cambios pendientes</span>
                        </div>
                    )}
                    {!saving && !isDirty && (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 italic text-[10px]">
                            <Check className="h-3 w-3" />
                            <span>Cambios guardados</span>
                        </div>
                    )}
                </div>
            </PageHeader>
            
            <ServerPageTabs
                tabs={[
                    { value: "general", label: "General", iconName: "building", href: "/settings/company?tab=general" },
                    { value: "branding", label: "Identidad Visual", iconName: "palette", href: "/settings/company?tab=branding" },
                ]}
                activeValue={activeTab}
                maxWidth="max-w-md"
            />

            <div className="mt-6">
                <Form {...form}>
                    <Tabs value={activeTab} className="w-full h-full m-0 p-0 border-0 outline-none">
                        <TabsContent value="general" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary flex items-center gap-2">
                                        <Building2 className="h-5 w-5" />
                                        Identidad Empresarial
                                    </CardTitle>
                                    <CardDescription>Configure los datos base de su empresa</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="contact"
                                            render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Sincronizar con Contacto</FormLabel>
                                                    <div className="flex gap-2 items-center">
                                                        <div className="flex-1">
                                                            <Select 
                                                                onValueChange={(v) => {
                                                                    const val = v === "none" ? null : parseInt(v)
                                                                    field.onChange(val)
                                                                    
                                                                    if (val) {
                                                                        // Automatically sync when contact is selected
                                                                        syncFromContact(val)
                                                                    } else {
                                                                        // Clear fields if unlinking
                                                                        form.setValue("name", "", { shouldDirty: true })
                                                                        form.setValue("tax_id", "", { shouldDirty: true })
                                                                        form.setValue("email", "", { shouldDirty: true })
                                                                        form.setValue("phone", "", { shouldDirty: true })
                                                                        form.setValue("address", "", { shouldDirty: true })
                                                                    }
                                                                }} 
                                                                value={field.value?.toString() || "none"}
                                                            >
                                                                <FormControl>
                                                                    <SelectTrigger className="h-9">
                                                                        <SelectValue placeholder="Sin contacto vinculado" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="none">Sin contacto vinculado</SelectItem>
                                                                    {contacts.map((c) => (
                                                                        <SelectItem key={c.id} value={c.id.toString()}>
                                                                            {c.name} ({c.tax_id})
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        
                                                        {isLinked && (
                                                            <Button 
                                                                type="button" 
                                                                variant="outline" 
                                                                size="icon"
                                                                className="h-9 w-9 text-blue-600 border-blue-200 hover:bg-blue-50 shadow-sm"
                                                                onClick={() => setIsEditContactOpen(true)}
                                                                title="Editar ficha de contacto"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        )}

                                                        <Button 
                                                            type="button" 
                                                            variant="outline" 
                                                            size="icon"
                                                            className="h-9 w-9 shadow-sm"
                                                            onClick={() => syncFromContact()}
                                                            disabled={syncing || !isLinked}
                                                            title="Sincronizar datos"
                                                        >
                                                            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                                                        </Button>
                                                    </div>
                                                    <FormDescription className="text-[10px]">
                                                        {isLinked 
                                                            ? "Los datos legales están sincronizados desde el contacto vinculado." 
                                                            : "Vincule un contacto para sincronizar razón social, RUT y dirección."}
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormField
                                            control={form.control}
                                            name="trade_name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Nombre de Fantasía</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} className="h-9" placeholder="Ej: Mi Tienda" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="business_activity"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Giro / Actividad</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} className="h-9" placeholder="Ej: Venta de repuestos" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", isLinked && "hidden")}>
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Razón Social</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} className="h-9 font-medium" placeholder="Ej: Mi Empresa S.A." />
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
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">RUT / Tax ID</FormLabel>
                                                    <FormControl>
                                                        <Input 
                                                            {...field} 
                                                            className="h-9 font-mono" 
                                                            placeholder="12.345.678-9" 
                                                            onChange={(e) => field.onChange(formatRUT(e.target.value))}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", isLinked && "hidden")}>
                                        <FormField
                                            control={form.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                        <Mail className="h-3 w-3" /> Email de Contacto
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} type="email" className="h-9" />
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
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                        <Phone className="h-3 w-3" /> Teléfono
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} className="h-9" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className={cn(isLinked && "hidden")}>
                                        <FormField
                                            control={form.control}
                                            name="address"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" /> Dirección
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Textarea {...field} className="min-h-[80px]" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="website"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                    <Globe className="h-3 w-3" /> Sitio Web
                                                </FormLabel>
                                                <FormControl>
                                                    <Input {...field} className="h-9" placeholder="https://..." />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="branding" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg text-primary flex items-center gap-2">
                                        <Palette className="h-5 w-5" />
                                        Identidad Visual
                                    </CardTitle>
                                    <CardDescription>Personalice el aspecto de sus documentos y sistema</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    <div className="space-y-4">
                                        <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Logo de la Empresa</FormLabel>
                                        <div className="flex flex-col md:flex-row gap-6 items-start">
                                            <div className="h-32 w-32 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30 overflow-hidden relative group shadow-inner">
                                                {uploadingLogo ? (
                                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                ) : settings?.logo ? (
                                                    <div className="relative w-full h-full group">
                                                        <img src={settings.logo} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleRemoveLogo()
                                                            }}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="text-center p-2 text-muted-foreground">
                                                        <Upload className="h-8 w-8 mx-auto mb-1 opacity-50" />
                                                        <span className="text-[10px]">Sin Logo</span>
                                                    </div>
                                                )}
                                                <input 
                                                    type="file" 
                                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                                    accept="image/*"
                                                    onChange={handleLogoUpload}
                                                    disabled={uploadingLogo}
                                                />
                                            </div>
                                            <div className="flex-1 space-y-4 w-full">
                                                <FormField
                                                    control={form.control}
                                                    name="logo_url"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-[11px] font-semibold">O utilizar URL externa</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} placeholder="https://..." className="h-9" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <p className="text-[11px] text-muted-foreground italic">
                                                    Se recomienda usar una imagen con fondo transparente (PNG) 
                                                    y dimensiones equilibradas.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <FormField
                                            control={form.control}
                                            name="primary_color"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Color Primario</FormLabel>
                                                    <div className="flex items-center gap-4">
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input 
                                                                    {...field} 
                                                                    type="color" 
                                                                    className="h-10 w-20 p-1 cursor-pointer absolute opacity-0 z-10" 
                                                                />
                                                                <div 
                                                                    className="h-10 w-20 rounded border border-input shadow-sm" 
                                                                    style={{ backgroundColor: field.value }}
                                                                />
                                                            </div>
                                                        </FormControl>
                                                        <code className="text-sm font-mono font-bold">{field.value}</code>
                                                    </div>
                                                    <FormDescription className="text-[10px]">
                                                        Utilizado para encabezados y botones principales.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="secondary_color"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Color Secundario</FormLabel>
                                                    <div className="flex items-center gap-4">
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Input 
                                                                    {...field} 
                                                                    type="color" 
                                                                    className="h-10 w-20 p-1 cursor-pointer absolute opacity-0 z-10" 
                                                                />
                                                                <div 
                                                                    className="h-10 w-20 rounded border border-input shadow-sm" 
                                                                    style={{ backgroundColor: field.value }}
                                                                />
                                                            </div>
                                                        </FormControl>
                                                        <code className="text-sm font-mono font-bold">{field.value}</code>
                                                    </div>
                                                    <FormDescription className="text-[10px]">
                                                        Utilizado para detalles y elementos de contraste.
                                                    </FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </Form>
            </div>

            <ContactModal 
                open={isEditContactOpen}
                onOpenChange={setIsEditContactOpen}
                contact={selectedContact}
                onSuccess={() => {
                    syncFromContact() // Refresh data after edit
                }}
            />
        </div>
    )
}
