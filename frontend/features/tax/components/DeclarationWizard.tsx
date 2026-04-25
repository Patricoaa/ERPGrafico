"use client"

import { useState, useEffect, useMemo } from "react"
import { GenericWizard, WizardStep } from "@/components/shared/GenericWizard"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LabeledInput } from "@/components/shared"
import {
    Calculator,
    FileText,
    CheckCircle2,
    Info,
    ArrowUpRight,
    ArrowDownLeft,
    HandCoins,
    History,
    ArrowRight,
    Package,
    AlertCircle,
    ExternalLink
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useServerDate } from "@/hooks/useServerDate"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { TaxPeriod, TaxCalculationData } from "../types"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface DeclarationWizardProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    periodId?: number
    onSuccess: () => void
    existingPeriods?: TaxPeriod[]
}

export function DeclarationWizard({ isOpen, onOpenChange, periodId, onSuccess, existingPeriods = [] }: DeclarationWizardProps) {
    const { year: currentYear, month: currentMonth, dateString, serverDate } = useServerDate()
    const { openHub } = useHubPanel()
    const [isLoading, setIsLoading] = useState(false)
    const [calcData, setCalcData] = useState<TaxCalculationData | null>(null)
    const [taxPeriodId, setTaxPeriodId] = useState<number | null>(periodId || null)
    const [isClosed, setIsClosed] = useState(false)
    const [period, setPeriod] = useState({
        year: currentYear || new Date().getFullYear(),
        month: currentMonth || new Date().getMonth() + 1
    })
    const [isPreLoading, setIsPreLoading] = useState(false)
    const [wizardInitialStep, setWizardInitialStep] = useState(0)
    const [manualFields, setManualFields] = useState({
        ppm_amount: 0,
        withholding_tax: 0,
        vat_credit_carryforward: 0,
        vat_correction_amount: 0,
        second_category_tax: 0,
        loan_retention: 0,
        ila_tax: 0,
        vat_withholding: 0,
        tax_rate: 19,
        notes: ""
    })

    // Reset and initialize state when modal opens
    useEffect(() => {
        const initializeWizard = async () => {
            if (isOpen) {
                setIsClosed(false)
                
                // If we have a periodId, try to find it and skip step 1
                if (periodId && existingPeriods.length > 0) {
                    const targetPeriod = existingPeriods.find(p => p.id === periodId)
                    if (targetPeriod) {
                        // 1. Sync local period state
                        setPeriod({ year: targetPeriod.year, month: targetPeriod.month })
                        
                        // 2. Pre-load data
                        setIsPreLoading(true)
                        const success = await calculateDataForPeriod(targetPeriod.year, targetPeriod.month)
                        
                        if (success) {
                            setWizardInitialStep(1)
                        } else {
                            setWizardInitialStep(0)
                        }
                        setIsPreLoading(false)
                        return
                    }
                }

                // Default fallback: Start at step 0 with current date
                setWizardInitialStep(0)
                if (serverDate && currentYear !== null && currentMonth !== null) {
                    setPeriod({ year: currentYear, month: currentMonth })
                }
            }
        }

        initializeWizard()
    }, [isOpen, periodId, existingPeriods, serverDate, currentYear, currentMonth])

    // Helper for direct calculation that uses params instead of state (since state might not have updated yet)
    const calculateDataForPeriod = async (y: number, m: number) => {
        setIsLoading(true)
        try {
            const response = await api.post("/tax/declarations/calculate/", {
                year: y,
                month: m
            })
            setCalcData(response.data)
            if (response.data.tax_period_id) setTaxPeriodId(response.data.tax_period_id)
            if (response.data.tax_rate) {
                setManualFields(prev => ({
                    ...prev,
                    tax_rate: response.data.tax_rate,
                    vat_credit_carryforward: response.data.vat_credit_carryforward || 0
                }))
            }
            return true
        } catch (error) {
            console.error("Error calculating tax data:", error)
            toast.error("Error al calcular datos tributarios")
            return false
        } finally {
            setIsLoading(false)
        }
    }

    const isPeriodDisabled = (y: number, m: number) => {
        const targetDate = new Date(y, m - 1)
        const currentDate = serverDate || new Date()
        if (targetDate > currentDate) return true
        const closedPeriods = existingPeriods.filter(p => p.status === 'CLOSED')
        if (closedPeriods.length > 0) {
            closedPeriods.sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month))
            const lastClosed = closedPeriods[0]
            const lastClosedDate = new Date(lastClosed.year, lastClosed.month - 1)
            if (targetDate <= lastClosedDate) return true
        }
        return false
    }

    const calculateData = async () => {
        return calculateDataForPeriod(period.year, period.month)
    }

    const handleSaveAndClose = async () => {
        setIsLoading(true)
        try {
            const createResponse = await api.post("/tax/declarations/", {
                tax_period_year: period.year,
                tax_period_month: period.month,
                ...manualFields
            })
            const declarationId = createResponse.data.id
            const currentTaxPeriodId = createResponse.data.tax_period || taxPeriodId
            try {
                await api.post(`/tax/declarations/${declarationId}/register/`, {
                    declaration_date: dateString || ""
                })
            } catch (regError: unknown) {
                const isAlreadyRegistered =
                    (regError as { response?: { data?: { error?: string } } })?.response?.data?.error?.includes("ya fue registrada") ||
                    (regError as { response?: { data?: { error?: string } } })?.response?.data?.error?.includes("ya ha sido registrada")
                if (!isAlreadyRegistered) throw regError
            }
            if (currentTaxPeriodId) await api.post(`/tax/periods/${currentTaxPeriodId}/close/`)
            toast.success("Ciclo tributario finalizado exitosamente")
            setIsClosed(true)
            onSuccess();
            return true
        } catch (error: unknown) {
            console.error("Error in final process:", error)
            const apiError = error as { response?: { data?: { error?: string } } }
            toast.error(apiError.response?.data?.error || "Error al finalizar el ciclo tributario")
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
            id: 1,
            title: "Selección de Período",
            isValid: !!period.year && !!period.month,
            onNext: calculateData,
            component: (
                <div className="space-y-12 max-w-4xl mx-auto py-4">
                    <div className="text-center space-y-3">
                        <h3 className="text-2xl font-black tracking-tight uppercase text-foreground/80">Período de Declaración</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                            Seleccione el mes y año tributario para generar el F29.
                        </p>
                    </div>
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-1">Año Tributario</p>
                            <div className="grid grid-cols-4 gap-3">
                                {[2024, 2025, 2026].map(y => (
                                    <div
                                        key={y}
                                        className={cn(
                                            "cursor-pointer rounded-lg border border-transparent px-4 py-5 text-center transition-all duration-200",
                                            period.year === y ? "bg-primary/10 border-primary/20 scale-[1.02] shadow-sm shadow-primary/5" : "bg-muted/5 hover:bg-muted/10 text-muted-foreground"
                                        )}
                                        onClick={() => setPeriod(p => ({ ...p, year: y }))}
                                    >
                                        <div className={cn("text-sm font-bold tracking-wider", period.year === y ? "text-primary" : "")}>{y}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-1">Mes de Declaración</p>
                            <div className="grid grid-cols-4 gap-3">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                    const disabled = isPeriodDisabled(period.year, m)
                                    const isSelected = !disabled && period.month === m
                                    return (
                                        <div
                                            key={m}
                                            className={cn(
                                                "rounded-lg border border-transparent px-2 py-4 text-center transition-all duration-200",
                                                disabled ? "opacity-20 cursor-not-allowed grayscale" : "cursor-pointer",
                                                isSelected ? "bg-primary/10 border-primary/20 scale-[1.05] shadow-md shadow-primary/5 z-10" : (!disabled ? "bg-muted/5 hover:bg-muted/10" : "")
                                            )}
                                            onClick={() => !disabled && setPeriod(p => ({ ...p, month: m }))}
                                        >
                                            <div className={cn("text-[11px] font-black tracking-widest uppercase", isSelected ? "text-primary" : "text-muted-foreground/70")}>
                                                {new Date(2000, m - 1, 1).toLocaleString('es-ES', { month: 'short' })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 2,
            title: "Auditoría de Documentos (IVA)",
            isValid: true,
            component: (
                <div className="space-y-10 max-w-4xl mx-auto pb-6">
                    <div className="grid grid-cols-2 gap-12">
                        <section className="space-y-8">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 flex items-center gap-2 px-3">
                                    <ArrowUpRight className="h-3.5 w-3.5" /> Débito Fiscal
                                </span>
                                <div className="flex-1 h-px bg-border/60" />
                            </div>
                            <div className="space-y-4 bg-muted/5 p-6 rounded-lg border border-border/50">
                                <div className="flex justify-between items-center text-xs uppercase font-bold text-muted-foreground/70">
                                    <span>Ventas Afectas</span>
                                    <MoneyDisplay amount={calcData?.sales_taxed} showColor={false} className="font-bold" />
                                </div>
                                <div className="flex justify-between items-center text-xs uppercase font-bold text-muted-foreground/70">
                                    <span>Ventas Exentas</span>
                                    <MoneyDisplay amount={calcData?.sales_exempt} showColor={false} className="font-bold" />
                                </div>
                                <div className="pt-4 space-y-2 border-t border-border/30">
                                    <div className="flex justify-between items-end p-4 rounded-lg bg-primary/5 border border-primary/10">
                                        <span className="text-xs font-black uppercase text-primary/80">IVA Débito ({manualFields.tax_rate}%)</span>
                                        <MoneyDisplay amount={calcData?.vat_debit} className="text-2xl font-black text-primary" />
                                    </div>
                                </div>
                            </div>
                        </section>
                        <section className="space-y-8">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-3">
                                    <ArrowDownLeft className="h-3.5 w-3.5" /> Crédito Fiscal
                                </span>
                                <div className="flex-1 h-px bg-border/60" />
                            </div>
                            <div className="space-y-4 bg-primary/5 p-6 rounded-lg border border-primary/10">
                                <div className="flex justify-between items-center text-xs uppercase font-bold text-primary/50">
                                    <span>Compras Afectas</span>
                                    <MoneyDisplay amount={calcData?.purchases_taxed} showColor={false} className="font-bold" />
                                </div>
                                <div className="flex justify-between items-center text-xs uppercase font-bold text-primary/50">
                                    <span>Compras Exentas</span>
                                    <MoneyDisplay amount={calcData?.purchases_exempt} showColor={false} className="font-bold" />
                                </div>
                                <div className="pt-4 space-y-2 border-t border-primary/10">
                                    <div className="flex justify-between items-end p-4 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                                        <span className="text-xs font-black uppercase">IVA Crédito ({manualFields.tax_rate}%)</span>
                                        <MoneyDisplay amount={calcData?.vat_credit} className="text-2xl font-black" />
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                    {calcData?.drafts_summary && (calcData.drafts_summary.invoices.length > 0 || calcData.drafts_summary.entries.length > 0) && (
                        <Alert variant="default" className="border-warning/30 bg-warning/5 rounded-lg p-6">
                            <AlertCircle className="h-5 w-5 text-warning" />
                            <div className="space-y-4 w-full">
                                <AlertTitle className="text-sm font-black uppercase tracking-widest text-warning/90">Documentos en Borrador</AlertTitle>
                                <AlertDescription className="text-xs text-warning/70 font-medium">Hay pendientes que no se incluyeron. Se recomienda procesarlos.</AlertDescription>
                                <div className="grid grid-cols-2 gap-4">
                                    {calcData.drafts_summary.invoices.slice(0, 2).map(inv => (
                                        <div key={inv.id} className="flex items-center justify-between bg-white/50 p-3 rounded-xl border border-warning/10">
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
                        <div className="col-span-full flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-warning flex items-center gap-2 px-3">
                                <HandCoins className="h-3.5 w-3.5" /> Retenciones
                            </span>
                            <div className="flex-1 h-px bg-border/40" />
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
                        <div className="col-span-full flex items-center gap-3 pt-4">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-3">
                                <History className="h-3.5 w-3.5" /> Ajustes de IVA
                            </span>
                            <div className="flex-1 h-px bg-border/40" />
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
                <div className="max-w-4xl mx-auto pb-6 space-y-8">
                    <div className="bg-card border border-border/50 rounded-lg p-8 space-y-6">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-muted-foreground">IVA Determinado</span>
                            <MoneyDisplay amount={vatToPay} showColor={false} className="font-bold" />
                        </div>
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-muted-foreground">PPM + Retenciones</span>
                            <MoneyDisplay amount={otherTaxes} showColor={false} className="font-bold" />
                        </div>
                        {vatRemanent > 0 && (
                            <div className="flex justify-between items-center p-3 rounded-lg bg-success/5 border border-success/10">
                                <span className="text-success text-xs font-black uppercase">Nuevo Remanente a Favor</span>
                                <MoneyDisplay amount={vatRemanent} className="font-black text-success" />
                            </div>
                        )}
                        <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-primary/5 border-2 border-primary/20">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 mb-2">Total a Pagar SII</span>
                            <MoneyDisplay amount={finalToPay} className="text-4xl font-black text-primary" />
                        </div>
                    </div>
                </div>
            )
        }
    ], [period, calcData, manualFields, taxPeriodId, vatToPay, otherTaxes, vatRemanent, finalToPay])

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
