"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ClipboardList } from "lucide-react"
import { Form, FormField } from "@/components/ui/form"
import { AccountSelector } from "@/components/selectors/AccountSelector"
import { CancelButton, Chip, Drawer, FormFooter, FormSplitLayout, LabeledInput, LabeledSelect, SubmitButton } from "@/components/shared"
import { useDrawerIdentity, useDrawerMode, type DrawerMode } from "@/features/_shared"
import { FormulaBuilder, useHrSettings } from "@/features/hr"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { frozenFieldsOf } from "@/lib/edit-policy"
import { showApiError } from "@/lib/errors"
import { formDrawerWidth } from "@/lib/form-widths"
import type { PayrollConcept } from "@/types/hr"
import { conceptSchema, type ConceptFormValues } from "./HRSettingsView.schema"

const CATEGORY_OPTIONS = [
    { value: "HABER_IMPONIBLE", label: "Haber Imponible" },
    { value: "HABER_NO_IMPONIBLE", label: "Haber No Imponible" },
    { value: "DESCUENTO_LEGAL_TRABAJADOR", label: "Desc. Legal (Cargo Trabajador)" },
    { value: "DESCUENTO_LEGAL_EMPLEADOR", label: "Desc. Legal (Cargo Empleador)" },
    { value: "OTRO_DESCUENTO", label: "Otro Descuento / Anticipo" },
]

const FORMULA_OPTIONS = [
    { value: "FIXED", label: "Monto Fijo (Manual)" },
    { value: "PERCENTAGE", label: "Porcentaje % (del Imponible)" },
    { value: "EMPLOYEE_SPECIFIC", label: "Ficha Empleado (Individual)" },
    { value: "FORMULA", label: "Fórmula Matemática" },
    { value: "CHILEAN_LAW", label: "Legal Chile (Automático)" },
]

const EMPTY: ConceptFormValues = { name: "", category: "HABER_IMPONIBLE", account: "", formula_type: "FIXED", formula: "", default_amount: "0" }

function accountTypeFor(category: ConceptFormValues["category"]) {
    if (category === "HABER_IMPONIBLE" || category === "HABER_NO_IMPONIBLE" || category === "DESCUENTO_LEGAL_EMPLEADOR") return "EXPENSE" as const
    if (category === "DESCUENTO_LEGAL_TRABAJADOR") return "LIABILITY" as const
    return undefined
}

export interface PayrollConceptDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    concept: PayrollConcept | null
    onSuccess: () => void
    mode?: DrawerMode
}

/** Mantenimiento de un concepto de nómina (haber, descuento o aporte) y su cuenta contable. */
export function PayrollConceptDrawer({ open, onOpenChange, concept, onSuccess, mode: modeProp }: PayrollConceptDrawerProps) {
    const { createConcept, updateConcept } = useHrSettings()
    const { mode, isView } = useDrawerMode({ mode: modeProp, initialData: concept })
    const frozen = frozenFieldsOf(concept ?? undefined)
    const form = useForm<ConceptFormValues>({ resolver: zodResolver(conceptSchema), defaultValues: EMPTY })

    useInitializeDrawerForm({
        form,
        open,
        initialData: concept,
        mapData: (c) => ({
            name: c.name,
            category: c.category,
            account: c.account.toString(),
            formula_type: c.formula_type,
            formula: c.formula || "",
            default_amount: c.default_amount,
        }),
        defaultValues: () => EMPTY,
    })

    const category = form.watch("category")
    const formulaType = form.watch("formula_type")
    const saving = form.formState.isSubmitting

    const save = async (values: ConceptFormValues) => {
        try {
            const payload = { ...values, account: Number(values.account) }
            if (concept) await updateConcept(concept.id, payload)
            else await createConcept(payload)
            onOpenChange(false)
            onSuccess()
        } catch (e: unknown) {
            showApiError(e, "Error al guardar concepto")
        }
    }

    const identity = useDrawerIdentity("hr.payrollconcept", mode, concept, {
        overrideTitle: mode === "create" ? "Nuevo Concepto" : undefined,
        overrideSubtitle: "Defina el comportamiento y la cuenta contable de este ítem de nómina.",
    })

    const footer = isView ? undefined : (
        <FormFooter
            actions={
                <>
                    <CancelButton onClick={() => onOpenChange(false)} />
                    <SubmitButton type="submit" form="payroll-concept-form" loading={saving} disabled={saving}>
                        {mode === "create" ? "Crear" : "Guardar"}
                    </SubmitButton>
                </>
            }
        />
    )

    return (
        <Drawer
            fillContent
            contentClassName="p-0"
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            defaultSize={formDrawerWidth("simple", !!concept)}
            icon={identity.icon ?? ClipboardList}
            title={identity.title}
            subtitle={identity.subtitle}
            headerActions={identity.headerActions}
            mode={mode}
            footer={footer}
        >
            <FormSplitLayout className="space-y-6 p-6">
                <Form {...form}>
                    <form id="payroll-concept-form" onSubmit={form.handleSubmit(save)} className="space-y-4">
                      <fieldset disabled={isView} className="contents space-y-4">
                        <FormField control={form.control} name="name" render={({ field, fieldState }) => (
                            <LabeledInput label="Nombre Público" required error={fieldState.error?.message} {...field} />
                        )} />
                        <FormField control={form.control} name="category" render={({ field, fieldState }) => (
                            <LabeledSelect
                                label="Categoría Nómina"
                                disabled={frozen.has("category")}
                                value={field.value}
                                onChange={field.onChange}
                                error={fieldState.error?.message}
                                options={CATEGORY_OPTIONS}
                                placeholder="Seleccione categoría"
                            />
                        )} />
                        <FormField control={form.control} name="account" render={({ field }) => (
                            <AccountSelector label="Asignación Contable" value={field.value} onChange={field.onChange} accountType={accountTypeFor(category)} />
                        )} />
                        <FormField control={form.control} name="formula_type" render={({ field, fieldState }) => (
                            <LabeledSelect
                                label="Lógica de Cálculo"
                                value={field.value}
                                onChange={field.onChange}
                                error={fieldState.error?.message}
                                options={FORMULA_OPTIONS}
                                placeholder="Seleccione lógica"
                            />
                        )} />
                        {formulaType === "FORMULA" && (
                            <FormField control={form.control} name="formula" render={({ field, fieldState }) => (
                                <div className="bg-primary/5 p-3 rounded-md border border-dashed border-primary/20 space-y-3">
                                    <span className="flex items-center gap-2 text-4xs font-bold uppercase tracking-widest text-primary">
                                        Constructor de Fórmula
                                        <Chip size="xs">ADVANCED</Chip>
                                    </span>
                                    <LabeledInput label="Expresión" placeholder="BASE * 0.25" className="font-mono text-2xs" error={fieldState.error?.message} {...field} />
                                    <FormulaBuilder value={field.value || ""} onChange={field.onChange} />
                                </div>
                            )} />
                        )}
                        {(formulaType === "FIXED" || formulaType === "PERCENTAGE") && (
                            <FormField control={form.control} name="default_amount" render={({ field, fieldState }) => (
                                <LabeledInput
                                    label={formulaType === "PERCENTAGE" ? "Factor Porcentual (%)" : "Monto Predeterminado ($)"}
                                    type="number"
                                    step="0.0001"
                                    className="font-mono"
                                    error={fieldState.error?.message}
                                    {...field}
                                />
                            )} />
                        )}
                      </fieldset>
                    </form>
                </Form>
            </FormSplitLayout>
        </Drawer>
    )
}
