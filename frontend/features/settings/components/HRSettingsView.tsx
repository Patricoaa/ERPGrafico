"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
    Loader2,
    CloudCheck,
    CloudUpload,
    Plus,
    Trash2,
    Settings2,
    AlertCircle
} from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { PageHeader } from "@/components/shared/PageHeader"
import { ServerPageTabs } from "@/components/shared/ServerPageTabs"
import {
    getGlobalHRSettings,
    updateGlobalHRSettings,
    getAFPs,
    createAFP,
    updateAFP,
    deleteAFP,
    getPayrollConcepts,
    createPayrollConcept,
    updatePayrollConcept,
    deletePayrollConcept
} from "@/lib/hr/api"
import type {
    AFP,
    PayrollConcept
} from "@/types/hr"
import { Badge } from "@/components/ui/badge"
import { FormulaBuilder } from "@/features/hr/components/FormulaBuilder"

const globalSettingsSchema = z.object({
    uf_current_value: z.string(),
    utm_current_value: z.string(),
    min_wage_value: z.string(),
    account_remuneraciones_por_pagar: z.string().nullable(),
    account_previred_por_pagar: z.string().nullable(),
    account_anticipos: z.string().nullable(),
})

const conceptSchema = z.object({
    name: z.string().min(1, "Nombre requerido"),
    category: z.enum(['HABER_IMPONIBLE', 'HABER_NO_IMPONIBLE', 'DESCUENTO_LEGAL_TRABAJADOR', 'DESCUENTO_LEGAL_EMPLEADOR', 'OTRO_DESCUENTO']),
    account: z.string().min(1, "Cuenta requerida"),
    formula_type: z.enum(['FIXED', 'PERCENTAGE', 'EMPLOYEE_SPECIFIC', 'FORMULA', 'CHILEAN_LAW']),
    formula: z.string().optional(),
    default_amount: z.string(),
})

const afpSchema = z.object({
    name: z.string().min(1, "Nombre requerido"),
    percentage: z.string().min(1, "Porcentaje requerido"),
    account: z.string().nullable(),
})

