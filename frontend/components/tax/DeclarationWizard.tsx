"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
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

interface DeclarationWizardProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    periodId?: number
    onSuccess: () => void
}

export function DeclarationWizard({ isOpen, onOpenChange, periodId, onSuccess }: DeclarationWizardProps) {
    const [step, setStep] = useState(1)
    const [isLoading, setIsLoading] = useState(false)
    const [calcData, setCalcData] = useState<any>(null)
    const [manualFields, setManualFields] = useState({
        ppm_amount: 0,
        withholding_tax: 0,
        vat_credit_carryforward: 0,
        vat_correction_amount: 0,
        second_category_tax: 0,
        tax_rate: 19,
        notes: ""
    })

    // Updated calculation data fetching
    const calculateData = async () => {
        setIsLoading(true)
        try {
            // Use current year/month for calculation
            const now = new Date()
            const year = now.getFullYear()
            const month = now.getMonth() + 1 // getCurrentMonth

            const response = await api.post("/tax/declarations/calculate/", {
                year: year,
                month: month
            })
            setCalcData(response.data)

            // Sync tax rate from settings
            if (response.data.tax_rate) {
                setManualFields(prev => ({ ...prev, tax_rate: response.data.tax_rate }))
            }
        } catch (error) {
            console.error("Error calculating tax data:", error)
            toast.error("Error al calcular datos tributarios")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            calculateData()
            setStep(1)
        }
    }, [isOpen])

    const handleSave = async () => {
        setIsLoading(true)
        try {
            const now = new Date()
            // 1. Create declaration
            const createResponse = await api.post("/tax/declarations/", {
                tax_period_year: now.getFullYear(),
                tax_period_month: now.getMonth() + 1,
                ...manualFields
            })

            const declarationId = createResponse.data.id

            // 2. Register it officially
            await api.post(`/tax/declarations/${declarationId}/register/`, {
                folio_number: "", // Could be added to manual fields
                declaration_date: new Date().toISOString().split('T')[0]
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

    const nextStep = () => setStep(s => s + 1)
    const prevStep = () => setStep(s => s - 1)

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val || 0)

    // Calculate dynamic totals for step 3
    const totalDue = (calcData?.vat_debit || 0) + manualFields.withholding_tax + manualFields.second_category_tax
    const totalCredits = (calcData?.vat_credit || 0) + manualFields.vat_credit_carryforward + manualFields.vat_correction_amount + manualFields.ppm_amount
    const finalToPay = Math.max(0, totalDue - totalCredits)

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Calculator className="h-5 w-5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest">Paso {step} de 3</Badge>
                    </div>
                    <DialogTitle className="text-2xl font-bold">Asistente de Declaración F29</DialogTitle>
                    <DialogDescription>
                        Revise su débito y crédito fiscal antes de generar la declaración oficial.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    {step === 1 && (
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
                                            <span>Total Neto Sales</span>
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
                                    Estos valores son calculados automáticamente de las facturas y boletas publicadas en el sistema. Asegúrese de haber conciliado todos los documentos antes de proceder. La tasa de impuestos se obtiene de la configuración contable.
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
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
                                        value={manualFields.vat_credit_carryforward}
                                        onChange={(e) => setManualFields({ ...manualFields, vat_credit_carryforward: Number(e.target.value) })}
                                        className="rounded-xl"
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
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-6">
                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-2">
                                <CheckCircle2 className="h-10 w-10 animate-pulse" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold">Resumen de Declaración</h3>
                                <p className="text-muted-foreground">Período: {new Date().toLocaleString('es-CL', { month: 'long', year: 'numeric' })}</p>
                            </div>

                            <div className="w-full max-w-md bg-muted/40 p-6 rounded-3xl border border-border/50 divide-y divide-border/30">
                                <div className="flex justify-between py-2">
                                    <span className="text-muted-foreground">Total Impuestos Determinado</span>
                                    <span className="font-bold text-indigo-600">{formatCurrency(totalDue)}</span>
                                </div>
                                <div className="flex justify-between py-2">
                                    <span className="text-muted-foreground">Total Créditos/Pagos</span>
                                    <span className="font-medium text-emerald-600">{formatCurrency(totalCredits)}</span>
                                </div>
                                <div className="flex justify-between py-4 text-xl font-black">
                                    <span>TOTAL A PAGAR</span>
                                    <span className="text-primary">{formatCurrency(finalToPay)}</span>
                                </div>
                            </div>

                            <p className="text-xs text-muted-foreground max-w-sm">
                                Al confirmar, se generará un asiento contable registrando la obligación tributaria y se habilitará el registro de pago.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between items-center bg-muted/20 -mx-6 -mb-6 p-6 border-t rounded-b-lg">
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
                        {step < 3 ? (
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
