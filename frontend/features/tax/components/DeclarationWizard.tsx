"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"

import { BaseModal, FormSection, GenericWizard, LabeledInput, MoneyDisplay, type WizardStep } from '@/components/shared'
import {
    Calculator,
    CheckCircle2,
    ArrowUpRight,
    ArrowDownLeft,
    HandCoins,
    History,
} from "lucide-react"
import { showApiError } from "@/lib/errors"
import { toast } from "sonner"
import { useTaxCalculation, useCreateDeclaration, useRegisterDeclaration, useClosePeriod } from "../hooks/useTaxMutations"
import { useVatRate } from '@/hooks/useVatRate'
import { useServerDate } from "@/hooks/useServerDate"

import { type TaxPeriod, type TaxCalculationData } from "../types"
import { taxApi } from "../api/taxApi"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface DeclarationWizardProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    periodId?: number
    onSuccess: () => void
    existingPeriods?: TaxPeriod[]
}

export function DeclarationWizard({ isOpen, onOpenChange, periodId, onSuccess, existingPeriods: existingPeriodsProp }: DeclarationWizardProps) {
    const { year: currentYear, month: currentMonth, dateString, serverDate } = useServerDate()
    const { openHub } = useHubPanel()
    const { rate } = useVatRate()
    const [isLoading, setIsLoading] = useState(false)
    const [calcData, setCalcData] = useState<TaxCalculationData | null>(null)
    const [taxPeriodId, setTaxPeriodId] = useState<number | null>(periodId || null)
    const [isClosed, setIsClosed] = useState(false)
    const idempotencyKeyRef = useRef<string | null>(null)
    const [period, setPeriod] = useState({
        year: currentYear || new Date().getFullYear(),
        month: currentMonth || new Date().getMonth() + 1
    })
    const [wizardInitialStep, setWizardInitialStep] = useState(0)
    const existingPeriods = useMemo(() => existingPeriodsProp ?? [], [existingPeriodsProp]);
    const isPreLoading = periodId != null && isOpen && calcData === null
    const [manualFields, setManualFields] = useState({
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
    const calcMutation = useTaxCalculation()
    const createDeclarationMutation = useCreateDeclaration()
    const registerDeclarationMutation = useRegisterDeclaration()
    const closePeriodMutation = useClosePeriod()

    // Helper for direct calculation that uses params instead of state (since state might not have updated yet)
    const calculateDataForPeriod = async (y: number, m: number) => {
        setIsLoading(true)
        try {
            const data = await calcMutation.mutateAsync({ year: y, month: m })
            setCalcData(data)
            if (data.tax_period_id) setTaxPeriodId(data.tax_period_id)
            if (data.tax_rate) {
                setManualFields(prev => ({
                    ...prev,
                    tax_rate: data.tax_rate,
                    vat_credit_carryforward: data.vat_credit_carryforward || 0
                }))
            }
            return true
        } catch {
            return false
        } finally {
            setIsLoading(false)
        }
    }

    // Reset and initialize state when modal opens
    useEffect(() => {
        const initializeWizard = async () => {
            if (isOpen) {
                setIsClosed(false)
                let targetPeriod: TaxPeriod | undefined
                let year: number | undefined
                let month: number | undefined

                // If we have a periodId, resolve period and skip step 1
                if (periodId) {
                    // Try existingPeriods first (fast path), otherwise fetch from API
                    targetPeriod = existingPeriods.find(p => p.id === periodId)
                    if (!targetPeriod) {
                        try {
                            targetPeriod = await taxApi.getPeriod(periodId)
                        } catch {
                            // fall through to default below
                        }
                    }
                    if (targetPeriod) {
                        year = targetPeriod.year
                        month = targetPeriod.month
                    }
                }

                if (year && month) {
                    setPeriod({ year, month })
                    setCalcData(null)
                    await calculateDataForPeriod(year, month)
                    setWizardInitialStep(0)
                }
            }
        }

        initializeWizard()
    }, [isOpen, periodId, existingPeriods, serverDate, currentYear, currentMonth])

    const handleSaveAndClose = async () => {
        setIsLoading(true)
        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                    const r = (Math.random() * 16) | 0
                    const v = c === 'x' ? r : (r & 0x3) | 0x8
                    return v.toString(16)
                })
        }
        try {
            const declarationData = await createDeclarationMutation.mutateAsync({
                tax_period_year: period.year,
                tax_period_month: period.month,
                ...manualFields
            })
            const declarationId = declarationData.id
            const currentTaxPeriodId = declarationData.tax_period || taxPeriodId
            try {
                await registerDeclarationMutation.mutateAsync({
                    id: declarationId,
                    data: { declaration_date: dateString || "" },
                    idempotencyKey: idempotencyKeyRef.current
                })
            } catch (regError: unknown) {
                const isAlreadyRegistered =
                    (regError as { response?: { data?: { error?: string } } })?.response?.data?.error?.includes("ya fue registrada") ||
                    (regError as { response?: { data?: { error?: string } } })?.response?.data?.error?.includes("ya ha sido registrada")
                if (!isAlreadyRegistered) throw regError
            }
            if (currentTaxPeriodId) await closePeriodMutation.mutateAsync(currentTaxPeriodId)
            toast.success("Ciclo tributario finalizado exitosamente")
            setIsClosed(true)
            onSuccess();
            return true
        } catch (error: unknown) {
            showApiError(error, "Error al finalizar el ciclo tributario")
            return false
        } finally {
            setIsLoading(false)
        }
    }

    // Calculations
    const vatDebit = calcData?.vat_debit || 0
    const vatCredit = calcData?.vat_credit || 0
    const totalVATCredits = vatCredit + (manualFields.vat_credit_carryforward || 0) + (manualFields.vat_correction_amount || 0)
    const vatToPay = Math.max(0, vatDebit - totalVATCredits)
    const vatRemanent = Math.max(0, totalVATCredits - vatDebit)
    const otherTaxes = (manualFields.withholding_tax || 0) + (manualFields.second_category_tax || 0) + (manualFields.ppm_amount || 0)
    const finalToPay = vatToPay + otherTaxes

    const steps: WizardStep[] = useMemo(() => [
        {
            id: 2,
            title: "Auditoría de Documentos (IVA)",
            isValid: true,
            component: (
                <div className="space-y-10 max-w-4xl mx-auto pb-6">
                    <div className="grid grid-cols-2 gap-12">
                        <section className="space-y-8">
                            <FormSection title="Débito Fiscal" icon={ArrowUpRight} />
                            <div className="space-y-4 bg-muted/5 p-6 rounded-md border border-border/50">
                                <div>
                                    <div className="flex justify-between items-center text-xs uppercase font-bold text-muted-foreground/70">
                                        <span>Ventas Afectas</span>
                                        <MoneyDisplay amount={calcData?.sales_taxed} showColor={false} className="font-bold" />
                                    </div>
                                    {calcData?.sales_taxed_by_dte?.map(item => (
                                        <div key={item.dte_type} className="flex justify-between items-center text-[11px] text-muted-foreground/50 pl-4 mt-0.5">
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
                                        <div key={item.dte_type} className="flex justify-between items-center text-[11px] text-muted-foreground/50 pl-4 mt-0.5">
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
                                        <div key={item.dte_type} className="flex justify-between items-center text-[11px] text-muted-foreground/50 pl-4 mt-0.5">
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
                                        <div key={item.dte_type} className="flex justify-between items-center text-[11px] text-muted-foreground/50 pl-4 mt-0.5">
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
                                            <span className="text-[11px] font-bold">{inv.display_id}</span>
                                            <Button variant="ghost" size="sm" className="h-7 text-[9px] font-black" onClick={() => openHub({ type: inv.type, invoiceId: inv.id })}>Abrir Hub</Button>
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
            id: 3,
            title: "Cargos Manuales del Período",
            isValid: true,
            component: (
                <div className="space-y-10 max-w-4xl mx-auto pb-6">
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
                </div>
            )
        },
        {
            id: 4,
            title: "Resumen y Declaración",
            isValid: true,
            component: (
                <div className="max-w-4xl mx-auto pb-6 space-y-0">
                    <div className="flex justify-between items-center py-5 border-b border-border/30">
                        <span className="text-sm text-muted-foreground">IVA Determinado</span>
                        <MoneyDisplay amount={vatToPay} showColor={false} className="text-lg font-bold" />
                    </div>
                    <div className="flex justify-between items-center py-5 border-b border-border/30">
                        <span className="text-sm text-muted-foreground">PPM + Retenciones</span>
                        <MoneyDisplay amount={otherTaxes} showColor={false} className="text-lg font-bold" />
                    </div>
                    {vatRemanent > 0 && (
                        <div className="flex justify-between items-center py-5 border-b border-border/30">
                            <span className="text-xs font-black uppercase text-success">Nuevo Remanente a Favor</span>
                            <MoneyDisplay amount={vatRemanent} className="font-black text-success" />
                        </div>
                    )}
                    <div className="flex flex-col items-center justify-center py-10">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 mb-3">Total a Pagar SII</span>
                        <MoneyDisplay amount={finalToPay} className="text-5xl font-black text-primary" />
                    </div>
                </div>
            )
        }
    ], [calcData, manualFields, taxPeriodId, vatToPay, otherTaxes, vatRemanent, finalToPay])

    if (isClosed) {
        return (
            <BaseModal 
                open={isOpen} 
                onOpenChange={onOpenChange} 
                size="xl" 
                showCloseButton={false}
                title="Ciclo Finalizado"
            >
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-8 animate-in zoom-in-95 duration-500">
                    <CheckCircle2 className="h-12 w-12" />
                    <div className="space-y-3">
                        <h3 className="text-3xl font-black uppercase tracking-tight">Ciclo Finalizado</h3>
                        <p className="text-muted-foreground text-sm max-w-md px-10">La declaración F29 del periodo ha sido registrada y el ciclo bloqueado para futuros cambios.</p>
                    </div>
                    <Button onClick={() => onOpenChange(false)} className="px-10 h-11 font-black uppercase tracking-widest text-[11px]">Finalizar Proceso</Button>
                </div>
            </BaseModal>
        )
    }

    return (
        <GenericWizard
            key={`wizard-${isOpen}-${periodId}`}
            open={isOpen}
            onOpenChange={onOpenChange}
            onClose={() => onOpenChange(false)}
            initialStep={wizardInitialStep}
            isLoading={isLoading || isPreLoading}
            title={
                <div className="flex items-center gap-3">
                    <Calculator className="h-5 w-5 text-primary" />
                    <span>Asistente para Declaración Mensual F29</span>
                </div>
            }
            steps={steps}
            onComplete={async () => { await handleSaveAndClose(); }}
            isCompleting={isLoading}
            completeButtonLabel="Registrar y Finalizar"
            completeButtonIcon={<CheckCircle2 className="h-4 w-4 mr-2" />}
            size="xl"
        />
    )
}
