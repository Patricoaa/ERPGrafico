"use client"

import React, { useEffect, useCallback, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useCompanySettings } from "@/features/settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormField } from "@/components/ui/form"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Loader2, Building2, RefreshCw, Palette, Mail, Phone, MapPin, Globe, Upload, Pencil, Trash2 } from "lucide-react"
import ContactModal from "@/features/contacts/components/ContactModal"
import { AutoSaveStatusBadge, LabeledInput, LabeledSelect } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { formatRUT } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm"
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard"

import api, { resolveMediaUrl } from "@/lib/api"
import { CompanySettings } from "@/features/settings/types"
import { contactsApi } from "@/features/contacts/api/contactsApi"


import { companySchema, type CompanyFormValues } from "./CompanySettingsView.schema"
import { Contact } from "@/features/contacts/types"

export function CompanySettingsView({ activeTab }: { activeTab: string }) {
    const { settings, updateSettings } = useCompanySettings()

    const [syncing, setSyncing] = useState(false)
    const [contacts, setContacts] = useState<Contact[]>([])
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [isEditContactOpen, setIsEditContactOpen] = useState(false)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const form = useForm<any>({
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
                setContacts(Array.isArray(data) ? data : (data as { results: Contact[] }).results || [])
            } catch (error) {
                console.error("Error fetching contacts", error)
            }
        }
        fetchContacts()
    }, [])

    const onSave = useCallback(async (data: any) => {
        await updateSettings(data as Partial<CompanySettings>)
    }, [updateSettings])

    const { status, invalidReason, lastSavedAt, retry } = useAutoSaveForm({ form, onSave, enabled: true })

    useUnsavedChangesGuard(status)

    const linkedContactId = form.watch("contact")
    const isLinked = !!linkedContactId
    const selectedContact = contacts.find(c => c.id === linkedContactId)

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
        <>
            <div className="flex justify-end mb-4">
                <AutoSaveStatusBadge
                    status={status}
                    invalidReason={invalidReason}
                    lastSavedAt={lastSavedAt}
                    onRetry={retry}
                />
            </div>
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
                                        control={form.control as any}
                                        name="contact"
                                        render={({ field, fieldState }) => (
                                            <div className="col-span-2 space-y-2">
                                                <div className="flex gap-2 items-center">
                                                    <div className="flex-1">
                                                        <LabeledSelect
                                                            label="Sincronizar con Contacto"
                                                            value={field.value?.toString() || "none"}
                                                            onChange={(v: string) => {
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
                                                            error={fieldState.error?.message}
                                                            options={[
                                                                { value: "none", label: "Sin contacto vinculado" },
                                                                ...contacts.map((c) => ({
                                                                    value: c.id.toString(),
                                                                    label: `${c.name} (${c.tax_id})`
                                                                }))
                                                            ]}
                                                        />
                                                    </div>

                                                    {isLinked && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-[52px] w-[52px] text-primary border-primary/20 hover:bg-primary/10 shadow-sm"
                                                            onClick={() => setIsEditContactOpen(true)}
                                                            title="Editar ficha de contacto"
                                                        >
                                                            <Pencil className="h-5 w-5" />
                                                        </Button>
                                                    )}

                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-[52px] w-[52px] shadow-sm"
                                                        onClick={() => syncFromContact()}
                                                        disabled={syncing || !isLinked}
                                                        title="Sincronizar datos"
                                                    >
                                                        <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
                                                    </Button>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground pl-1">
                                                    {isLinked
                                                        ? "Los datos legales están sincronizados desde el contacto vinculado."
                                                        : "Vincule un contacto para sincronizar razón social, RUT y dirección."}
                                                </p>
                                            </div>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control as any}
                                        name="trade_name"
                                        render={({ field }) => (
                                            <LabeledInput
                                                label="Nombre de Fantasía"
                                                placeholder="Ej: Mi Tienda"
                                                {...field}
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control as any}
                                        name="business_activity"
                                        render={({ field }) => (
                                            <LabeledInput
                                                label="Giro / Actividad"
                                                placeholder="Ej: Venta de repuestos"
                                                {...field}
                                            />
                                        )}
                                    />
                                </div>

                                <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", isLinked && "hidden")}>
                                    <FormField
                                        control={form.control as any}
                                        name="name"
                                        render={({ field }) => (
                                            <LabeledInput
                                                label="Razón Social"
                                                placeholder="Ej: Mi Empresa S.A."
                                                {...field}
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control as any}
                                        name="tax_id"
                                        render={({ field }) => (
                                            <LabeledInput
                                                label="RUT / Tax ID"
                                                placeholder="12.345.678-9"
                                                className="font-mono"
                                                onChange={(e) => field.onChange(formatRUT(e.target.value))}
                                                value={field.value}
                                            />
                                        )}
                                    />
                                </div>

                                <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", isLinked && "hidden")}>
                                    <FormField
                                        control={form.control as any}
                                        name="email"
                                        render={({ field }) => (
                                            <LabeledInput
                                                label={
                                                    <span className="flex items-center gap-1">
                                                        <Mail className="h-3 w-3" /> Email de Contacto
                                                    </span>
                                                }
                                                type="email"
                                                {...field}
                                            />
                                        )}
                                    />
                                    <FormField
                                        control={form.control as any}
                                        name="phone"
                                        render={({ field }) => (
                                            <LabeledInput
                                                label={
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="h-3 w-3" /> Teléfono
                                                    </span>
                                                }
                                                {...field}
                                            />
                                        )}
                                    />
                                </div>

                                <div className={cn(isLinked && "hidden")}>
                                    <FormField
                                        control={form.control as any}
                                        name="address"
                                        render={({ field }) => (
                                            <LabeledInput
                                                as="textarea"
                                                label={
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" /> Dirección
                                                    </span>
                                                }
                                                rows={3}
                                                {...field}
                                            />
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control as any}
                                    name="website"
                                    render={({ field }) => (
                                        <LabeledInput
                                            label={
                                                <span className="flex items-center gap-1">
                                                    <Globe className="h-3 w-3" /> Sitio Web
                                                </span>
                                            }
                                            placeholder="https://..."
                                            {...field}
                                        />
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
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Logo de la Empresa</p>
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
                                                control={form.control as any}
                                                name="logo_url"
                                                render={({ field }) => (
                                                    <LabeledInput
                                                        label="O utilizar URL externa"
                                                        placeholder="https://..."
                                                        {...field}
                                                    />
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
        </>
    )
}
