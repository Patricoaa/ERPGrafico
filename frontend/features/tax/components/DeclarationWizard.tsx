"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"

import {
    Drawer,
    FormSection,
    GenericWizard,
    LabeledInput,
    MoneyDisplay,
    SubmitButton,
    type WizardRenderContext,
    type WizardStep,
} from '@/components/shared'
import {
    Calculator,
    CheckCircle2,
    ArrowUpRight,
    ArrowDownLeft,
    ChevronLeft,
    ChevronRight,
    HandCoins,
    History,
    Lock,
} from "lucide-react"
import { showApiError } from "@/lib/errors"
import { formDrawerWidth } from "@/lib/form-widths"
import { toast } from "sonner"
import { useTaxCalculation, useCreateDeclaration, useRegisterDeclaration } from "../hooks/useTaxMutations"
import { useTaxPeriod, useTaxDeclarations } from "../hooks/useTaxQueries"
import { useVatRate } from '@/hooks/useVatRate'
import { useServerDate } from "@/hooks/useServerDate"

import { type TaxPeriod, type TaxPeriodDetail, type TaxDeclaration, type TaxCalculationData } from "../types"
import { deriveF29Phase, type F29Phase } from "../utils/f29Phase"
import { F29PaymentStep } from "./wizard/F29PaymentStep"
import { F29CloseStep } from "./wizard/F29CloseStep"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { generateUuidV4 } from "@/lib/uuid"

interface DeclarationWizardProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    periodId?: number
    year?: number
    month?: number
    onSuccess: () => void
    existingPeriods?: TaxPeriod[]
}

/** Declaration row from `GET /tax/declarations/` (F29DeclarationSerializer). */
type DeclarationRecord = TaxDeclaration & { is_registered?: boolean }

const SUMMARY_STEP_ID = "summary"
/** Auditoría, Cargos manuales, Resumen. */
const PRIOR_STEP_COUNT = 3

function isAlreadyRegisteredError(error: unknown): boolean {
    const message = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error
    return typeof message === "string" && (message.includes("ya fue registrada") || message.includes("ya ha sido registrada"))
}

/** Declaración del período para los pasos Pago y Cierre (saldo según `declaration_summary`). */
function toTaxDeclaration(period: TaxPeriodDetail, record: DeclarationRecord | null): TaxDeclaration | null {
    const summary = period.declaration_summary
    if (!summary) return null
    return {
        ppm_amount: 0,
        withholding_tax: 0,
        vat_credit_carryforward: 0,
        vat_correction_amount: 0,
        second_category_tax: 0,
        loan_retention: 0,
        ila_tax: 0,
        vat_withholding: 0,
        tax_rate: 0,
        ...record,
        id: summary.id,
        vat_to_pay: summary.vat_to_pay,
        total_paid: summary.total_paid,
        is_fully_paid: summary.is_fully_paid,
        payments: summary.payments ?? [],
        folio_number: summary.folio_number,
        document: summary.document ?? null,
        tax_period: period.id,
        tax_period_year: period.year,
        tax_period_month: period.month,
        tax_period_display: period.tax_period_display ?? `${period.month_display ?? period.month} ${period.year}`,
    }
}

