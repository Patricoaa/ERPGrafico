"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Loader2, Database, Settings2, CloudCheck, CloudUpload } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeader, PageHeaderButton } from "@/components/shared/PageHeader"

const accountingSchema = z.object({
    // Legacy/deprecated accounts (kept for backward compatibility)
    default_inventory_account: z.string().nullable(),
    default_expense_account: z.string().nullable(),

    // Core structure
    code_format: z.string(),
    asset_prefix: z.string(),
    liability_prefix: z.string(),
    equity_prefix: z.string(),
    income_prefix: z.string(),
    expense_prefix: z.string(),
})

type AccountingFormValues = z.infer<typeof accountingSchema>

export default function AccountingSettingsPage() {
    // const router = useRouter() // Not used
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [populating, setPopulating] = useState(false)

    const form = useForm<AccountingFormValues>({
        resolver: zodResolver(accountingSchema),
        defaultValues: {
            default_inventory_account: null,
            default_expense_account: null,

            code_format: "X.X.XX.XXX",
            asset_prefix: "1",
            liability_prefix: "2",
            equity_prefix: "3",
            income_prefix: "4",
            expense_prefix: "5",
        }
    })

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/accounting/settings/current/')
                const settings = res.data
                const formattedSettings: Partial<AccountingFormValues> = {}
                const keys = Object.keys(accountingSchema.shape) as (keyof AccountingFormValues)[]

                keys.forEach((key) => {
                    const val = settings[key]
                    if (val === null || val === undefined) {
                        formattedSettings[key] = (key.includes('prefix') || key === 'code_format' ? "" : null) as never
                    } else {
                        formattedSettings[key] = val.toString() as never
                    }
                })
                form.reset(formattedSettings as AccountingFormValues)
            } catch (error: unknown) {
                const err = error as { response?: { status?: number } }
                if (err.response?.status !== 404) {
                    toast.error("Error al cargar configuración")
                }
            } finally {
                setLoading(false)
            }
        }
        fetchSettings()
    }, [form])

    const watchedValues = form.watch()
    const { isDirty } = form.formState

    const onSubmit = useCallback(async (data: AccountingFormValues) => {
        setSaving(true)
        try {
            await api.patch('/accounting/settings/current/', data)
            toast.success("Configuración guardada automáticamene")
            form.reset(data)
        } catch {
            toast.error("Error al guardar")
        } finally {
            setSaving(false)
        }
    }, [form])

    useEffect(() => {
        if (!loading && isDirty) {
            const timer = setTimeout(() => {
                form.handleSubmit(onSubmit)()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedValues, loading, isDirty, form, onSubmit])

    const handlePopulateIFRS = async () => {
        if (!confirm("¿Está seguro de cargar el plan de cuentas IFRS? Esto creará las cuentas detalladas y configurará todos los mapeos predeterminados automáticamente.")) return
        setPopulating(true)
        try {
            const res = await api.post('/accounting/accounts/populate_ifrs/')
            toast.success(res.data.message)
            window.location.reload()
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } }
            toast.error(err.response?.data?.error || "Error al poblar plan de cuentas")
        } finally {
            setPopulating(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }



    // ... (Render logic)

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto">
            <PageHeader
                title="Configuración Contable"
                description="Configura la estructura del plan de cuentas y reglas de negocio. Las cuentas específicas de cada módulo se configuran en sus respectivas páginas de configuración."
            >
                <div className="flex items-center gap-3">
                    <PageHeaderButton
                        onClick={handlePopulateIFRS}
                        disabled={populating}
                        icon={populating ? Loader2 : Database}
                        label={populating ? "Poblando..." : "Poblar Cuentas IFRS"}
                        variant="outline"
                    />
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-[10px] font-medium transition-all duration-300">
                        {saving ? (
                            <>
                                <CloudUpload className="h-3 w-3 animate-pulse text-blue-500" />
                                <span className="text-blue-600">Guardando cambios...</span>
                            </>
                        ) : (
                            <>
                                <CloudCheck className="h-3 w-3 text-emerald-500" />
                                <span className="text-emerald-600">Cambios guardados</span>
                            </>
                        )}
                    </div>
                </div>
            </PageHeader>

            <Form {...form}>
                <form className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Jerarquía del Plan de Cuentas</CardTitle>
                            <CardDescription>Defina cómo se construyen los códigos de cuenta y sus prefijos.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <FormField
                                control={form.control}
                                name="code_format"
                                render={({ field }) => (
                                    <FormItem className="max-w-md">
                                        <FormLabel>Formato de Código</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Ej: X.X.XX.XXX" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <FormField control={form.control} name="asset_prefix" render={({ field }) => (
                                    <FormItem><FormLabel>Activos</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="liability_prefix" render={({ field }) => (
                                    <FormItem><FormLabel>Pasivos</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="equity_prefix" render={({ field }) => (
                                    <FormItem><FormLabel>Patrimonio</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="income_prefix" render={({ field }) => (
                                    <FormItem><FormLabel>Ingresos</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name="expense_prefix" render={({ field }) => (
                                    <FormItem><FormLabel>Gastos</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )} />
                            </div>

                            <Alert>
                                <Settings2 className="h-4 w-4" />
                                <AlertTitle>Nota sobre prefijos</AlertTitle>
                                <AlertDescription>
                                    El sistema utiliza estos prefijos para sugerir códigos al crear nuevas cuentas en el nivel raíz.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div >
    )
}

// function AccountField({ form, name, label, accountType }: AccountFieldProps) {
//     return (
//         <FormField
//             control={form.control}
//             name={name}
//             render={({ field }) => (
//                 <FormItem>
//                     <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">{label}</FormLabel>
//                     <FormControl>
//                         <AccountSelector
//                             value={field.value as string}
//                             onChange={(val) => field.onChange(val)}
//                             accountType={accountType}
//                         />
//                     </FormControl>
//                     <FormMessage />
//                 </FormItem>
//             )}
//         />
//     )
// }
