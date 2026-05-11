"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createEmployee, updateEmployee, getAFPs, getPayrollConcepts } from '@/features/hr/api/hrApi'
import type { Employee, AFP, PayrollConcept, EmployeeConceptAmount } from "@/types/hr"
import { Button } from "@/components/ui/button"
import { SubmitButton, CancelButton } from "@/components/shared/ActionButtons"
import { UserCog, CalendarCheck2, Plus, ShieldCheck, ChevronUp, ChevronDown, Trash2, Check, Clock, Settings2, Package, Layers, Wand2, X } from "lucide-react"
import { ActivitySidebar } from "@/features/audit/components/ActivitySidebar"

import {
    Form, FormField, FormItem, FormLabel, FormControl
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { BaseModal, EmptyState, LabeledInput, LabeledSelect, FormTabs, FormTabsContent, FormSection, FormSplitLayout, type FormTabItem, FormFooter } from "@/components/shared"

export const employeeSchema = z.object({
    contact: z.string().min(1, "Contacto requerido"),
    position: z.string().optional(),
    department: z.string().optional(),
    start_date: z.string().optional(),
    base_salary: z.string().min(1, "Sueldo base requerido"),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    contract_type: z.enum(["INDEFINIDO", "PLAZO_FIJO"]),
    afp: z.string().nullable(),
    salud_type: z.enum(["FONASA", "ISAPRE"]),
    isapre_amount_uf: z.string(),
    jornada_type: z.enum(["ORDINARIA_22", "PARCIAL_40BIS", "EXENTA_22", "EXTRAORDINARIA_30"]),
    jornada_hours: z.string(),
    trabajo_pesado: z.boolean(),
    trabajo_agricola: z.boolean(),
    gratificacion: z.boolean(),
    dias_pactados: z.number().min(1).max(31),
    asignacion_familiar: z.enum(["A", "B", "C", "D"]),
    cargas_familiares: z.number().min(0),
    concept_amounts: z.record(z.string(), z.string()).optional(),
})

export type EmployeeFormValues = z.infer<typeof employeeSchema>

export interface EmployeeFormModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    employee: Employee | null
    onSaved: () => void
    trigger?: React.ReactNode
}