export function DeclarationWizard({ isOpen, onOpenChange, periodId, year: propYear, month: propMonth, onSuccess, existingPeriods: existingPeriodsProp }: DeclarationWizardProps) {
    const { year: currentYear, month: currentMonth, dateString } = useServerDate()
    const { openEntity } = useGlobalModals()
    const { rate } = useVatRate()
    const [isCalculating, setIsCalculating] = useState(false)
    const [calcFailed, setCalcFailed] = useState(false)
    const [calcData, setCalcData] = useState<TaxCalculationData | null>(null)
    const [calcPeriodId, setCalcPeriodId] = useState<number | null>(null)
    const [closedNow, setClosedNow] = useState(false)
    const [isAdvancing, setIsAdvancing] = useState(false)
    // One idempotency key per register operation; dropped after any outcome (ADR idempotency).
    const registerKeyRef = useRef<string | null>(null)
    const calcKeyRef = useRef<string | null>(null)
    const [period, setPeriod] = useState({
        year: currentYear || new Date().getFullYear(),
        month: currentMonth || new Date().getMonth() + 1
    })
    const existingPeriods = useMemo(() => existingPeriodsProp ?? [], [existingPeriodsProp]);
    // Editable draft; once a declaration is registered the declared values are shown instead.
    const [draftFields, setManualFields] = useState({
        ppm_amount: 0,
        withholding_tax: 0,
        vat_credit_carryforward: 0,
        vat_correction_amount: 0,
        second_category_tax: 0,
        loan_retention: 0,
        ila_tax: 0,
        vat_withholding: 0,
        tax_rate: rate,
        notes: ""
    })
    const { calculateTax } = useTaxCalculation()
    const { createDeclaration } = useCreateDeclaration()
    const { registerDeclaration } = useRegisterDeclaration()

    // Persisted state of the period drives the phase (no wizard step is persisted).
    const resolvedPeriodId = periodId ?? calcPeriodId ?? undefined
    const { taxPeriod, isLoading: isPeriodLoading, refetch: refetchPeriod } = useTaxPeriod(isOpen ? resolvedPeriodId : undefined)
    const summary = taxPeriod?.declaration_summary
    const declarationParams = useMemo<Record<string, unknown>>(
        () => (taxPeriod && summary ? { tax_period__year: taxPeriod.year, tax_period__month: taxPeriod.month } : {}),
        [taxPeriod, summary],
    )
    const { taxDeclarations } = useTaxDeclarations(declarationParams)
    const declarationRecord = ((taxDeclarations?.results ?? []) as DeclarationRecord[])[0] ?? null

    const basePhase = deriveF29Phase(taxPeriod)
    // A created-but-unregistered declaration (register failed earlier) still belongs to the prior steps.
    const phase: F29Phase = (basePhase === "payment" || basePhase === "close") && declarationRecord?.is_registered === false
        ? "prior"
        : basePhase
    const isDeclared = phase !== "prior"
    const declaration = taxPeriod && isDeclared ? toTaxDeclaration(taxPeriod, declarationRecord) : null

    const sourcePeriod = taxPeriod ?? existingPeriods.find(p => p.id === periodId) ?? null
    const targetYear = periodId ? sourcePeriod?.year : (propYear ?? currentYear)
    const targetMonth = periodId ? sourcePeriod?.month : (propMonth ?? currentMonth)

    // Calculate once per open and target period.
    useEffect(() => {
        if (!isOpen) {
            calcKeyRef.current = null
            return
        }
        if (!targetYear || !targetMonth) return
        const key = `${targetYear}-${targetMonth}`
        if (calcKeyRef.current === key) return
        calcKeyRef.current = key
        registerKeyRef.current = null

        const run = async () => {
            setPeriod({ year: targetYear, month: targetMonth })
            setCalcData(null)
            setCalcFailed(false)
            setClosedNow(false)
            setIsCalculating(true)
            try {
                const data = await calculateTax({ year: targetYear, month: targetMonth })
                setCalcData(data)
                if (data.tax_period_id) setCalcPeriodId(data.tax_period_id)
                if (data.tax_rate) {
                    setManualFields(prev => ({
                        ...prev,
                        tax_rate: data.tax_rate,
                        vat_credit_carryforward: data.vat_credit_carryforward || 0
                    }))
                }
            } catch {
                setCalcFailed(true)
            } finally {
                setIsCalculating(false)
            }
        }
        void run()
    }, [isOpen, targetYear, targetMonth, calculateTax])

    // Once registered, the prior steps show the declared values (read-only).
    const manualFields = isDeclared && declarationRecord
        ? {
            ppm_amount: Number(declarationRecord.ppm_amount) || 0,
            withholding_tax: Number(declarationRecord.withholding_tax) || 0,
            vat_credit_carryforward: Number(declarationRecord.vat_credit_carryforward) || 0,
            vat_correction_amount: Number(declarationRecord.vat_correction_amount) || 0,
            second_category_tax: Number(declarationRecord.second_category_tax) || 0,
            loan_retention: Number(declarationRecord.loan_retention) || 0,
            ila_tax: Number(declarationRecord.ila_tax) || 0,
            vat_withholding: Number(declarationRecord.vat_withholding) || 0,
            tax_rate: Number(declarationRecord.tax_rate) || draftFields.tax_rate,
            notes: declarationRecord.notes ?? "",
        }
        : draftFields

    /** Last prior step: create + register the declaration. Never closes the period. */
    const handleRegister = async (): Promise<boolean> => {
        if (isDeclared) return true
        if (!registerKeyRef.current) registerKeyRef.current = generateUuidV4()
        try {
            const created = await createDeclaration({
                tax_period_year: period.year,
                tax_period_month: period.month,
                ...manualFields
            })
            try {
                await registerDeclaration({
                    id: created.id,
                    data: { declaration_date: dateString || "" },
                    idempotencyKey: registerKeyRef.current
                })
            } catch (regError: unknown) {
                if (!isAlreadyRegisteredError(regError)) throw regError
            }
            registerKeyRef.current = null
            if (created.tax_period) setCalcPeriodId(created.tax_period)
            toast.success("Declaración F29 registrada correctamente")
            return true
        } catch (error: unknown) {
            registerKeyRef.current = null
            showApiError(error, "Error al registrar la declaración F29")
            return false
        }
    }

    const handleChanged = () => { void refetchPeriod() }
    const handleClosed = () => {
        setClosedNow(true)
        void refetchPeriod()
    }

    // Calculations
    const vatDebit = calcData?.vat_debit || 0
    const vatCredit = calcData?.vat_credit || 0
    const totalVATCredits = vatCredit + (manualFields.vat_credit_carryforward || 0) + (manualFields.vat_correction_amount || 0)
    const vatToPay = Math.max(0, vatDebit - totalVATCredits)
    const vatRemanent = Math.max(0, totalVATCredits - vatDebit)
    const otherTaxes = (manualFields.withholding_tax || 0) + (manualFields.second_category_tax || 0) + (manualFields.ppm_amount || 0)
    const declaredDue = Number(summary?.vat_to_pay)
    const finalToPay = isDeclared && Number.isFinite(declaredDue) ? declaredDue : vatToPay + otherTaxes
    const includePayment = isDeclared ? (!Number.isFinite(declaredDue) || declaredDue > 0) : finalToPay > 0
    const isPaid = declaration ? declaration.is_fully_paid || Number(declaration.vat_to_pay) - Number(declaration.total_paid) <= 0 : false

    const pendingDeclaration = (
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando la declaración registrada...</div>
    )

    const priorSteps: WizardStep[] = [
        {
            id: "audit",
            title: "Auditoría de Documentos (IVA)",
            isValid: true,
            component: (
                <div className="space-y-10 max-w-4xl mx-auto pb-6">
                    <div className="flex flex-col gap-12">
                        <section className="space-y-8">
                            <FormSection title="Débito Fiscal" icon={ArrowUpRight} />
                            <div className="space-y-4 bg-muted/5 p-6 rounded-md border border-border/50">
                                <div>
                                    <div className="flex justify-between items-center text-xs uppercase font-bold text-muted-foreground/70">
                                        <span>Ventas Afectas</span>
                                        <MoneyDisplay amount={calcData?.sales_taxed} showColor={false} className="font-bold" />
                                    </div>
                                    {calcData?.sales_taxed_by_dte?.map(item => (
                                        <div key={item.dte_type} className="flex justify-between items-center text-2xs text-muted-foreground/50 pl-4 mt-0.5">
                                            <span>{item.dte_type_display} ({item.count})</span>
                                            <MoneyDisplay amount={item.total} showColor={false} className="font-bold" />
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div className="flex justify-between items-center text-xs uppercase font-bold text-muted-foreground/70">
                                        <span>Ventas Exentas</span>
                                        <MoneyDisplay amount={calcData?.sales_exempt} showColor={false} className="font-bold" />
                                    </div>
                                    {calcData?.sales_exempt_by_dte?.map(item => (
                                        <div key={item.dte_type} className="flex justify-between items-center text-2xs text-muted-foreground/50 pl-4 mt-0.5">
                                            <span>{item.dte_type_display} ({item.count})</span>
                                            <MoneyDisplay amount={item.total} showColor={false} className="font-bold" />
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-4 space-y-2 border-t border-border/30">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-black uppercase text-foreground">IVA Débito ({manualFields.tax_rate}%)</span>
                                        <MoneyDisplay amount={calcData?.vat_debit} className="text-2xl font-black text-expense" />
                                    </div>
                                </div>
                            </div>
                        </section>
                        <section className="space-y-8">
                            <FormSection title="Crédito Fiscal" icon={ArrowDownLeft} />
                            <div className="space-y-4 bg-transparent p-6 rounded-md border border-border/50">
                                <div>
                                    <div className="flex justify-between items-center text-xs uppercase font-bold text-muted-foreground/70">
                                        <span>Compras Afectas</span>
                                        <MoneyDisplay amount={calcData?.purchases_taxed} showColor={false} className="font-bold" />
                                    </div>
                                    {calcData?.purchases_taxed_by_dte?.map(item => (
                                        <div key={item.dte_type} className="flex justify-between items-center text-2xs text-muted-foreground/50 pl-4 mt-0.5">
                                            <span>{item.dte_type_display} ({item.count})</span>
                                            <MoneyDisplay amount={item.total} showColor={false} className="font-bold" />
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <div className="flex justify-between items-center text-xs uppercase font-bold text-muted-foreground/70">
                                        <span>Compras Exentas</span>
                                        <MoneyDisplay amount={calcData?.purchases_exempt} showColor={false} className="font-bold" />
                                    </div>
                                    {calcData?.purchases_exempt_by_dte?.map(item => (
                                        <div key={item.dte_type} className="flex justify-between items-center text-2xs text-muted-foreground/50 pl-4 mt-0.5">
                                            <span>{item.dte_type_display} ({item.count})</span>
                                            <MoneyDisplay amount={item.total} showColor={false} className="font-bold" />
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-4 space-y-2 border-t border-border/30">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-black uppercase text-foreground">IVA Crédito ({manualFields.tax_rate}%)</span>
                                        <MoneyDisplay amount={calcData?.vat_credit} className="text-2xl font-black text-income" />
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                    {calcData?.drafts_summary && (calcData.drafts_summary.invoices.length > 0 || calcData.drafts_summary.entries.length > 0) && (
                        <Alert variant="warning">
                            <div className="space-y-4 w-full">
                                <AlertTitle className="text-sm font-black uppercase tracking-widest text-warning/90">Documentos en Borrador</AlertTitle>
                                <AlertDescription className="text-xs text-warning/70 font-medium">Hay pendientes que no se incluyeron. Se recomienda procesarlos.</AlertDescription>
                                <div className="grid grid-cols-2 gap-4">
                                    {calcData.drafts_summary.invoices.slice(0, 2).map(inv => (
                                        <div key={inv.id} className="flex items-center justify-between bg-muted/50 p-3 rounded-md border border-warning/10">
                                            <span className="text-2xs font-bold">{inv.display_id}</span>
                                            <Button variant="ghost" size="sm" className="h-7 text-4xs font-medium" onClick={() => openEntity('billing.invoice', inv.id)}>Ver documento</Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Alert>
                    )}
                </div>
            )
        },
        {
            id: "manual",
            title: "Cargos Manuales del Período",
            isValid: true,
            component: (
                <fieldset disabled={isDeclared} className="space-y-6 max-w-4xl mx-auto pb-6 min-w-0 border-0 p-0 m-0">
                    {isDeclared && (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Lock className="h-3.5 w-3.5" />
                            Declaración registrada: los cargos se muestran en modo lectura.
                        </p>
                    )}
                    <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                        <div className="col-span-full">
                            <FormSection title="Retenciones" icon={HandCoins} />
                        </div>
                        <div className="space-y-2">
                            <LabeledInput
                                label="PPM (Pagos Provisionales)"
                                type="number"
                                value={manualFields.ppm_amount}
                                onChange={e => setManualFields({ ...manualFields, ppm_amount: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <LabeledInput
                                label="Retención Honorarios (13.75%)"
                                type="number"
                                value={manualFields.withholding_tax}
                                onChange={e => setManualFields({ ...manualFields, withholding_tax: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <LabeledInput
                                label="Impuesto Único 2da Cat."
                                type="number"
                                value={manualFields.second_category_tax}
                                onChange={e => setManualFields({ ...manualFields, second_category_tax: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <LabeledInput
                                label="Préstamo Solidario (3%)"
                                type="number"
                                value={manualFields.loan_retention}
                                onChange={e => setManualFields({ ...manualFields, loan_retention: Number(e.target.value) })}
                            />
                        </div>
                        <div className="col-span-full">
                            <FormSection title="Ajustes de IVA" icon={History} />
                        </div>
                        <div className="space-y-2">
                            <LabeledInput
                                label="Remanente Mes Anterior"
                                type="number"
                                readOnly
                                value={manualFields.vat_credit_carryforward}
                                containerClassName="opacity-60"
                            />
                        </div>
                        <div className="space-y-2">
                            <LabeledInput
                                label="Reajuste Art. 31"
                                type="number"
                                value={manualFields.vat_correction_amount}
                                onChange={e => setManualFields({ ...manualFields, vat_correction_amount: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                </fieldset>
            )
        },
        {
            id: SUMMARY_STEP_ID,
            title: "Resumen y Declaración",
            isValid: true,
            onNext: handleRegister,
            component: (
                <div className="max-w-4xl mx-auto pb-6 space-y-8">
                    <FormSection title="Resumen de Impuestos" icon={Calculator} />
                    <div className="space-y-4 bg-muted/5 p-6 rounded-md border border-border/50">
                        <div className="flex justify-between items-center">
                            <span className="text-xs uppercase font-bold text-muted-foreground/70">IVA Determinado</span>
                            <MoneyDisplay amount={vatToPay} showColor={false} className="font-bold" />
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs uppercase font-bold text-muted-foreground/70">PPM + Retenciones</span>
                            <MoneyDisplay amount={otherTaxes} showColor={false} className="font-bold" />
                        </div>
                        {vatRemanent > 0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black uppercase text-success">Nuevo Remanente a Favor</span>
                                <MoneyDisplay amount={vatRemanent} className="font-black text-success" />
                            </div>
                        )}
                        <div className="pt-4 space-y-2 border-t border-border/30">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-black uppercase text-foreground">Total a Pagar SII</span>
                                <MoneyDisplay amount={finalToPay} className="text-2xl font-black text-primary" />
                            </div>
                        </div>
                    </div>
                    {isDeclared && (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            Declaración registrada{summary?.folio_number ? ` (folio ${summary.folio_number})` : ""}.
                        </p>
                    )}
                </div>
            )
        },
    ]

    const steps: WizardStep[] = [
        ...priorSteps,
        ...(includePayment ? [{
            id: "payment",
            title: "Pago",
            isValid: isPaid,
            component: declaration ? <F29PaymentStep declaration={declaration} onChanged={handleChanged} /> : pendingDeclaration,
        }] : []),
        {
            id: "close",
            title: "Cierre del Período",
            isValid: true,
            component: declaration ? <F29CloseStep declaration={declaration} onChanged={handleClosed} /> : pendingDeclaration,
        },
    ]

    const paymentIndex = PRIOR_STEP_COUNT
    const closeIndex = PRIOR_STEP_COUNT + (includePayment ? 1 : 0)
    const initialStep = phase === "payment" ? paymentIndex : phase === "close" ? closeIndex : 0
    const isPreLoading = isOpen && ((calcData === null && !calcFailed) || isPeriodLoading)

    const renderFooter = ({ step, isFirstStep, isLastStep, goBack, goNext }: WizardRenderContext) => {
        const current = steps[step]
        const isRegisterStep = current?.id === SUMMARY_STEP_ID && !isDeclared
        return (
            <div className="flex items-center justify-between w-full">
                <Button variant="ghost" onClick={goBack} disabled={isFirstStep || isAdvancing} className="gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                </Button>
                {!isLastStep && (
                    <SubmitButton
                        type="button"
                        onClick={async () => {
                            setIsAdvancing(true)
                            try { await goNext() } finally { setIsAdvancing(false) }
                        }}
                        disabled={current?.isValid === false || isPreLoading}
                        loading={isAdvancing}
                        icon={isRegisterStep ? CheckCircle2 : ChevronRight}
                    >
                        {isRegisterStep ? "Registrar Declaración" : "Siguiente"}
                    </SubmitButton>
                )}
            </div>
        )
    }

    if (phase === "done" && taxPeriod) {
        const display = taxPeriod.tax_period_display ?? `${taxPeriod.month_display ?? taxPeriod.month} ${taxPeriod.year}`
        return (
            <Drawer
                open={isOpen}
                onOpenChange={onOpenChange}
                defaultSize={formDrawerWidth("complex", false)}
                side="left"
                boundary="embedded"
                title={closedNow ? "Ciclo Finalizado" : "Período Cerrado"}
                contentClassName="p-6"
            >
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-8 animate-in zoom-in-95 duration-500">
                    <CheckCircle2 className="h-12 w-12 text-success" />
                    <div className="space-y-3">
                        <h3 className="text-3xl font-black uppercase tracking-tight">
                            {closedNow ? "Ciclo Finalizado" : "Período Cerrado"}
                        </h3>
                        <p className="text-muted-foreground text-sm max-w-md px-10">
                            El período {display} quedó cerrado y bloqueado para futuros cambios.
                        </p>
                    </div>
                    {summary && (
                        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-left">
                            {summary.folio_number && (<><dt className="text-muted-foreground">Folio</dt><dd className="font-mono">{summary.folio_number}</dd></>)}
                            <dt className="text-muted-foreground">Total declarado</dt>
                            <dd><MoneyDisplay amount={summary.vat_to_pay} showColor={false} className="font-bold" /></dd>
                            <dt className="text-muted-foreground">Total pagado</dt>
                            <dd><MoneyDisplay amount={summary.total_paid} showColor={false} className="font-bold" /></dd>
                            {taxPeriod.closed_by_name && (<><dt className="text-muted-foreground">Cerrado por</dt><dd>{taxPeriod.closed_by_name}</dd></>)}
                        </dl>
                    )}
                    <Button
                        onClick={() => (closedNow ? onSuccess() : onOpenChange(false))}
                        className="px-10 h-11 font-medium uppercase tracking-widest text-2xs"
                    >
                        Finalizar
                    </Button>
                </div>
            </Drawer>
        )
    }

    return (
        <GenericWizard
            key={`wizard-${isOpen}-${periodId}`}
            open={isOpen}
            onOpenChange={onOpenChange}
            onClose={() => onOpenChange(false)}
            initialStep={initialStep}
            isLoading={isCalculating || isPreLoading}
            title={
                <div className="flex items-center gap-3">
                    <Calculator className="h-5 w-5 text-primary" />
                    <span>Asistente para Declaración Mensual F29</span>
                </div>
            }
            steps={steps}
            onComplete={async () => {}}
            footer={renderFooter}
            size="md"
            surface="drawer"
            drawerSide="left"
            drawerBoundary="embedded"
        />
    )
}
