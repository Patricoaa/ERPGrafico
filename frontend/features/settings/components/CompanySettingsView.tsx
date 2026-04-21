"use client"

import React, { useEffect, useCallback, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { useCompanySettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { PageTabs } from "@/components/shared/PageTabs"
import { Button } from "@/components/ui/button"
import { formatRUT, validateRUT } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import api, { resolveMediaUrl } from "@/lib/api"
import { CompanySettings } from "@/features/settings/types"
import { contactsApi } from "@/features/contacts/api/contactsApi"
import { PartnerSettingsTab } from "./PartnerSettingsTab"
import { LAYOUT_TOKENS } from "@/lib/styles"

import { companySchema, type CompanyFormValues } from "./CompanySettingsView.schema"
import { Contact } from "@/features/contacts/types"

export function CompanySettingsView({ 
    activeTab, 
    onSavingChange 
}: { 
    activeTab: string,
    onSavingChange?: (saving: boolean) => void
}) {
    const { settings, isLoading, saving, updateSettings } = useCompanySettings()
    
    // Propage saving status to parent
    useEffect(() => {
        onSavingChange?.(saving)
    }, [saving, onSavingChange])

    const [syncing, setSyncing] = useState(false)
    const [contacts, setContacts] = useState<Contact[]>([])
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [isEditContactOpen, setIsEditContactOpen] = useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const form = useForm<CompanyFormValues>({
        resolver: zodResolver(companySchema),
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
                setContacts(Array.isArray(data) ? data : (data as { results: Contact[] }).results || [])
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
                form.handleSubmit(onSubmit)()
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

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <Skeleton className="h-20 w-full" />
                        <div className="grid grid-cols-2 gap-6">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-32 w-full" />
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
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
                                                        className="h-9 w-9 text-primary border-primary/20 hover:bg-primary/10 shadow-sm"
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
                                    <div 
                                        className="h-32 w-32 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30 overflow-hidden relative group shadow-inner cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => !settings?.logo && fileInputRef.current?.click()}
                                    >
                                        {uploadingLogo ? (
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        ) : settings?.logo ? (
                                            <div className="relative w-full h-full">
                                                <img 
                                                    src={resolveMediaUrl(settings.logo) || undefined} 
                                                    alt="Logo" 
                                                    className="max-h-full max-w-full object-contain p-2 w-full h-full" 
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        className="h-8 px-2 text-[10px] font-bold"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            fileInputRef.current?.click()
                                                        }}
                                                    >
                                                        <Pencil className="h-3 w-3 mr-1" />
                                                        Cambiar
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleRemoveLogo()
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center p-2 text-muted-foreground">
                                                <Upload className="h-8 w-8 mx-auto mb-1 opacity-50" />
                                                <span className="text-[10px] font-bold uppercase tracking-tight">Subir Logo</span>
                                            </div>
                                        )}
                                        <input 
                                            type="file" 
                                            ref={fileInputRef}
                                            className="hidden"
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


                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <ContactModal 
                open={isEditContactOpen}
                onOpenChange={setIsEditContactOpen}
                contact={selectedContact}
                onSuccess={() => {
                    syncFromContact() // Refresh data after edit
                }}
            />
        </Form>
    )
}
