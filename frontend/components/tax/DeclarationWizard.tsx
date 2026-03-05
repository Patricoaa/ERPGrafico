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
    History
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { useServerDate } from "@/hooks/useServerDate"

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
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Calculator className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-xl font-bold">Asistente de Declaración F29</div>
                        <div className="text-muted-foreground text-xs font-normal">
                            Paso {step} de 4 {period.month && period.year && (
                                <span className="ml-2">• Período: {new Date(period.year, period.month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                            )}
                        </div>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-between items-center w-full">
                    <Button
                        variant="ghost"
                        onClick={prevStep}
                        disabled={step === 1 || isLoading}
                        className="rounded-xl"
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Anterior
                    </Button>

                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => onOpenChange(false)}
                            className="rounded-xl px-6"
                        >
                            Cancelar
                        </Button>
                        {step < 4 ? (
                            <Button
                                onClick={nextStep}
                                disabled={isLoading}
                                className="rounded-xl px-8 shadow-lg shadow-primary/20"
                            >
                                Siguiente
                                <ChevronRight className="h-4 w-4 ml-2" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSave}
                                disabled={isLoading}
                                className="rounded-xl px-10 bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-600/20"
                            >
                                <FileText className="h-4 w-4 mr-2" />
                                Registrar Declaración
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <div className="py-4">

                {step === 1 && (
                    <div className="space-y-6 max-w-md mx-auto py-8">
                        <div className="text-center space-y-2 mb-8">
                            <h3 className="text-xl font-semibold">Selecciona el Período a Declarar</h3>
                            <p className="text-sm text-muted-foreground">
                                Elige el mes y año para calcular el IVA y generar el formulario F29.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Año Tributario</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(() => {
                                        const baseYear = year || new Date().getFullYear();
                                        return [baseYear - 2, baseYear - 1, baseYear, baseYear + 1].map(y => (
                                            <div
                                                key={y}
                                                className={cn(
                                                    "cursor-pointer rounded-xl border-2 px-2 py-3 text-center transition-all hover:border-primary/50",
                                                    period.year === y ? "border-primary bg-primary/5 font-bold text-primary" : "border-muted bg-background"
                                                )}
                                                onClick={() => setPeriod(p => ({ ...p, year: y }))}
                                            >
                                                {y}
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Mes</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                                        const disabled = isPeriodDisabled(period.year, m)
                                        return (
                                            <div
                                                key={m}
                                                className={cn(
                                                    "rounded-lg border px-2 py-2 text-center text-sm transition-all",
                                                    disabled
                                                        ? "opacity-30 cursor-not-allowed bg-muted border-transparent"
                                                        : "cursor-pointer hover:border-primary/50",
                                                    !disabled && period.month === m ? "border-primary bg-primary/5 font-bold text-primary" : (!disabled ? "border-muted bg-background" : "")
                                                )}
                                                onClick={() => !disabled && setPeriod(p => ({ ...p, month: m }))}
                                            >
                                                {new Date(2000, m - 1, 1).toLocaleString('es-ES', { month: 'short' }).toUpperCase()}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-center">
                                <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-xs">
                                    <Info className="h-4 w-4" />
                                    Al continuar, se buscarán todos los documentos del período seleccionado.
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-8">
                            <section className="space-y-4">
                                <h3 className="font-bold text-lg flex items-center gap-2 text-primary">
                                    <ArrowUpRight className="h-5 w-5" />
                                    Débito Fiscal (Ventas)
                                </h3>
                                <div className="space-y-3 bg-muted/30 p-4 rounded-2xl border border-border/50">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Ventas Afectas</span>
                                        <span className="font-medium">{formatCurrency(calcData?.sales_taxed)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Ventas Exentas</span>
                                        <span className="font-medium">{formatCurrency(calcData?.sales_exempt)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-emerald-600">
                                        <span>Notas de Crédito (-)</span>
                                        <span>-{formatCurrency(calcData?.credit_notes_taxed)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between font-bold text-base pt-1">
                                        <span>Total Neto Ventas</span>
                                        <span>{formatCurrency(calcData?.net_taxed_sales)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-primary text-lg">
                                        <span>IVA Débito ({manualFields.tax_rate}%)</span>
                                        <span>{formatCurrency(calcData?.vat_debit)}</span>
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h3 className="font-bold text-lg flex items-center gap-2 text-indigo-600">
                                    <ArrowDownLeft className="h-5 w-5" />
                                    Crédito Fiscal (Compras)
                                </h3>
                                <div className="space-y-3 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Compras Afectas</span>
                                        <span className="font-medium">{formatCurrency(calcData?.purchases_taxed)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Compras Exentas</span>
                                        <span className="font-medium">{formatCurrency(calcData?.purchases_exempt)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-amber-600">
                                        <span>Notas de Crédito (-)</span>
                                        <span>-{formatCurrency(calcData?.purchase_credit_notes)}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between font-bold text-base pt-1">
                                        <span>Total Neto Compras</span>
                                        <span>{formatCurrency(calcData?.net_taxed_purchases)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-indigo-600 text-lg">
                                        <span>IVA Crédito ({manualFields.tax_rate}%)</span>
                                        <span>{formatCurrency(calcData?.vat_credit)}</span>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 flex gap-4 items-start text-sm text-primary/80">
                            <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
                            <p>
                                Estos valores son calculados automáticamente de las facturas y boletas publicadas en el sistema. Asegúrese de haber conciliado todos los documentos antes de proceder.
                            </p>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-6">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <HandCoins className="h-5 w-5 text-amber-500" />
                            Otros Impuestos y Retenciones
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="ppm">PPM (Pagos Provisionales Mensuales)</Label>
                                <Input
                                    id="ppm"
                                    type="number"
                                    value={manualFields.ppm_amount}
                                    onChange={(e) => setManualFields({ ...manualFields, ppm_amount: Number(e.target.value) })}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="withholding">Retención Honorarios (2da Categoría)</Label>
                                <Input
                                    id="withholding"
                                    type="number"
                                    value={manualFields.withholding_tax}
                                    onChange={(e) => setManualFields({ ...manualFields, withholding_tax: Number(e.target.value) })}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="remanente">Remanente de Mes Anterior</Label>
                                <Input
                                    id="remanente"
                                    type="number"
                                    readOnly
                                    value={manualFields.vat_credit_carryforward}
                                    className="rounded-xl bg-muted/50 cursor-not-allowed"
                                    title="Este valor se extrae automáticamente de la contabilidad"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reajuste">Reajuste Remanente (Art. 31)</Label>
                                <Input
                                    id="reajuste"
                                    type="number"
                                    value={manualFields.vat_correction_amount}
                                    onChange={(e) => setManualFields({ ...manualFields, vat_correction_amount: Number(e.target.value) })}
                                    className="rounded-xl"
                                    placeholder="Actualización monetaria"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="impuesto2da">Impuesto Único 2da Categoría</Label>
                                <Input
                                    id="impuesto2da"
                                    type="number"
                                    value={manualFields.second_category_tax}
                                    onChange={(e) => setManualFields({ ...manualFields, second_category_tax: Number(e.target.value) })}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="loan">Retención Préstamo Solidario (3%)</Label>
                                <Input
                                    id="loan"
                                    type="number"
                                    value={manualFields.loan_retention}
                                    onChange={(e) => setManualFields({ ...manualFields, loan_retention: Number(e.target.value) })}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ila">Impuesto Adicional (ILA)</Label>
                                <Input
                                    id="ila"
                                    type="number"
                                    value={manualFields.ila_tax}
                                    onChange={(e) => setManualFields({ ...manualFields, ila_tax: Number(e.target.value) })}
                                    className="rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="iva_ret">Retención IVA (Cambio Sujeto)</Label>
                                <Input
                                    id="iva_ret"
                                    type="number"
                                    value={manualFields.vat_withholding}
                                    onChange={(e) => setManualFields({ ...manualFields, vat_withholding: Number(e.target.value) })}
                                    className="rounded-xl"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
                            <CheckCircle2 className="h-10 w-10 animate-pulse" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold">Resumen de Declaración</h3>
                            <p className="text-muted-foreground">Período: {period.month}/{period.year}</p>
                        </div>

                        <div className="w-full max-w-md bg-muted/40 p-6 rounded-3xl border border-border/50 divide-y divide-border/30">
                            <div className="flex justify-between py-2">
                                <span className="text-muted-foreground">Débitos F. (Ventas)</span>
                                <span className="font-medium text-indigo-600">{formatCurrency(vatDebit)}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-muted-foreground">Créditos F. y Reajuste</span>
                                <span className="font-medium text-emerald-600">-{formatCurrency(totalVATCredits)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-dashed">
                                <span className="font-medium">Total IVA a Pagar</span>
                                <span className={cn("font-bold", vatToPay > 0 ? "text-red-500" : "text-emerald-500")}>{formatCurrency(vatToPay)}</span>
                            </div>
                            {vatRemanent > 0 && (
                                <div className="flex justify-between py-2 bg-emerald-500/5 px-2 -mx-2 rounded-lg">
                                    <span className="text-emerald-700 font-medium">Nuevo Remanente a Favor</span>
                                    <span className="font-bold text-emerald-600">{formatCurrency(vatRemanent)}</span>
                                </div>
                            )}
                            <div className="flex justify-between py-2">
                                <span className="text-muted-foreground">Retenciones e Impuesto</span>
                                <span className="font-medium text-amber-600">{formatCurrency(manualFields.withholding_tax + manualFields.second_category_tax)}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-muted-foreground">Pago Provisional PPM</span>
                                <span className="font-medium text-amber-600">{formatCurrency(manualFields.ppm_amount)}</span>
                            </div>
                            <div className="flex justify-between py-4 text-xl font-black border-t-2 border-border mt-2">
                                <span>TOTAL A PAGAR AL SII</span>
                                <span className="text-primary">{formatCurrency(finalToPay)}</span>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground max-w-sm">
                            Al confirmar, se generará un asiento contable registrando la obligación tributaria y se habilitará el registro de pago.
                        </p>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