export function EmployeeFormModal({ open, onOpenChange, employee, onSaved, trigger }: EmployeeFormModalProps) {
    const [saving, setSaving] = useState(false)
    const [afps, setAfps] = useState<AFP[]>([])
    const [activeTab, setActiveTab] = useState("contratacion")

    const form = useForm<EmployeeFormValues>({
        resolver: zodResolver(employeeSchema),
        defaultValues: {
            contact: "",
            position: "",
            department: "",
            start_date: "",
            base_salary: "0",
            status: "ACTIVE",
            contract_type: "INDEFINIDO",
            afp: null,
            salud_type: "FONASA",
            isapre_amount_uf: "0",
            jornada_type: "ORDINARIA_22",
            jornada_hours: "44.0",
            trabajo_pesado: false,
            trabajo_agricola: false,
            gratificacion: true,
            dias_pactados: 30,
            asignacion_familiar: "D",
            cargas_familiares: 0,
            concept_amounts: {},
        }
    })

    const [availableConcepts, setAvailableConcepts] = useState<PayrollConcept[]>([])

    useEffect(() => {
        if (open) {
            Promise.all([
                getAFPs(),
                getPayrollConcepts({ formula_type: 'EMPLOYEE_SPECIFIC' })
            ]).then(([afpsData, conceptsData]) => {
                setAfps(afpsData)
                setAvailableConcepts(conceptsData.filter((c: PayrollConcept) => c.formula_type === 'EMPLOYEE_SPECIFIC'))
            })
        }
    }, [open])

    useEffect(() => {
        if (employee) {
            form.reset({
                contact: String(employee.contact),
                position: employee.position || "",
                department: employee.department || "",
                start_date: (employee.start_date || "").split("T")[0] || "",
                base_salary: String(employee.base_salary),
                status: employee.status,
                contract_type: employee.contract_type,
                afp: employee.afp ? String(employee.afp) : null,
                salud_type: employee.salud_type,
                isapre_amount_uf: String(employee.isapre_amount_uf || "0"),
                jornada_type: (employee.jornada_type as EmployeeFormValues["jornada_type"]) || "ORDINARIA_22",
                jornada_hours: String(employee.jornada_hours || "44.0"),
                trabajo_pesado: !!employee.trabajo_pesado,
                trabajo_agricola: !!employee.trabajo_agricola,
                gratificacion: !!employee.gratificacion,
                dias_pactados: employee.dias_pactados || 30,
                asignacion_familiar: (employee.asignacion_familiar as EmployeeFormValues["asignacion_familiar"]) || "D",
                cargas_familiares: employee.cargas_familiares || 0,
                concept_amounts: (employee.concept_amounts || []).reduce((acc: Record<string, string>, curr: EmployeeConceptAmount) => {
                    acc[String(curr.concept)] = String(curr.amount)
                    return acc
                }, {}) || {},
            })
        } else {
            form.reset({
                contact: "",
                position: "",
                department: "",
                start_date: new Date().toISOString().split("T")[0],
                base_salary: "0",
                status: "ACTIVE",
                contract_type: "INDEFINIDO",
                afp: null,
                salud_type: "FONASA",
                isapre_amount_uf: "0",
                jornada_type: "ORDINARIA_22",
                jornada_hours: "44.0",
                trabajo_pesado: false,
                trabajo_agricola: false,
                gratificacion: true,
                dias_pactados: 30,
                asignacion_familiar: "D",
                cargas_familiares: 0,
                concept_amounts: {},
            })
        }
    }, [employee, form, open])

    const onSubmit = async (data: EmployeeFormValues) => {
        setSaving(true)
        try {
            // Prepare concept_amounts for backend (list of objects)
            const conceptAmountsList = Object.entries(data.concept_amounts || {}).map(([conceptId, amount]) => ({
                concept: parseInt(conceptId),
                amount: amount
            })).filter(ca => ca.amount !== "" && ca.amount !== null)

            const payload = {
                ...data,
                contact: parseInt(data.contact),
                afp: data.afp ? parseInt(data.afp) : null,
                base_salary: parseFloat(String(data.base_salary)) || 0,
                isapre_amount_uf: parseFloat(String(data.isapre_amount_uf)) || 0,
                jornada_hours: parseFloat(String(data.jornada_hours)) || 0,
                concept_amounts: conceptAmountsList
            }
            if (employee) {
                await updateEmployee(employee.id, payload as Parameters<typeof updateEmployee>[1])
                toast.success("Empleado actualizado")
            } else {
                await createEmployee(payload as Parameters<typeof createEmployee>[0])
                toast.success("Empleado creado")
            }
            onSaved()
        } catch (e: unknown) {
            showApiError(e, "Error al guardar empleado")
        } finally {
            setSaving(false)
        }
    }

    // Helper to map field errors to tabs
    const getTabsWithErrors = () => {
        const errors = form.formState.errors
        const tabErrors: { [key: string]: boolean } = {}

        // Contratación tab fields
        const contratacionFields: (keyof EmployeeFormValues)[] = ['contact', 'position', 'department', 'start_date', 'base_salary', 'status', 'contract_type']
        contratacionFields.forEach(field => {
            if (errors[field]) tabErrors['contratacion'] = true
        })

        // Jornada tab fields
        const jornadaFields: (keyof EmployeeFormValues)[] = ['afp', 'salud_type', 'isapre_amount_uf', 'jornada_type', 'jornada_hours', 'trabajo_pesado', 'trabajo_agricola', 'gratificacion', 'dias_pactados', 'asignacion_familiar', 'cargas_familiares']
        jornadaFields.forEach(field => {
            if (errors[field]) tabErrors['jornada'] = true
        })

        // Haberes tab fields
        if (errors['concept_amounts']) tabErrors['haberes'] = true

        return tabErrors
    }

    const tabErrors = getTabsWithErrors()

    const onSubmitError = () => {
        const tabsWithErrors = getTabsWithErrors()
        const firstErrorTab = Object.keys(tabsWithErrors).find(k => tabsWithErrors[k])
        if (firstErrorTab) {
            setActiveTab(firstErrorTab)
            toast.error("Por favor, revise los campos marcados con error")
        }
    }

    const tabItems: FormTabItem[] = [
        {
            value: "contratacion",
            label: "Contratación",
            icon: UserCog,
            hasErrors: tabErrors['contratacion'],
        },
        {
            value: "jornada",
            label: "Jornada y Previsión",
            icon: CalendarCheck2,
            hasErrors: tabErrors['jornada'],
        },
        {
            value: "haberes",
            label: "Haberes Específicos",
            icon: Plus,
            hasErrors: tabErrors['haberes'],
        },
    ]

    const watchSalud = form.watch("salud_type")

    const footer = (
        <FormFooter
            actions={
                <>
                    <CancelButton onClick={() => onOpenChange(false)} disabled={saving} />
                    <SubmitButton
                        loading={saving}
                        onClick={form.handleSubmit(onSubmit, onSubmitError)}
                    >
                        {employee ? "Actualizar Registro" : "Confirmar Contratación"}
                    </SubmitButton>
                </>
            }
        />
    )

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            headerClassName="sr-only"
            size="2xl"
            className="h-[90vh]"
            hideScrollArea={true}
            contentClassName="p-0"
            allowOverflow={true}
            footer={footer}
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit, onSubmitError)} className="flex-1 w-full h-full flex flex-col overflow-visible min-h-0">
                    <FormTabs
                        items={tabItems}
                        value={activeTab}
                        onValueChange={setActiveTab}
                        orientation="vertical"
                        className="flex-1"
                        contentClassName="bg-transparent"
                        header={
                            <div className="flex flex-col p-6 pb-2">
                                <h1 className="text-lg font-black uppercase tracking-widest text-primary flex items-center gap-3">
                                    <UserCog className="h-6 w-6 text-primary" />
                                    {employee ? "Editar Empleado" : "Nuevo Empleado"}
                                </h1>
                                <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
                                    Ficha de Personal <span className="opacity-30">|</span> Recursos Humanos
                                    {employee && (
                                        <>
                                            <span className="opacity-30">|</span>
                                            {employee.display_id} • {employee.contact_detail?.name}
                                        </>
                                    )}
                                </div>
                            </div>
                        }
                    >
                        <fieldset disabled={saving} className="flex-1 min-w-0 transition-opacity disabled:opacity-75 flex flex-col h-full min-h-0">
                        <FormTabsContent value="contratacion" className="h-full w-full flex-1 flex flex-col m-0 p-0 border-0 outline-none overflow-hidden">
                            <FormSplitLayout 
                                sidebar={employee?.id ? <ActivitySidebar entityId={employee.id} entityType="employee" /> : undefined}
                                showSidebar={!!employee?.id}
                            >
                                <div className="space-y-8 pr-2 pb-8">
                                    <div className="grid grid-cols-4 gap-6 items-start">
                                        <div className="col-span-4">
                                            <FormField
                                                control={form.control} name="contact"
                                                render={({ field, fieldState }) => (
                                                    <AdvancedContactSelector
                                                        label="Contacto"
                                                        value={field.value || null}
                                                        onChange={(val) => field.onChange(val || "")}
                                                        error={fieldState.error?.message}
                                                    />
                                                )}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <FormField control={form.control} name="position" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Cargo"
                                                    placeholder="Ej: Vendedor"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )} />
                                        </div>
                                        <div className="col-span-2">
                                            <FormField control={form.control} name="department" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Departamento"
                                                    placeholder="Ventas"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )} />
                                        </div>
                                        <div className="col-span-2">
                                            <FormField control={form.control} name="base_salary" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Sueldo Base ($)"
                                                    required
                                                    type="number"
                                                    min="0"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )} />
                                        </div>
                                        <div className="col-span-2">
                                            <FormField control={form.control} name="contract_type" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Tipo de Contrato"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    options={[
                                                        { value: "INDEFINIDO", label: "Indefinido" },
                                                        { value: "PLAZO_FIJO", label: "Plazo Fijo / Obra" }
                                                    ]}
                                                />
                                            )} />
                                        </div>
                                        <div className="col-span-2">
                                            <FormField control={form.control} name="start_date" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Fecha Ingreso"
                                                    type="date"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                />
                                            )} />
                                        </div>
                                        <div className="col-span-2">
                                            <FormField control={form.control} name="status" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Estado Ficha"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    options={[
                                                        { value: "ACTIVE", label: "Activo" },
                                                        { value: "INACTIVE", label: "Inactivo" }
                                                    ]}
                                                />
                                            )} />
                                        </div>
                                    </div>
                                                </div>
                            </FormSplitLayout>
                        </FormTabsContent>
                        <FormTabsContent value="jornada" className="mt-0 pt-6 px-6 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin space-y-12">
                                <div className="space-y-8">
                                    <FormSection title="Detalles de Jornada" icon={CalendarCheck2} />
                                    <div className="grid grid-cols-4 gap-6 items-start">
                                        <div className="col-span-2">
                                            <FormField control={form.control} name="jornada_type" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Régimen de Trabajo"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    options={[
                                                        { value: "ORDINARIA_22", label: "Ordinaria Art. 22" },
                                                        { value: "PARCIAL_40BIS", label: "Parcial Art 40 BIS" },
                                                        { value: "EXENTA_22", label: "Exenta Art. 22" },
                                                        { value: "EXTRAORDINARIA_30", label: "Extraordinaria Art. 30" }
                                                    ]}
                                                />
                                            )} />
                                        </div>
                                        <div className="col-span-1">
                                            <FormField control={form.control} name="dias_pactados" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Días Mensuales"
                                                    type="number"
                                                    min="1"
                                                    max="31"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                    onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                                                    className="font-black h-[1.5rem]"
                                                />
                                            )} />
                                        </div>
                                        <div className="col-span-1">
                                            <FormField control={form.control} name="jornada_hours" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Horas / Sem"
                                                    type="number"
                                                    step="0.5"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                    className="font-black h-[1.5rem]"
                                                />
                                            )} />
                                        </div>

                                        {/* Boolean Switches Panel */}
                                        <div className="col-span-4 grid grid-cols-3 gap-4">
                                            {[
                                                { name: "gratificacion", label: "Gratificación Legal" },
                                                { name: "trabajo_pesado", label: "Trabajo Pesado" },
                                                { name: "trabajo_agricola", label: "Trabajo Agrícola" }
                                            ].map((sw) => (
                                                <FormField key={sw.name} control={form.control} name={sw.name as any} render={({ field }) => (
                                                    <div className={cn(
                                                        "flex items-center justify-between p-3.5 rounded-md border transition-all",
                                                        field.value ? "bg-primary/5 border-primary/20" : "bg-background border-dashed"
                                                    )}>
                                                        <label className="text-[10px] font-black uppercase tracking-widest">{sw.label}</label>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                                    </div>
                                                )} />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8 pt-6 border-t border-dashed">
                                    <FormSection title="Previsión y Salud" icon={ShieldCheck} />
                                    <div className="grid grid-cols-4 gap-6 items-start">
                                        <div className="col-span-2">
                                            <FormField control={form.control} name="afp" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Institución Previsional (AFP)"
                                                    value={field.value || ""}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    placeholder="Seleccionar..."
                                                    options={afps.map(afp => ({
                                                        value: afp.id.toString(),
                                                        label: `${afp.name} (${afp.percentage}%)`
                                                    }))}
                                                />
                                            )} />
                                        </div>
                                        <div className="col-span-2">
                                            <FormField control={form.control} name="salud_type" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Sistema de Salud"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    options={[
                                                        { value: "FONASA", label: "Fonasa (7%)" },
                                                        { value: "ISAPRE", label: "Isapre (Pactado)" }
                                                    ]}
                                                />
                                            )} />
                                        </div>

                                        {watchSalud === "ISAPRE" && (
                                            <div className="col-span-4 animate-in slide-in-from-top-2 duration-300">
                                                <FormField control={form.control} name="isapre_amount_uf" render={({ field, fieldState }) => (
                                                    <LabeledInput
                                                        label="Monto Pactado (UF)"
                                                        type="number"
                                                        step="0.0001"
                                                        hint="Se descontará el mayor entre el 7% y este monto."
                                                        error={fieldState.error?.message}
                                                        {...field}
                                                        className="font-mono font-black h-[1.5rem]"
                                                    />
                                                )} />
                                            </div>
                                        )}

                                        <div className="col-span-2">
                                            <FormField control={form.control} name="asignacion_familiar" render={({ field, fieldState }) => (
                                                <LabeledSelect
                                                    label="Tramo Asignación Familiar"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    error={fieldState.error?.message}
                                                    options={[
                                                        { value: "A", label: "Tramo A" },
                                                        { value: "B", label: "Tramo B" },
                                                        { value: "C", label: "Tramo C" },
                                                        { value: "D", label: "Tramo D" }
                                                    ]}
                                                />
                                            )} />
                                        </div>
                                        <div className="col-span-2">
                                            <FormField control={form.control} name="cargas_familiares" render={({ field, fieldState }) => (
                                                <LabeledInput
                                                    label="Número de Cargas"
                                                    type="number"
                                                    min="0"
                                                    error={fieldState.error?.message}
                                                    {...field}
                                                    onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                                                    className="font-black h-[1.5rem]"
                                                />
                                            )} />
                                        </div>
                                    </div>
                                </div>
                            </FormTabsContent>
                            <FormTabsContent value="haberes" className="mt-0 pt-6 px-6 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin">
                                <div className="space-y-8">
                                    {availableConcepts.length > 0 ? (
                                        <div className="grid grid-cols-4 gap-6 items-start">
                                            {availableConcepts.map(concept => (
                                                <div key={concept.id} className="col-span-1">
                                                    <LabeledInput
                                                        label={concept.name}
                                                        type="number"
                                                        step="1"
                                                        placeholder="0"
                                                        value={(form.watch("concept_amounts")?.[concept.id]) || ""}
                                                        onChange={(e) => {
                                                            const current = form.getValues("concept_amounts") || {}
                                                            form.setValue("concept_amounts", { ...current, [concept.id]: e.target.value }, { shouldDirty: true })
                                                        }}
                                                        className="font-mono font-black h-[1.5rem]"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-20 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center text-center px-10 bg-muted/5">
                                            <Plus className="h-10 w-10 text-muted-foreground/20 mb-4" />
                                            <h4 className="font-black uppercase tracking-widest text-muted-foreground/80 text-xs">Sin Conceptos Definidos</h4>
                                            <p className="text-[10px] text-muted-foreground/50 max-w-xs mt-2 font-medium leading-relaxed italic">
                                                No existen haberes específicos pactados para este perfil de empleado.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </FormTabsContent>
                        </fieldset>
                    </FormTabs>
                </form>
            </Form>
        </BaseModal>
    )
}
