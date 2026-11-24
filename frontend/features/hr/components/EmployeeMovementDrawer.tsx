"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileText, Link2 } from "lucide-react"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { showApiError } from "@/lib/errors"
import { useEmployees } from "@/features/hr/hooks/useEmployees"
import { useEmployeeMovementMutations } from "../hooks/useEmployeeMovementMutations"
import { employeeSelectOptions } from "../employeeOptions"
import { employeeMovementFormSchema, type EmployeeMovementFormValues } from "../schemas/employeeMovement.schema"
import { LoanScheduleTable } from "./LoanScheduleTable"
import type { Employee, EmployeeMovement, LoanSchedulePreviewRow } from "@/types/hr"
import { EntitySidebar } from "@/features/comments"
import { DocumentRelationsTab, useDocumentRelations, relationsTotal } from "@/features/documents"
import { Form, FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import {
    CancelButton, Drawer, DrawerLayout, FormFooter, FormSplitLayout, LabeledInput, LabeledSelect,
    PeriodValidationDateInput, SubmitButton,
} from "@/components/shared"
import { useDrawerIdentity, usePrintableDrawer, PrintableLayout, type DrawerMode } from "@/features/_shared"
import { useServerDate } from "@/hooks/useServerDate"
import { formDrawerWidth } from "@/lib/form-widths"
import { formatCurrency } from "@/lib/money"

export interface EmployeeMovementDrawerProps {
    open: boolean
    onOpenChange: (o: boolean) => void
    movement: EmployeeMovement | null
    employees?: Employee[]
    /** En creación recibe el cuerpo para continuar con el pago; en edición no recibe nada. */
    onSaved: (payload?: Record<string, unknown>) => void
    mode?: DrawerMode
}

const KIND_OPTIONS = [
    { value: "ADVANCE", label: "Anticipo" },
    { value: "LOAN", label: "Préstamo" },
]
const PERIOD_OPTIONS = [
    { value: "MONTHLY", label: "Mensual" },
    { value: "ANNUAL", label: "Anual" },
]
const MONTH_OPTIONS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    .map((label, i) => ({ value: String(i + 1), label }))

/** La tasa se captura en porcentaje (1 = 1 %); el backend recibe el decimal. */
const percentToDecimal = (percent: string) => String(Number((parseFloat(percent) / 100).toFixed(6)))

export function EmployeeMovementDrawer({ open, onOpenChange, movement, employees: employeesProp, onSaved, mode: modeProp }: EmployeeMovementDrawerProps) {
    const { employees: fetchedEmployees } = useEmployees()
    const employees = employeesProp ?? fetchedEmployees
    const employeeOptions = employeeSelectOptions(employees, movement)
    // Misma ventana que pide la pestaña → una sola petición compartida (ADR-0155).
    const { data: relations } = useDocumentRelations("hr.employeemovement", movement?.id ?? null, { window: "recent" })
    const mode: DrawerMode = !movement ? (modeProp ?? "create")
        : movement.is_editable === false ? "view"
        : (modeProp ?? "edit")
    const isView = mode === "view"
    const { printRef, handlePrint } = usePrintableDrawer()
    const { createMovement, isSaving: saving, previewSchedule, isPreviewing } = useEmployeeMovementMutations()
    const { dateString } = useServerDate()
    const [preview, setPreview] = useState<LoanSchedulePreviewRow[]>([])
    const width = formDrawerWidth("medium", !!movement)

    const emptyValues = (): EmployeeMovementFormValues => ({
        kind: "ADVANCE", employee: "", amount: "", date: dateString, notes: "",
    })
    const form = useForm<EmployeeMovementFormValues>({
        resolver: zodResolver(employeeMovementFormSchema),
        defaultValues: emptyValues(),
    })
    const kind = form.watch("kind")
    const isLoan = kind === "LOAN"

    useInitializeDrawerForm({
        form,
        open,
        initialData: movement,
        mapData: (data): EmployeeMovementFormValues => {
            const base = { employee: String(data.employee), amount: String(data.amount), date: data.date, notes: data.notes || "" }
            if (data.kind !== "LOAN") return { ...base, kind: "ADVANCE" }
            return {
                ...base, kind: "LOAN",
                rate: String(Number(data.rate ?? 0) * 100),
                rate_period: data.rate_period ?? "MONTHLY",
                installments_count: String(data.installments_count ?? ""),
                first_installment_year: String(data.first_installment_year ?? ""),
                first_installment_month: String(data.first_installment_month ?? ""),
            }
        },
        defaultValues: emptyValues,
    })

    /** Al elegir préstamo se siembran los términos por defecto: tasa mensual y primera cuota el mes siguiente. */
    const changeKind = (next: string) => {
        form.setValue("kind", next === "LOAN" ? "LOAN" : "ADVANCE")
        if (next !== "LOAN" || form.getValues("kind") !== "LOAN") return
        const base = new Date(`${dateString}T12:00:00`)
        base.setMonth(base.getMonth() + 1)
        form.setValue("rate_period", "MONTHLY")
        form.setValue("rate", "")
        form.setValue("installments_count", "")
        form.setValue("first_installment_year", String(base.getFullYear()))
        form.setValue("first_installment_month", String(base.getMonth() + 1))
        setPreview([])
    }

    const calculate = async () => {
        const v = form.getValues()
        if (v.kind !== "LOAN") return
        try {
            setPreview(await previewSchedule({
                amount: Number(v.amount), rate: percentToDecimal(v.rate || "0"), rate_period: v.rate_period,
                installments: Number(v.installments_count), first_year: Number(v.first_installment_year), first_month: Number(v.first_installment_month),
            }))
        } catch (e: unknown) {
            showApiError(e, "No se pudo calcular el plan de cuotas")
        }
    }

    const onSubmit = async (data: EmployeeMovementFormValues) => {
        const payload: Record<string, unknown> = {
            kind: data.kind, employee: parseInt(data.employee), amount: data.amount, date: data.date, notes: data.notes || "",
        }
        if (data.kind === "LOAN") {
            Object.assign(payload, {
                rate: percentToDecimal(data.rate), rate_period: data.rate_period,
                installments_count: Number(data.installments_count),
                first_installment_year: Number(data.first_installment_year),
                first_installment_month: Number(data.first_installment_month),
            })
        }
        try {
            if (movement) {
                await createMovement({ id: movement.id, payload })
                onOpenChange(false)
                onSaved()
            } else {
                form.reset()
                setPreview([])
                onOpenChange(false)
                onSaved(payload)
            }
        } catch (e: unknown) {
            showApiError(e, "Error al guardar el movimiento")
        }
    }

    const identity = useDrawerIdentity("hr.employeemovement", mode, movement, {
        overrideSubtitle: movement ? "Revise los datos del movimiento con el empleado." : "Registre un anticipo o un préstamo para descontar en la liquidación.",
        printable: (mode === "view" || mode === "edit") && !!movement?.id,
        onPrint: handlePrint,
    })

    const scheduleRows = movement?.installments?.length ? movement.installments : preview

    const fields = (
        <Form {...form}>
            <form id="employee-movement-form" onSubmit={form.handleSubmit(onSubmit)}>
                <fieldset disabled={isView} className="contents">
                    <div className="space-y-6">
                        <FormField control={form.control} name="kind" render={({ field }) => (
                            <LabeledSelect label="Tipo" required value={field.value} onChange={changeKind} options={KIND_OPTIONS} disabled={!!movement} />
                        )} />
                        <FormField control={form.control} name="employee" render={({ field, fieldState }) => (
                            <LabeledSelect label="Empleado" required value={field.value} onChange={field.onChange} error={fieldState.error?.message} options={employeeOptions} />
                        )} />
                        <FormField control={form.control} name="amount" render={({ field, fieldState }) => (
                            <LabeledInput label="Monto ($)" required type="number" placeholder="0" error={fieldState.error?.message} {...field} />
                        )} />
                        <FormField control={form.control} name="date" render={({ field }) => (
                            <PeriodValidationDateInput
                                label="Fecha"
                                required
                                date={field.value ? new Date(field.value + "T12:00:00") : undefined}
                                onDateChange={(d) => field.onChange(d ? d.toISOString().split("T")[0] : "")}
                                validationType="accounting"
                            />
                        )} />

                        {isLoan && (
                            <div className="space-y-4 rounded-md border border-border p-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="rate" render={({ field, fieldState }) => (
                                        <LabeledInput label="Tasa de interés (%)" required type="number" step="0.01" error={fieldState.error?.message} {...field} />
                                    )} />
                                    <FormField control={form.control} name="rate_period" render={({ field }) => (
                                        <LabeledSelect label="Periodicidad de la tasa" required value={field.value} onChange={field.onChange} options={PERIOD_OPTIONS} />
                                    )} />
                                    <FormField control={form.control} name="installments_count" render={({ field, fieldState }) => (
                                        <LabeledInput label="N° de cuotas" required type="number" error={fieldState.error?.message} {...field} />
                                    )} />
                                    <FormField control={form.control} name="first_installment_year" render={({ field, fieldState }) => (
                                        <LabeledInput label="Año primera cuota" required type="number" error={fieldState.error?.message} {...field} />
                                    )} />
                                    <FormField control={form.control} name="first_installment_month" render={({ field }) => (
                                        <LabeledSelect label="Mes primera cuota" required value={field.value} onChange={field.onChange} options={MONTH_OPTIONS} />
                                    )} />
                                </div>
                                {!movement && (
                                    <Button type="button" variant="outline" size="sm" onClick={calculate} disabled={isPreviewing}>
                                        Calcular cuotas
                                    </Button>
                                )}
                                <LoanScheduleTable rows={scheduleRows} />
                            </div>
                        )}

                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <LabeledInput as="textarea" label="Notas" rows={2} {...field} />
                        )} />

                        {movement && movement.allocations.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Descontado en liquidaciones</p>
                                <ul className="space-y-1 text-sm">
                                    {movement.allocations.map((a) => (
                                        <li key={a.id} className="flex justify-between">
                                            <span>{a.payroll_display_id ?? `#${a.payroll}`}</span>
                                            <span className="tabular-nums">{formatCurrency(a.amount)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </fieldset>
            </form>
        </Form>
    )

    return (
        <>
            {(mode === "view" || mode === "edit") && movement?.id && (
                <PrintableLayout ref={printRef} title="Movimiento con empleado" displayId={movement.display_id}>
                    <div className="text-4xs space-y-1 mb-2">
                        <div className="flex justify-between">
                            <span>Empleado:</span>
                            <span>{movement.employee_name ?? "-"}</span>
                        </div>
                    </div>
                </PrintableLayout>
            )}
            <Drawer
                fillContent
                contentClassName="p-0"
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={width}
                icon={identity.icon}
                title={identity.title}
                headerActions={identity.headerActions}
                subtitle={identity.subtitle}
                mode={mode}
                footer={isView ? undefined : (
                    <FormFooter
                        actions={
                            <>
                                <CancelButton onClick={() => onOpenChange(false)} />
                                <SubmitButton type="submit" onClick={form.handleSubmit(onSubmit)} loading={saving}>
                                    {mode === "create" ? "Registrar" : "Actualizar"}
                                </SubmitButton>
                            </>
                        }
                    />
                )}
            >
                {movement ? (
                    <DrawerLayout
                        rightRail={<EntitySidebar entityId={movement.id} entityType="employeemovement" title="Historial" />}
                        rightRailCollapsible
                        rightRailStorageKey="erpgrafico.drawer.sidebar.employeemovement"
                        noPadding
                        tabs={[
                            { value: "details", label: "Datos", icon: FileText, className: "space-y-6 p-6", content: fields },
                            {
                                value: "relations",
                                label: "Relaciones",
                                icon: Link2,
                                badge: relationsTotal(relations),
                                className: "p-6",
                                content: <DocumentRelationsTab label="hr.employeemovement" id={movement.id} sectionActions={{}} rowActions={() => []} />,
                            },
                        ]}
                    />
                ) : (
                    <FormSplitLayout className="space-y-6 p-6">{fields}</FormSplitLayout>
                )}
            </Drawer>
        </>
    )
}
