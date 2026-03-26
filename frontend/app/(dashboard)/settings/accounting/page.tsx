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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const accountingSchema = z.object({
    // Legacy/deprecated accounts (kept for backward compatibility)
    default_inventory_account: z.string().nullable(),
    default_expense_account: z.string().nullable(),

    // Core structure
    hierarchy_levels: z.coerce.number().min(2).max(5),
    code_separator: z.string().min(1).max(1),
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

            hierarchy_levels: 4,
            code_separator: ".",
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
                        formattedSettings[key] = (key.includes('prefix') || key === 'code_separator' ? "" : (key === 'hierarchy_levels' ? 4 : null)) as never
                    } else {
                        formattedSettings[key] = (typeof val === 'number' ? val : val.toString()) as never
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
            toast.success("Configuración guardada automáticamente")
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

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 max-w-6xl mx-auto">
            <PageHeader
                title="Configuración Contable"
                description="Configura la estructura del plan de cuentas y reglas de negocio."
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
                    <Card className="border-primary/10 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-primary" />
                                Estructura del Código
                            </CardTitle>
                            <CardDescription>Defina cómo se construyen automáticamente los códigos de cuenta.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            
                            <CodePreview values={watchedValues} />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="hierarchy_levels"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Niveles de Jerarquía</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccione niveles" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {[2, 3, 4, 5].map((n) => (
                                                            <SelectItem key={n} value={n.toString()}>{n} Niveles</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="code_separator"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Separador de Jerarquía</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Seleccione separador" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value=".">Punto ( . )</SelectItem>
                                                        <SelectItem value="-">Guion ( - )</SelectItem>
                                                        <SelectItem value="/">Slash ( / )</SelectItem>
                                                        <SelectItem value="|">Pipe ( | )</SelectItem>
                                                        <SelectItem value=" ">Espacio</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                                    <h4 className="text-sm font-semibold mb-2">Prefijos por Tipo (Nivel 1)</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField control={form.control} name="asset_prefix" render={({ field }) => (
                                            <FormItem className="space-y-1">
                                                <FormLabel className="text-[10px] uppercase text-muted-foreground">Activos</FormLabel>
                                                <FormControl><Input {...field} className="h-8" /></FormControl>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="liability_prefix" render={({ field }) => (
                                            <FormItem className="space-y-1">
                                                <FormLabel className="text-[10px] uppercase text-muted-foreground">Pasivos</FormLabel>
                                                <FormControl><Input {...field} className="h-8" /></FormControl>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="equity_prefix" render={({ field }) => (
                                            <FormItem className="space-y-1">
                                                <FormLabel className="text-[10px] uppercase text-muted-foreground">Patrimonio</FormLabel>
                                                <FormControl><Input {...field} className="h-8" /></FormControl>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="income_prefix" render={({ field }) => (
                                            <FormItem className="space-y-1">
                                                <FormLabel className="text-[10px] uppercase text-muted-foreground">Ingresos</FormLabel>
                                                <FormControl><Input {...field} className="h-8" /></FormControl>
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="expense_prefix" render={({ field }) => (
                                            <FormItem className="space-y-1">
                                                <FormLabel className="text-[10px] uppercase text-muted-foreground">Gastos</FormLabel>
                                                <FormControl><Input {...field} className="h-8" /></FormControl>
                                            </FormItem>
                                        )} />
                                    </div>
                                </div>
                            </div>

                            <Alert variant="warning" className="bg-amber-50 border-amber-200">
                                <Settings2 className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800 font-bold">Importante: Sincronización Automática</AlertTitle>
                                <AlertDescription className="text-amber-700 text-xs">
                                    Al modificar los prefijos o el separador, el sistema actualizará automáticamente todos los códigos de cuenta existentes para mantener la coherencia. Este proceso puede tardar unos segundos.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </form>
            </Form>
        </div>
    )
}

function CodePreview({ values }: { values: AccountingFormValues }) {
    const { hierarchy_levels, code_separator, asset_prefix } = values;
    
    const generatePreview = () => {
        let code = asset_prefix || "1";
        const levels = [
            { padding: 1 }, // Level 2
            { padding: 2 }, // Level 3
            { padding: 2 }, // Level 4
            { padding: 3 }, // Level 5
        ];
        
        for (let i = 0; i < Math.min(hierarchy_levels - 1, levels.length); i++) {
            const level = levels[i];
            code += code_separator + "1".padStart(level.padding, "0");
        }
        return code;
    }

    return (
        <div className="p-6 bg-primary/5 border border-primary/10 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300">
            <div className="space-y-1 text-center md:text-left">
                <p className="text-sm font-semibold text-primary/80">Vista Previa del Formato</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Ejemplo de cuenta nivel {hierarchy_levels}</p>
            </div>
            <div className="flex items-center gap-2">
                <div className="px-6 py-3 bg-white border shadow-sm rounded-lg text-2xl font-mono font-bold tracking-tighter text-primary">
                    {generatePreview()}
                </div>
            </div>
        </div>
    )
}
