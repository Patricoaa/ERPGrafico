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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Loader2,
    CloudCheck,
    CloudUpload,
    Plus,
    Trash2,
    Settings2,
    AlertCircle
} from "lucide-react"
import { BaseModal } from "@/components/shared/BaseModal"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { PageHeader } from "@/components/shared/PageHeader"
import { PageTabs } from "@/components/shared/PageTabs"
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
    PayrollConcept,
    GlobalHRSettings
} from "@/types/hr"
import { Badge } from "@/components/ui/badge"
import { FormulaBuilder } from "@/features/hr/components/FormulaBuilder"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";

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

export function HRSettingsView({ activeTab = "global", onSavingChange }: { 
    activeTab?: string,
    onSavingChange?: (saving: boolean) => void
}) {
    const [currentTab, setCurrentTab] = useState(activeTab)
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

    const conceptDeleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deletePayrollConcept(id)
            toast.success("Concepto eliminado")
            fetchData()
        } catch {
            toast.error("Error al eliminar concepto")
        }
    })

    const afpDeleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteAFP(id)
            toast.success("AFP eliminada")
            fetchData()
        } catch {
            toast.error("Error al eliminar AFP")
        }
    })

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

    useEffect(() => {
        onSavingChange?.(saving)
    }, [saving, onSavingChange])

    const conceptColumns: ColumnDef<PayrollConcept>[] = [
        {
            accessorKey: "name",
            header: "Concepto de Nómina",
            cell: ({ row }) => (
                <div className="flex items-center gap-2 py-1">
                    <span className="font-black text-[12px] tracking-tight uppercase leading-none">{row.getValue("name")}</span>
                    {row.original.is_system && (
                        <Badge variant="secondary" className="text-[8px] font-black h-4 px-1 rounded-sm bg-primary/10 text-primary border-primary/20">
                            SYSTEM
                        </Badge>
                    )}
                </div>
            )
        },
        {
            accessorKey: "category_display",
            header: "Categoría",
            cell: ({ row }) => {
                const category = row.original.category
                const isHaber = category.includes('HABER')
                return (
                    <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase h-5 shadow-sm rounded-sm",
                        isHaber ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"
                    )}>
                        {row.getValue("category_display")}
                    </Badge>
                )
            }
        },
        {
            accessorKey: "formula_type_display",
            header: "Lógica / Fórmula",
            cell: ({ row }) => (
                <span className="text-[10px] font-medium text-muted-foreground italic">
                    {row.getValue("formula_type_display")}
                </span>
            )
        },
        {
            accessorKey: "account_code",
            header: "Cuenta Contable",
            cell: ({ row }) => (
                <div className="font-mono text-[10px] text-primary/70 bg-primary/5 px-2 py-0.5 rounded-sm border border-primary/10 w-fit">
                    {row.getValue("account_code")}
                </div>
            )
        },
        {
            id: "actions",
            header: () => <div className="text-right pr-4">Acciones</div>,
            cell: ({ row }) => (
                <div className="flex justify-end gap-1 pr-2">
                    <ConceptDialog concept={row.original} onSaved={fetchData} />
                    {!row.original.is_system && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-sm"
                            onClick={() => conceptDeleteConfirm.requestConfirm(row.original.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            )
        }
    ]

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-12 p-1 bg-muted/50 rounded-md border-2">
                    <TabsTrigger value="global" className="text-[10px] uppercase font-black tracking-widest gap-2">
                        <Settings2 className="h-3.5 w-3.5" />
                        Globales
                    </TabsTrigger>
                    <TabsTrigger value="concepts" className="text-[10px] uppercase font-black tracking-widest gap-2">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Conceptos
                    </TabsTrigger>
                    <TabsTrigger value="previsional" className="text-[10px] uppercase font-black tracking-widest gap-2">
                        <Loader2 className="h-3.5 w-3.5" />
                        Previsión
                    </TabsTrigger>
                </TabsList>

                {/* --- Tab: Global --- */}
                <TabsContent value="global" className="space-y-6 m-0 p-0 border-0 outline-none mt-6">
                    <Form {...globalForm}>
                        <div className="grid gap-6">
                            <Card className="rounded-md border-2">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Indicadores Económicos</CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-bold">Valores oficiales para el cálculo mensual</CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <FormField
                                        control={globalForm.control}
                                        name="uf_current_value"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Valor UF Actual ($)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} type="number" step="0.01" className="h-10 font-mono rounded-sm" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={globalForm.control}
                                        name="min_wage_value"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Sueldo Mínimo ($)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} type="number" className="h-10 font-mono rounded-sm" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={globalForm.control}
                                        name="utm_current_value"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Valor UTM Actual ($)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} type="number" step="0.01" className="h-10 font-mono rounded-sm" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            <Card className="rounded-md border-2">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 opacity-50" />
                                        Cuentas Consolidadas
                                    </CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-bold">Cuentas contables de cierre de nómina centralizado</CardDescription>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <FormField
                                        control={globalForm.control}
                                        name="account_remuneraciones_por_pagar"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-tighter">Remuneraciones por Pagar (Líquido)</FormLabel>
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
                                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-tighter">Obligaciones Previred (Pasivo)</FormLabel>
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
                                                <FormLabel className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-tighter">Anticipos de Remuneraciones (Activo)</FormLabel>
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
                <TabsContent value="concepts" className="space-y-6 m-0 p-0 border-0 outline-none mt-6">
                    <div className="flex justify-between items-center px-1">
                        <div>
                            <h3 className="text-sm font-black uppercase text-primary tracking-widest">Conceptos de Nómina</h3>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Gestión de haberes, descuentos y aportes</p>
                        </div>
                        <ConceptDialog onSaved={fetchData} />
                    </div>

                    <DataTable 
                        columns={conceptColumns}
                        data={concepts}
                        filterColumn="name"
                        searchPlaceholder="Buscar concepto..."
                        isLoading={loading}
                        cardMode={true}
                    />
                </TabsContent>

                {/* --- Tab: Previsión --- */}
                <TabsContent value="previsional" className="space-y-6 m-0 p-0 border-0 outline-none mt-6">
                    <div className="flex justify-between items-center px-1">
                        <div>
                            <h3 className="text-sm font-black uppercase text-primary tracking-widest">Instituciones Previsionales (AFP)</h3>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Gestión de comisiones para cálculo individual</p>
                        </div>
                        <AFPDialog onSaved={fetchData} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {afps.map((afp) => (
                            <Card key={afp.id} className="relative overflow-hidden group hover:border-primary/50 transition-all rounded-md border-2">
                                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <AFPDialog afp={afp} onSaved={fetchData} />
                                </div>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-xs font-black uppercase tracking-tight">{afp.name}</CardTitle>
                                    <CardDescription className="text-2xl font-black text-primary font-heading">
                                        {afp.percentage}%
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-[9px] uppercase text-muted-foreground font-black mb-1 opacity-60">Pasivo de Pago</div>
                                    <div className="text-[10px] truncate font-mono bg-primary/5 p-1.5 rounded-sm border border-primary/10 inline-block max-w-full text-primary font-bold">
                                        {afp.account ? "CENTRALIZADA" : "SIN CUENTA"}
                                    </div>
                                    <Button variant="ghost" size="sm" className="mt-4 w-full text-[9px] font-black uppercase text-destructive hover:bg-destructive/10 rounded-sm"
                                        onClick={() => afpDeleteConfirm.requestConfirm(afp.id)}>
                                        Eliminar Institución
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            <ActionConfirmModal
                open={conceptDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) conceptDeleteConfirm.cancel() }}
                onConfirm={conceptDeleteConfirm.confirm}
                title="Eliminar Concepto"
                description="¿Está seguro de que desea eliminar este concepto de nómina? Esta acción no se puede deshacer."
                variant="destructive"
            />

            <ActionConfirmModal
                open={afpDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) afpDeleteConfirm.cancel() }}
                onConfirm={afpDeleteConfirm.confirm}
                title="Eliminar AFP"
                description="¿Está seguro de que desea eliminar esta AFP? Se perderá el historial asociado."
                variant="destructive"
            />
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
        <>
            {concept ? (
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/5 rounded-sm" onClick={() => setOpen(true)}>
                    <Settings2 className="h-3.5 w-3.5" />
                </Button>
            ) : (
                <Button variant="outline" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest bg-transparent border border-primary/30 text-primary hover:bg-primary/10 transition-all rounded-full shadow-none" onClick={() => setOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-2" /> Nuevo Concepto
                </Button>
            )}

            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="md"
                title={
                    <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
                        Mantenimiento de Concepto
                    </div>
                }
                description="Defina el comportamiento y la cuenta contable de este ítem de nómina."
                footer={
                    <div className="flex w-full gap-3 justify-end pt-2 border-t">
                        <ActionSlideButton type="submit" form="concept-form" disabled={saving} className="w-full h-10 font-black uppercase tracking-widest text-[11px]">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Validar y Guardar Cambios"}
                        </ActionSlideButton>
                    </div>
                }
            >
                <Form {...form}>
                    <form id="concept-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-tighter opacity-70">Nombre Público</FormLabel>
                                    <FormControl><Input {...field} className="h-9 rounded-sm" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-tighter opacity-70">Categoría Nómina</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-9 rounded-sm">
                                                <SelectValue placeholder="Seleccione categoría" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="border-2 font-mono text-[10px]">
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
                                        <FormLabel className="text-[10px] font-black uppercase tracking-tighter opacity-70">Asignación Contable</FormLabel>
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
                                    <FormLabel className="text-[10px] font-black uppercase tracking-tighter opacity-70">Lógica de Cálculo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-9 rounded-sm">
                                                <SelectValue placeholder="Seleccione lógica" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="border-2 font-mono text-[10px]">
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
                                    <FormItem className="bg-primary/5 p-3 rounded-md border border-dashed border-primary/20">
                                        <FormLabel className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-primary">
                                            Constructor de Fórmula
                                            <Badge variant="outline" className="text-[8px] bg-background">ADVANCED</Badge>
                                        </FormLabel>
                                        <FormControl>
                                            <div className="space-y-3">
                                                <Input {...field} placeholder="BASE * 0.25" className="h-8 font-mono bg-background text-[11px] rounded-sm" />
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
                                        <FormLabel className="text-[10px] font-black uppercase tracking-tighter opacity-70">
                                            {form.watch("formula_type") === 'PERCENTAGE' ? "Factor Porcentual (%)" : "Monto Predeterminado ($)"}
                                        </FormLabel>
                                        <FormControl><Input {...field} type="number" step="0.0001" className="h-9 font-mono rounded-sm" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </form>
                </Form>
            </BaseModal>
        </>
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
        <>
            {afp ? (
                <Button variant="outline" size="icon" className="h-7 w-7 border-2 rounded-sm" onClick={() => setOpen(true)}>
                    <Settings2 className="h-3.5 w-3.5" />
                </Button>
            ) : (
                <Button variant="outline" className="h-9 px-4 text-[10px] font-black uppercase tracking-widest bg-transparent border border-primary/30 text-primary hover:bg-primary/10 transition-all rounded-full shadow-none" onClick={() => setOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-2" /> Añadir Institución
                </Button>
            )}

            <BaseModal
                open={open}
                onOpenChange={setOpen}
                size="sm"
                title={
                    <div className="text-sm font-black uppercase tracking-widest">
                        Mantenimiento de AFP
                    </div>
                }
                description="Configure las tasas vigentes para las cotizaciones previsionales."
                footer={
                    <div className="flex w-full gap-3 justify-end pt-2 border-t">
                        <ActionSlideButton type="submit" form="afp-form" disabled={saving} className="w-full h-10 font-black uppercase tracking-widest text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground">
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Guardar Institución"}
                        </ActionSlideButton>
                    </div>
                }
            >
                <Form {...form}>
                    <form id="afp-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-tighter opacity-70">Nombre Legal</FormLabel>
                                    <FormControl><Input {...field} placeholder="Ej: Habitat..." className="h-9 rounded-sm" /></FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="percentage"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-tighter opacity-70">Comisión Total (%)</FormLabel>
                                    <FormControl><Input {...field} type="number" step="0.0001" className="h-9 font-mono rounded-sm" /></FormControl>
                                    <p className="text-[9px] text-muted-foreground/60 italic font-medium uppercase tracking-tight">Incluya el 10% obligatorio + la comisión.</p>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="account"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-tighter opacity-70">Cuenta Pasivo Individual</FormLabel>
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
                    </form>
                </Form>
            </BaseModal>
        </>
    )
}
