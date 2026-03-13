"use client"

import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Calculator,
    ChevronRight,
    ChevronLeft,
    FileText,
    CheckCircle2,
    Info,
    ArrowUpRight,
    ArrowDownLeft,
    HandCoins,
    History,
    ArrowRight
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { useServerDate } from "@/hooks/useServerDate"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { FORM_STYLES } from "@/lib/styles"

interface DeclarationWizardProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    periodId?: number
    onSuccess: () => void
    existingPeriods?: any[]
}

export function DeclarationWizard({ isOpen, onOpenChange, periodId, onSuccess, existingPeriods = [] }: DeclarationWizardProps) {
    const { year, month, dateString, serverDate } = useServerDate()
    const [step, setStep] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [calcData, setCalcData] = useState<any>(null)
    const [period, setPeriod] = useState({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1
    })
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

    // Helper to determine if a period should be disabled
    const isPeriodDisabled = (y: number, m: number) => {
        const targetDate = new Date(y, m - 1)
        const currentDate = serverDate || new Date()

        // 1. Future periods (strictly future relative to server/current date)
        if (targetDate > currentDate) return true;

        // 2. Closed periods
        // Find the latest closed period from existing data
        const closedPeriods = existingPeriods.filter(p => p.status === 'CLOSED')
        if (closedPeriods.length > 0) {
            // Sort to find the most recent closed period
            closedPeriods.sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year
                return b.month - a.month
            })
            const lastClosed = closedPeriods[0]
            const lastClosedDate = new Date(lastClosed.year, lastClosed.month - 1)

            // If target is BEFORE or EQUAL to last closed, it's restricted
            if (targetDate <= lastClosedDate) return true;
        }

        return false;
    }

    // Updated calculation data fetching
    const calculateData = async () => {
        setIsLoading(true)
        try {
            const response = await api.post("/tax/declarations/calculate/", {
                year: period.year,
                month: period.month
            })
            setCalcData(response.data)

            // Sync tax rate from settings
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

    useEffect(() => {
        if (isOpen) {
            // Sync with server date on open if available
            if (serverDate && year !== null && month !== null) {
                setPeriod({
                    year: year,
                    month: month
                })
            }

            setStep(1)
        }
    }, [isOpen, serverDate])



    const handleSave = async () => {
        setIsLoading(true)
        try {
            // 1. Create declaration
            const createResponse = await api.post("/tax/declarations/", {
                tax_period_year: period.year,
                tax_period_month: period.month,
                ...manualFields
            })

            const declarationId = createResponse.data.id

            // 2. Register it officially
            await api.post(`/tax/declarations/${declarationId}/register/`, {
                folio_number: "", // Could be added to manual fields
                declaration_date: dateString || ""
            })

            toast.success("Declaración registrada y asiento contable generado")
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            console.error("Error saving declaration:", error)
            toast.error("Error al registrar la declaración")
        } finally {
            setIsLoading(false)
        }
    }

    const nextStep = async () => {
        if (step === 1) {
            // Validate period and perform calculation
            const success = await calculateData();
            if (success) {
                setStep(s => s + 1)
            }
        } else {
            setStep(s => s + 1)
        }
    }
    const prevStep = () => setStep(s => s - 1)

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val || 0)

    // Calculate dynamic totals for step 4
    const vatDebit = calcData?.vat_debit || 0;
    const vatCredit = calcData?.vat_credit || 0;

    // Total Credits for VAT Use ONLY
    const totalVATCredits = vatCredit + manualFields.vat_credit_carryforward + manualFields.vat_correction_amount;

    // Total VAT strictly to Pay 
    const vatToPay = Math.max(0, vatDebit - totalVATCredits);

    // Total Remanent left over
    const vatRemanent = Math.max(0, totalVATCredits - vatDebit);

    // Other non-VAT tax obligations
    const otherTaxes = manualFields.withholding_tax + manualFields.second_category_tax + manualFields.ppm_amount;

    // The grand total 
    const finalToPay = vatToPay + otherTaxes;

    return (
        <BaseModal
            open={isOpen}
            onOpenChange={onOpenChange}
            size="xl"
            variant="wizard"
            title={
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary shadow-sm border border-primary/5">
                        <Calculator className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <div className="text-2xl font-black tracking-tight text-foreground/90 uppercase">Asistente F29</div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="h-5 text-[10px] font-bold uppercase tracking-wider bg-muted/50 border-primary/20 text-primary/80">
                                Paso {step} de 4
                            </Badge>
                            {period.month && period.year && (
                                <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-widest opacity-70">
                                    • {new Date(period.year, period.month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-between items-center w-full">
                    <Button
                        variant="ghost"
                        onClick={step === 1 ? () => onOpenChange(false) : prevStep}
                        disabled={isLoading}
                        className="rounded-xl px-6 h-11 text-muted-foreground hover:bg-muted/50 transition-all font-bold uppercase tracking-widest text-[10px]"
                    >
                        {step === 1 ? "Cancelar" : (
                            <>
                                <ChevronLeft className="h-3.5 w-3.5 mr-2" />
                                Anterior
                            </>
                        )}
                    </Button>

                    <div className="flex items-center gap-3">
                        {step < 4 ? (
                            <Button 
                                onClick={nextStep} 
                                disabled={isLoading || !period.year || !period.month}
                                className="rounded-xl px-8 h-11 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-black uppercase tracking-widest text-[10px] group"
                            >
                                Siguiente
                                <ChevronRight className="ml-2 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        ) : (
                            <Button 
                                onClick={handleSave} 
                                disabled={isLoading}
                                className="rounded-xl px-10 h-11 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all font-black uppercase tracking-widest text-[10px] group"
                            >
                                {isLoading ? "Procesando..." : "Finalizar Declaración"}
                                {!isLoading && <CheckCircle2 className="ml-2 h-3.5 w-3.5 group-hover:scale-110 transition-transform" />}
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <div className="py-4">

                {step === 1 && (
                    <div className="space-y-12 max-w-4xl mx-auto py-10 min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center space-y-3">
                            <h3 className="text-2xl font-black tracking-tight uppercase text-foreground/80">Selección de Período</h3>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                Seleccione el mes y año tributario para el cual desea generar la declaración de impuestos F29.
                            </p>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-4">
                                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-1">Año Tributario</Label>
                                <div className="grid grid-cols-4 gap-3">
                                    {(() => {
                                        const baseYear = year || new Date().getFullYear();
                                        return [baseYear - 2, baseYear - 1, baseYear, baseYear + 1].map(y => (
                                            <div
                                                key={y}
                                                className={cn(
                                                    "cursor-pointer rounded-2xl border border-transparent px-4 py-5 text-center transition-all duration-200",
                                                    period.year === y 
                                                        ? "bg-primary/10 border-primary/20 scale-[1.02] shadow-sm shadow-primary/5" 
                                                        : "bg-muted/5 hover:bg-muted/10 text-muted-foreground"
                                                )}
                                                onClick={() => setPeriod(p => ({ ...p, year: y }))}
                                            >
                                                <div className={cn(
                                                    "text-sm font-bold tracking-wider",
                                                    period.year === y ? "text-primary" : ""
                                                )}>{y}</div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-1">Mes de Declaración</Label>
                                <div className="grid grid-cols-4 gap-3">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                        const disabled = isPeriodDisabled(period.year, m)
                                        const isSelected = !disabled && period.month === m
                                        return (
                                            <div
                                                key={m}
                                                className={cn(
                                                    "rounded-xl border border-transparent px-2 py-4 text-center transition-all duration-200",
                                                    disabled
                                                        ? "opacity-20 cursor-not-allowed grayscale"
                                                        : "cursor-pointer",
                                                    isSelected
                                                        ? "bg-primary/10 border-primary/20 scale-[1.05] shadow-md shadow-primary/5 z-10"
                                                        : (!disabled ? "bg-muted/5 hover:bg-muted/10" : "")
                                                )}
                                                onClick={() => !disabled && setPeriod(p => ({ ...p, month: m }))}
                                            >
                                                <div className={cn(
                                                    "text-[11px] font-black tracking-widest uppercase",
                                                    isSelected ? "text-primary" : "text-muted-foreground/70"
                                                )}>
                                                    {new Date(2000, m - 1, 1).toLocaleString('es-ES', { month: 'short' })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="pt-6">
                                <div className="flex items-start gap-4 p-5 bg-primary/5 border border-primary/10 rounded-2xl text-primary/70">
                                    <Info className="h-5 w-5 mt-0.5 flex-shrink-0 opacity-80" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold uppercase tracking-wider">Flujo de Trabajo</p>
                                        <p className="text-xs leading-relaxed opacity-80">
                                            Al continuar, el sistema consolidará automáticamente todas las facturas, boletas y retenciones registradas para el período seleccionado.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-10 max-w-4xl mx-auto min-h-[600px] animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="grid grid-cols-2 gap-12">
                            {/* Débito Fiscal */}
                            <section className="space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-border/60" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 flex items-center gap-2 px-3">
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                        Débito Fiscal
                                    </span>
                                    <div className="flex-1 h-px bg-border/60" />
                                </div>

                                <div className="space-y-4 bg-muted/5 p-6 rounded-3xl border border-transparent hover:border-primary/10 transition-all">
                                    <div className="flex justify-between items-center text-xs uppercase tracking-wider font-bold text-muted-foreground/70 px-1">
                                        <span>Conceptos de Venta</span>
                                        <span>Monto Neto</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center py-1 border-b border-border/30 border-dashed">
                                            <span className="text-sm font-medium">Ventas Afectas</span>
                                            <MoneyDisplay amount={calcData?.sales_taxed} showColor={false} className="font-bold text-sm" />
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-border/30 border-dashed">
                                            <span className="text-sm font-medium">Ventas Exentas</span>
                                            <MoneyDisplay amount={calcData?.sales_exempt} showColor={false} className="font-bold text-sm" />
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-border/30 border-dashed">
                                            <span className="text-sm font-medium text-rose-500/80">Notas de Crédito (-)</span>
                                            <MoneyDisplay amount={calcData?.credit_notes_taxed ? -calcData.credit_notes_taxed : 0} className="font-bold text-sm text-rose-600" />
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Total Neto Ventas</span>
                                            <MoneyDisplay amount={calcData?.net_taxed_sales} showColor={false} className="text-lg font-black tracking-tight" />
                                        </div>
                                        <div className="flex justify-between items-end p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                            <span className="text-xs font-black uppercase tracking-[0.1em] text-primary/80">IVA Débito ({manualFields.tax_rate}%)</span>
                                            <MoneyDisplay amount={calcData?.vat_debit} className="text-2xl font-black text-primary drop-shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Crédito Fiscal */}
                            <section className="space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-border/60" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2 px-3">
                                        <ArrowDownLeft className="h-3.5 w-3.5" />
                                        Crédito Fiscal
                                    </span>
                                    <div className="flex-1 h-px bg-border/60" />
                                </div>

                                <div className="space-y-4 bg-indigo-50/10 p-6 rounded-3xl border border-transparent hover:border-indigo-500/10 transition-all">
                                    <div className="flex justify-between items-center text-xs uppercase tracking-wider font-bold text-indigo-600/50 px-1">
                                        <span>Conceptos de Compra</span>
                                        <span>Monto Neto</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center py-1 border-b border-indigo-100/30 border-dashed">
                                            <span className="text-sm font-medium">Compras Afectas</span>
                                            <MoneyDisplay amount={calcData?.purchases_taxed} showColor={false} className="font-bold text-sm" />
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-indigo-100/30 border-dashed">
                                            <span className="text-sm font-medium">Compras Exentas</span>
                                            <MoneyDisplay amount={calcData?.purchases_exempt} showColor={false} className="font-bold text-sm" />
                                        </div>
                                        <div className="flex justify-between items-center py-1 border-b border-indigo-100/30 border-dashed">
                                            <span className="text-sm font-medium text-amber-600">Notas de Crédito (-)</span>
                                            <MoneyDisplay amount={calcData?.purchase_credit_notes ? -calcData.purchase_credit_notes : 0} className="font-bold text-sm text-amber-600" />
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600/50">Total Neto Compras</span>
                                            <MoneyDisplay amount={calcData?.net_taxed_purchases} showColor={false} className="text-lg font-black tracking-tight text-indigo-600/80" />
                                        </div>
                                        <div className="flex justify-between items-end p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-600">
                                            <span className="text-xs font-black uppercase tracking-[0.1em] opacity-80">IVA Crédito ({manualFields.tax_rate}%)</span>
                                            <MoneyDisplay amount={calcData?.vat_credit} className="text-2xl font-black drop-shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 flex gap-4 items-center text-[11px] text-primary/70 font-medium uppercase tracking-wider justify-center">
                            <Info className="h-4 w-4 flex-shrink-0 opacity-80" />
                            <span>Valores calculados automáticamente. Verifique la conciliación de documentos antes de proceder.</span>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-10 max-w-4xl mx-auto min-h-[600px] animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="space-y-12">
                            {/* Grupo 1: Retenciones Mensuales */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                <div className="space-y-10 col-span-full">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-border/60" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 flex items-center gap-2 px-3">
                                            <HandCoins className="h-3.5 w-3.5" />
                                            Retenciones e Impuesto Único
                                        </span>
                                        <div className="flex-1 h-px bg-border/60" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className={FORM_STYLES.label} htmlFor="ppm">PPM (Pagos Provisionales)</Label>
                                    <Input
                                        id="ppm"
                                        type="number"
                                        value={manualFields.ppm_amount}
                                        onChange={(e) => setManualFields({ ...manualFields, ppm_amount: Number(e.target.value) })}
                                        className={FORM_STYLES.input}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={FORM_STYLES.label} htmlFor="withholding">Retención Honorarios (13.75%)</Label>
                                    <Input
                                        id="withholding"
                                        type="number"
                                        value={manualFields.withholding_tax}
                                        onChange={(e) => setManualFields({ ...manualFields, withholding_tax: Number(e.target.value) })}
                                        className={FORM_STYLES.input}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={FORM_STYLES.label} htmlFor="impuesto2da">Impuesto Único 2da Categoría</Label>
                                    <Input
                                        id="impuesto2da"
                                        type="number"
                                        value={manualFields.second_category_tax}
                                        onChange={(e) => setManualFields({ ...manualFields, second_category_tax: Number(e.target.value) })}
                                        className={FORM_STYLES.input}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={FORM_STYLES.label} htmlFor="loan">Préstamo Solidario (3%)</Label>
                                    <Input
                                        id="loan"
                                        type="number"
                                        value={manualFields.loan_retention}
                                        onChange={(e) => setManualFields({ ...manualFields, loan_retention: Number(e.target.value) })}
                                        className={FORM_STYLES.input}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Grupo 2: Ajustes de IVA y Remanentes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                                <div className="space-y-10 col-span-full">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-border/60" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 flex items-center gap-2 px-3">
                                            <History className="h-3.5 w-3.5" />
                                            Ajustes de IVA y Remanentes
                                        </span>
                                        <div className="flex-1 h-px bg-border/60" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className={FORM_STYLES.label} htmlFor="remanente">Remanente Mes Anterior</Label>
                                    <Input
                                        id="remanente"
                                        type="number"
                                        readOnly
                                        value={manualFields.vat_credit_carryforward}
                                        className={cn(FORM_STYLES.input, "bg-muted/50 cursor-not-allowed border-dashed grayscale opacity-70")}
                                        title="Valor automático desde contabilidad"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={FORM_STYLES.label} htmlFor="reajuste">Reajuste Art. 31 (Actualización)</Label>
                                    <Input
                                        id="reajuste"
                                        type="number"
                                        value={manualFields.vat_correction_amount}
                                        onChange={(e) => setManualFields({ ...manualFields, vat_correction_amount: Number(e.target.value) })}
                                        className={FORM_STYLES.input}
                                        placeholder="Variación IPC"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={FORM_STYLES.label} htmlFor="iva_ret">Retenciones IVA Sufridas</Label>
                                    <Input
                                        id="iva_ret"
                                        type="number"
                                        value={manualFields.vat_withholding}
                                        onChange={(e) => setManualFields({ ...manualFields, vat_withholding: Number(e.target.value) })}
                                        className={FORM_STYLES.input}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className={FORM_STYLES.label} htmlFor="ila">Otros Impuestos (ILA/Adic.)</Label>
                                    <Input
                                        id="ila"
                                        type="number"
                                        value={manualFields.ila_tax}
                                        onChange={(e) => setManualFields({ ...manualFields, ila_tax: Number(e.target.value) })}
                                        className={FORM_STYLES.input}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-500/5 p-5 rounded-2xl border border-amber-500/10 flex gap-4 items-center text-[11px] text-amber-700/70 font-medium uppercase tracking-wider justify-center mx-auto max-w-2xl">
                            <Info className="h-4 w-4 flex-shrink-0 opacity-80" />
                            <span>Complete los campos manuales según la información adicional del período.</span>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-10 max-w-4xl mx-auto min-h-[600px] animate-in fade-in zoom-in-95 duration-500">
                        <div className="text-center space-y-3">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 mb-2 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <h3 className="text-2xl font-black tracking-tight uppercase text-foreground/80">Resumen de Declaración</h3>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold opacity-60">F29 • {new Date(period.year, period.month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
                        </div>

                        <div className="relative">
                            {/* Decorative Receipt Edge */}
                            <div className="absolute -top-3 left-0 right-0 h-3 bg-[radial-gradient(circle,transparent_0,transparent_4px,white_4px,white_100%)] bg-[length:12px_12px] opacity-10" />
                            
                            <div className="bg-card border-x border-b border-border/50 rounded-b-3xl shadow-xl shadow-primary/5 p-8 space-y-8 overflow-hidden">
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                                        <ArrowRight className="h-3 w-3" />
                                        Detalle de Impuestos
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">IVA Determinado (Ventas - Compras)</span>
                                            <MoneyDisplay amount={vatToPay} showColor={false} className="font-bold" />
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Pago Provisional PPM</span>
                                            <MoneyDisplay amount={manualFields.ppm_amount} showColor={false} className="font-bold" />
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Retenciones Honorarios e I. Único</span>
                                            <MoneyDisplay amount={manualFields.withholding_tax + manualFields.second_category_tax} showColor={false} className="font-bold" />
                                        </div>
                                        {vatRemanent > 0 && (
                                            <div className="flex justify-between items-center text-sm bg-emerald-500/5 px-2 -mx-2 rounded-lg py-1">
                                                <span className="text-emerald-700 font-bold">Nuevo Remanente a Favor</span>
                                                <MoneyDisplay amount={vatRemanent} className="font-black text-emerald-600" />
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />

                                <section className="space-y-8 pt-2">
                                    <div className="flex flex-col items-center justify-center p-8 rounded-3xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
                                        {/* Background Decoration */}
                                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
                                            <Calculator className="w-32 h-32 text-primary" />
                                        </div>
                                        
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 mb-2">Total a Pagar SII</span>
                                        <MoneyDisplay 
                                            amount={finalToPay} 
                                            className="text-5xl font-black tracking-tighter text-primary drop-shadow-sm transition-transform hover:scale-105" 
                                        />
                                        <div className="mt-4 flex items-center gap-2">
                                            <Badge variant="outline" className="h-5 px-3 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 border-emerald-500/20 text-emerald-600">
                                                Listo para Enviar
                                            </Badge>
                                        </div>
                                    </div>
                                </section>

                                <div className="text-center pt-2">
                                    <p className="text-[10px] text-muted-foreground/60 italic leading-relaxed">
                                        Al hacer clic en "Finalizar Declaración", se creará el registro contable y se marcará el período como cerrado. Esta acción generará una obligación de pago en la tesorería.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
