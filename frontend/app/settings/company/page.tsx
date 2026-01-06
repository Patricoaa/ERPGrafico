"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { ChevronLeft, Loader2 } from "lucide-react"
import { formatRUT, validateRUT } from "@/lib/utils/format"

const companySchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    tax_id: z.string().min(1, "El RUT es requerido").refine(validateRUT, "RUT inválido"),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email("Email inválido").or(z.literal("")),
    website: z.string().url("URL inválida").or(z.literal("")),
    logo_url: z.string().url("URL de logo inválida").or(z.literal("")),
})

type CompanyFormValues = z.infer<typeof companySchema>

export default function CompanySettingsPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const form = useForm<CompanyFormValues>({
        resolver: zodResolver(companySchema),
        defaultValues: {
            name: "",
            tax_id: "",
            address: "",
            phone: "",
            email: "",
            website: "",
            logo_url: "",
        }
    })

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/core/company/current/')
                form.reset(res.data)
            } catch (error: any) {
                if (error.response?.status !== 404) {
                    toast.error("Error al cargar configuración")
                }
            } finally {
                setLoading(false)
            }
        }
        fetchSettings()
    }, [form])

    async function onSubmit(data: CompanyFormValues) {
        setSaving(true)
        try {
            await api.patch('/core/company/current/', data)
            toast.success("Configuración guardada")
        } catch (error) {
            toast.error("Error al guardar")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-3xl font-bold tracking-tight">Datos de la Empresa</h2>
            </div>

            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle>Información General</CardTitle>
                    <CardDescription>Estos datos se utilizarán en facturas, reportes y correos electrónicos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre / Razón Social</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
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
                                            <FormLabel>RUT</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    onChange={(e) => field.onChange(formatRUT(e.target.value))}
                                                />
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
                                            <Textarea {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Teléfono</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
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
                                            <FormLabel>Email de Contacto</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="email" />
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
                                        <FormLabel>Sitio Web</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="https://..." />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="logo_url"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>URL del Logo</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="https://..." />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Guardar Cambios
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}