export function HRSettingsView({ activeTab }: { activeTab: string }) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [concepts, setConcepts] = useState<PayrollConcept[]>([])
    const [afps, setAfps] = useState<AFP[]>([])

    // Global Settings Form
    const globalForm = useForm<z.infer<typeof globalSettingsSchema>>({
        resolver: zodResolver(globalSettingsSchema),
        defaultValues: {
            uf_current_value: "0",
            utm_current_value: "0",
            min_wage_value: "0",
            account_remuneraciones_por_pagar: null,
            account_previred_por_pagar: null,
            account_anticipos: null,
        }
    })

    const fetchData = useCallback(async () => {
        try {
            const [settings, conceptsData, afpsData] = await Promise.all([
                getGlobalHRSettings(),
                getPayrollConcepts(),
                getAFPs()
            ])

            globalForm.reset({
                uf_current_value: settings.uf_current_value,
                utm_current_value: settings.utm_current_value,
                min_wage_value: settings.min_wage_value || "500000",
                account_remuneraciones_por_pagar: settings.account_remuneraciones_por_pagar?.toString() || null,
                account_previred_por_pagar: settings.account_previred_por_pagar?.toString() || null,
                account_anticipos: settings.account_anticipos?.toString() || null,
            })
            setConcepts(conceptsData)
            setAfps(afpsData)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar datos de RRHH")
        } finally {
            setLoading(false)
        }
    }, [globalForm])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Auto-save global settings
    const watchedGlobal = globalForm.watch()
    const { isDirty: isGlobalDirty } = globalForm.formState

    const onSaveGlobal = useCallback(async (data: z.infer<typeof globalSettingsSchema>) => {
        setSaving(true)
        try {
            await updateGlobalHRSettings(data as any)
            globalForm.reset(data)
        } catch {
            toast.error("Error al guardar parámetros globales")
        } finally {
            setSaving(false)
        }
    }, [globalForm])

    useEffect(() => {
        if (!loading && isGlobalDirty) {
            const timer = setTimeout(() => {
                globalForm.handleSubmit(onSaveGlobal)()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [watchedGlobal, loading, isGlobalDirty, globalForm, onSaveGlobal])

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <PageHeader
                title="Configuración de RRHH"
                description="Gestione parámetros generales comerciales y contables aplicables al módulo de RRHH."
                icon={Settings2}
            >
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-[10px] font-medium transition-all duration-300">
                        {saving ? (
                            <>
                                <CloudUpload className="h-3 w-3 animate-pulse text-primary" />
                                <span className="text-primary">Guardando...</span>
                            </>
                        ) : (
                            <>
                                <CloudCheck className="h-3 w-3 text-emerald-500" />
                                <span className="text-emerald-600">Guardado</span>
                            </>
                        )}
                    </div>
                </div>
            </PageHeader>

            <ServerPageTabs
                tabs={[
                    { value: "global", label: "Globales", iconName: "settings", href: "/settings/hr?tab=global" },
                    { value: "concepts", label: "Conceptos", iconName: "list-checks", href: "/settings/hr?tab=concepts" },
                    { value: "previsional", label: "Previsión / AFP", iconName: "building", href: "/settings/hr?tab=previsional" },
                ]}
                activeValue={activeTab}
                maxWidth="max-w-xl"
            />

            <div className="mt-6">
                <Tabs value={activeTab} className="w-full h-full m-0 p-0 border-0 outline-none">

                    {/* --- Tab: Global --- */}
                    <TabsContent value="global" className="space-y-6">
                        <Form {...globalForm}>
                            <div className="grid gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg text-primary">Indicadores Económicos</CardTitle>
                                        <CardDescription>Valores oficiales para el cálculo mensual</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <FormField
                                            control={globalForm.control}
                                            name="uf_current_value"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Valor UF Actual ($)</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} type="number" step="0.01" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={globalForm.control}
                                            name="min_wage_value"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Sueldo Mínimo ($)</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} type="number" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={globalForm.control}
                                            name="utm_current_value"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Valor UTM Actual ($)</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} type="number" step="0.01" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2 text-primary">
                                            <AlertCircle className="h-4 w-4" />
                                            Cuentas Consolidadas
                                        </CardTitle>
                                        <CardDescription>Cuentas contables de cierre de nómina centralizado</CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <FormField
                                            control={globalForm.control}
                                            name="account_remuneraciones_por_pagar"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Remuneraciones por Pagar (Líquido)</FormLabel>
                                                    <FormControl>
                                                        <AccountSelector
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            accountType="LIABILITY"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={globalForm.control}
                                            name="account_previred_por_pagar"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Obligaciones Previred (Pasivo)</FormLabel>
                                                    <FormControl>
                                                        <AccountSelector
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            accountType="LIABILITY"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={globalForm.control}
                                            name="account_anticipos"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-[10px] font-bold uppercase text-muted-foreground">Anticipos de Remuneraciones (Activo)</FormLabel>
                                                    <FormControl>
                                                        <AccountSelector
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            accountType="ASSET"
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </Form>
                    </TabsContent>

                    {/* --- Tab: Conceptos --- */}
                    <TabsContent value="concepts" className="space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg text-emerald-600">Haberes y Descuentos Dinámicos</CardTitle>
                                    <CardDescription>Gestión de fórmulas y cuentas por cada concepto</CardDescription>
                                </div>
                                <ConceptDialog onSaved={fetchData} />
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Categoría</TableHead>
                                            <TableHead>Fórmula / Tipo</TableHead>
                                            <TableHead className="font-mono text-xs">Cuenta</TableHead>
                                            <TableHead className="w-[100px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {concepts.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-medium text-sm">
                                                    {c.name}
                                                    {c.is_system && <Badge variant="secondary" className="ml-2 text-[8px] h-4">Sistema</Badge>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        c.category.includes('HABER') ? 'default' : 'destructive'
                                                    } className="text-[10px]">
                                                        {c.category_display}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {c.formula_type_display}
                                                </TableCell>
                                                <TableCell className="text-xs font-mono">
                                                    {c.account_code}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-end gap-2">
                                                        <ConceptDialog concept={c} onSaved={fetchData} />
                                                        {!c.is_system && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                                                onClick={async () => {
                                                                    if (confirm("¿Eliminar este concepto?")) {
                                                                        await deletePayrollConcept(c.id)
                                                                        fetchData()
                                                                    }
                                                                }}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- Tab: Previsión --- */}
                    <TabsContent value="previsional" className="space-y-6">
                        <div className="flex justify-between items-center px-1">
                            <div>
                                <h3 className="text-lg font-medium text-primary text-shadow">Instituciones Previsionales (AFP)</h3>
                                <p className="text-sm text-muted-foreground">Gestión de comisiones para cálculo individual</p>
                            </div>
                            <AFPDialog onSaved={fetchData} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {afps.map((afp) => (
                                <Card key={afp.id} className="relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base font-bold">{afp.name}</CardTitle>
                                            <AFPDialog afp={afp} onSaved={fetchData} />
                                        </div>
                                        <CardDescription className="text-2xl font-bold text-primary">
                                            {afp.percentage}%
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Pasivo de Pago</div>
                                        <div className="text-xs truncate font-mono bg-muted/50 p-1.5 rounded-md inline-block max-w-full">
                                            {afp.account ? "Asignada cuenta contable" : "Sin asignar"}
                                        </div>
                                        <Button variant="ghost" size="sm" className="mt-4 w-full text-destructive hover:bg-destructive/10"
                                            onClick={async () => {
                                                if (confirm("¿Eliminar AFP?")) {
                                                    await deleteAFP(afp.id)
                                                    fetchData()
                                                }
                                            }}>
                                            Eliminar Institución
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

// --- DIALOGS ---

function ConceptDialog({ concept, onSaved }: { concept?: PayrollConcept, onSaved: () => void }) {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const form = useForm<z.infer<typeof conceptSchema>>({
        resolver: zodResolver(conceptSchema),
        defaultValues: concept ? {
            name: concept.name,
            category: concept.category,
            account: concept.account.toString(),
            formula_type: concept.formula_type,
            formula: concept.formula || "",
            default_amount: concept.default_amount,
        } : {
            name: "",
            category: "HABER_IMPONIBLE",
            account: "",
            formula_type: "FIXED",
            formula: "",
            default_amount: "0",
        }
    })

    const onSubmit = async (data: z.infer<typeof conceptSchema>) => {
        setSaving(true)
        try {
            if (concept) {
                await updatePayrollConcept(concept.id, data as any)
                toast.success("Concepto actualizado")
            } else {
                await createPayrollConcept(data as any)
                toast.success("Concepto creado")
            }
            onSaved()
            setOpen(false)
        } catch {
            toast.error("Error al guardar concepto")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {concept ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Settings2 className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" /> Nuevo Cpto.
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{concept ? "Editar Concepto" : "Añadir Nuevo Concepto"}</DialogTitle>
                    <DialogDescription>
                        Defina el comportamiento y la cuenta contable de este ítem de nómina.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione categoría" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="HABER_IMPONIBLE">Haber Imponible</SelectItem>
                                            <SelectItem value="HABER_NO_IMPONIBLE">Haber No Imponible</SelectItem>
                                            <SelectItem value="DESCUENTO_LEGAL_TRABAJADOR">Desc. Legal (Cargo Trabajador)</SelectItem>
                                            <SelectItem value="DESCUENTO_LEGAL_EMPLEADOR">Desc. Legal (Cargo Empleador)</SelectItem>
                                            <SelectItem value="OTRO_DESCUENTO">Otro Descuento / Anticipo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="account"
                            render={({ field }) => {
                                const category = form.watch("category")
                                let accountType: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE" | undefined = undefined

                                if (category === 'HABER_IMPONIBLE' || category === 'HABER_NO_IMPONIBLE' || category === 'DESCUENTO_LEGAL_EMPLEADOR') {
                                    accountType = 'EXPENSE'
                                } else if (category === 'DESCUENTO_LEGAL_TRABAJADOR') {
                                    accountType = 'LIABILITY'
                                }
                                return (
                                    <FormItem>
                                        <FormLabel>Cuenta Contable</FormLabel>
                                        <FormControl>
                                            <AccountSelector
                                                value={field.value}
                                                onChange={field.onChange}
                                                accountType={accountType}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )
                            }}
                        />
                        <FormField
                            control={form.control}
                            name="formula_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Lógica de Cálculo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione lógica" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="FIXED">Monto Fijo (Manual)</SelectItem>
                                            <SelectItem value="PERCENTAGE">Porcentaje % (del Imponible)</SelectItem>
                                            <SelectItem value="EMPLOYEE_SPECIFIC">Ficha Empleado (Individual)</SelectItem>
                                            <SelectItem value="FORMULA">Fórmula Matemática</SelectItem>
                                            <SelectItem value="CHILEAN_LAW">Legal Chile (Automático)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />

                        {form.watch("formula_type") === 'FORMULA' && (
                            <FormField
                                control={form.control}
                                name="formula"
                                render={({ field }) => (
                                    <FormItem className="bg-muted/50 p-3 rounded-md border border-dashed">
                                        <FormLabel className="flex items-center gap-2">
                                            Constructor de Fórmula
                                            <Badge variant="outline" className="text-[9px]">Avanzado</Badge>
                                        </FormLabel>
                                        <FormControl>
                                            <div className="space-y-3">
                                                <Input {...field} placeholder="BASE * 0.25" className="font-mono bg-background" />
                                                <FormulaBuilder
                                                    value={field.value || ""}
                                                    onChange={field.onChange}
                                                />
                                            </div>
                                        </FormControl>

                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {(form.watch("formula_type") === 'FIXED' || form.watch("formula_type") === 'PERCENTAGE') && (
                            <FormField
                                control={form.control}
                                name="default_amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {form.watch("formula_type") === 'PERCENTAGE' ? "Porcentaje %" : "Monto por Defecto"}
                                        </FormLabel>
                                        <FormControl><Input {...field} type="number" step="0.0001" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <DialogFooter>
                            <Button type="submit" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Concepto
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

function AFPDialog({ afp, onSaved }: { afp?: AFP, onSaved: () => void }) {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const form = useForm<z.infer<typeof afpSchema>>({
        resolver: zodResolver(afpSchema),
        defaultValues: afp ? {
            name: afp.name,
            percentage: afp.percentage,
            account: afp.account?.toString() || null,
        } : {
            name: "",
            percentage: "10.00",
            account: null,
        }
    })

    const onSubmit = async (data: z.infer<typeof afpSchema>) => {
        setSaving(true)
        try {
            if (afp) {
                await updateAFP(afp.id, data as any)
                toast.success("AFP actualizada")
            } else {
                await createAFP(data as any)
                toast.success("AFP registrada")
            }
            onSaved()
            setOpen(false)
        } catch {
            toast.error("Error al guardar AFP")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {afp ? (
                    <Button variant="outline" size="icon" className="h-7 w-7">
                        <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                ) : (
                    <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" /> Añadir Institución
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Mantenimiento de Institución Previsional</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl><Input {...field} placeholder="Ej: Habitat..." /></FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="percentage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Comisión Total (%)</FormLabel>
                                    <FormControl><Input {...field} type="number" step="0.0001" /></FormControl>
                                    <p className="text-[10px] text-muted-foreground italic">Incluya el 10% obligatorio + la comisión.</p>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cuenta Pasivo Individual</FormLabel>
                                    <FormControl>
                                        <AccountSelector
                                            value={field.value}
                                            onChange={field.onChange}
                                            accountType="LIABILITY"
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={saving} className="w-full">
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Guardar Institución"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
