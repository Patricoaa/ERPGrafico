"use client"

import { showApiError } from "@/lib/errors"
import React, { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { accountingApi } from "@/features/accounting/api/accountingApi"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { 
    Loader2, 
    PieChart,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    Calculator,
    AlertTriangle,
    Wallet,
    CalendarCheck2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { 
    Alert, 
    AlertTitle, 
    AlertDescription 
} from "@/components/ui/alert"
import { IndustrialCard } from "@/components/shared/IndustrialCard"

interface ModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    initialResolution?: any
}

export function CreateDistributionFlow({ open, onOpenChange, onSuccess, initialResolution }: ModalProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [fiscalYears, setFiscalYears] = useState<any[]>([])
    
    // Step 1 Form
    const [formData, setFormData] = useState({
        fiscal_year_id: "",
        net_result: "",
        resolution_date: new Date().toISOString().split('T')[0],
        acta_number: "",
        notes: ""
    })

    // Draft Resolution State (from backend)
    const [draftResolution, setDraftResolution] = useState<any>(null)
    const [lines, setLines] = useState<any[]>([])

    // Destinations config
    const [lineDestinations, setLineDestinations] = useState<Record<number, string>>({})

    const totalSteps = 3
    const stepTitles = [
        "Parámetros del Ejercicio",
        "Asignación y Destino",
        "Confirmación y Ejecución"
    ]

    const resetFlow = () => {
        setStep(1)
        setDraftResolution(null)
        setLines([])
        setLineDestinations({})
        setFormData({
            fiscal_year_id: "",
            net_result: "",
            resolution_date: new Date().toISOString().split('T')[0],
            acta_number: "",
            notes: ""
        })
    }

    // Load closed fiscal years
    useEffect(() => {
        if (open) {
            const fetchYears = async () => {
                try {
                    const data = await accountingApi.getFiscalYears({ status: 'CLOSED' })
                    setFiscalYears(data)
                    
                    // Pre-select if yearId is in URL
                    const params = new URLSearchParams(window.location.search)
                    const yearParam = params.get('yearId')
                    if (yearParam) {
                        const fy = data.find(f => f.year.toString() === yearParam)
                        if (fy) {
                            setFormData(prev => ({
                                ...prev,
                                fiscal_year_id: fy.id.toString(),
                                net_result: fy.net_result?.toString() || ""
                            }))
                        }
                    }
                } catch (error) {
                    console.error("Error loading fiscal years", error)
                }
            }
            fetchYears()
        }
    }, [open])

    // Hydrate state if initialResolution is provided
    useEffect(() => {
        if (open && initialResolution) {
            setDraftResolution(initialResolution)
            setFormData({
                fiscal_year_id: initialResolution.fiscal_year_obj?.toString() || "",
                net_result: initialResolution.net_result.toString(),
                resolution_date: initialResolution.resolution_date,
                acta_number: initialResolution.acta_number || "",
                notes: initialResolution.notes || ""
            })
            setLines(initialResolution.lines || [])
            
            const dests: Record<number, string> = {}
            initialResolution.lines?.forEach((l: any) => {
                dests[l.id] = l.destination
            })
            setLineDestinations(dests)

            // Jump to correct step based on status
            if (initialResolution.status === 'DRAFT') {
                setStep(2)
            } else if (initialResolution.status === 'APPROVED') {
                setStep(3)
            }
        } else if (!open) {
            resetFlow()
        }
    }, [open, initialResolution])

    const handleCreateOrUpdateDraft = async () => {
        if (!formData.fiscal_year_id || !formData.net_result || !formData.resolution_date) {
            toast.error("Complete los parámetros obligatorios")
            return
        }
        
        setLoading(true)
        try {
            const payload = {
                fiscal_year_id: parseInt(formData.fiscal_year_id),
                net_result: parseFloat(formData.net_result),
                resolution_date: formData.resolution_date,
                acta_number: formData.acta_number,
                notes: formData.notes
            }

            if (draftResolution?.status === 'DRAFT') {
                await partnersApi.updateProfitDistribution(draftResolution.id, payload)
                const res = await partnersApi.recalculateProfitDistribution(draftResolution.id)
                setDraftResolution(res)
                setLines(res.lines || [])
            } else {
                const res = await partnersApi.createProfitDistribution(payload)
                setDraftResolution(res)
                setLines(res.lines || [])
            }
            
            const dests: Record<number, string> = {}
            lines?.forEach((l: any) => {
                dests[l.id] = l.destination
            })
            setLineDestinations(dests)
            
            setStep(2)
        } catch (error: unknown) {
            showApiError(error, "Error al procesar distribución")
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteDraft = async () => {
        if (!draftResolution) return
        
        setLoading(true)
        try {
            await partnersApi.deleteProfitDistribution(draftResolution.id)
            toast.success("Borrador eliminado")
            onSuccess()
            onOpenChange(false)
            resetFlow()
        } catch (error: unknown) {
            toast.error("Error al eliminar borrador")
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateDestinations = async () => {
        const allSet = lines.every(l => !!lineDestinations[l.id])
        if (!allSet) {
            toast.error("Debe asignar un destino para todos los socios antes de continuar")
            return
        }

        setLoading(true)
        try {
            const updates = Object.keys(lineDestinations).map(id => ({
                line_id: parseInt(id),
                destination: lineDestinations[parseInt(id)]
            }))
            
            await partnersApi.updateProfitDistributionLines(draftResolution.id, updates)
            setStep(3)
        } catch (error: unknown) {
            showApiError(error, "Error al actualizar destinos")
        } finally {
            setLoading(false)
        }
    }

    const handleExecute = async () => {
        setLoading(true)
        try {
            if (draftResolution.status === 'DRAFT') {
                await partnersApi.approveProfitDistribution(draftResolution.id)
            }
            await partnersApi.executeProfitDistribution(draftResolution.id)
            toast.success("Distribución contable ejecutada con éxito")
            onSuccess()
            onOpenChange(false)
            resetFlow()
        } catch (error: unknown) {
            showApiError(error, "Error al ejecutar la distribución")
        } finally {
            setLoading(false)
        }
    }

    const renderStepIndicator = () => (
        <div className="flex items-center justify-between mb-8 px-2">
            {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className={cn(
                        "w-8 h-8 rounded-sm flex items-center justify-center text-xs font-bold transition-all duration-300",
                        step === s ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]" :
                            step > s ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                    )}>
                        {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                    </div>
                    {s < 3 && (
                        <div className={cn(
                            "h-[1px] flex-1 mx-2",
                            step > s ? "bg-success" : "bg-border"
                        )} />
                    )}
                </div>
            ))}
        </div>
    );

    return (
        <BaseModal
            open={open}
            onOpenChange={(v) => { 
                if (!v && step > 1) {
                    toast.warning("El borrador quedó guardado pero no ejecutado.")
                }
                onOpenChange(v) 
                if (!v) resetFlow() 
            }}
            title={
                <div className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    <span>Distribución de Utilidades</span>
                </div>
            }
            description={`Paso ${step} de ${totalSteps}: ${stepTitles[step - 1]}`}
            headerClassName="bg-muted/30"
            size="xl"
            hideScrollArea
        >
            <div className="flex flex-col h-full min-h-[500px] p-6 pt-2">
                {renderStepIndicator()}

                <div className="flex-1">
                    {/* STEP 1 */}
                    {step === 1 && (
                        <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Ejercicio Fiscal Cerrado</Label>
                                    <Select 
                                        value={formData.fiscal_year_id}
                                        onValueChange={(val) => {
                                            const fy = fiscalYears.find(f => f.id.toString() === val)
                                            setFormData(prev => ({ 
                                                ...prev, 
                                                fiscal_year_id: val,
                                                net_result: fy?.net_result?.toString() || "" 
                                            }))
                                        }}
                                    >
                                        <SelectTrigger className="font-bold">
                                            <SelectValue placeholder="Seleccione un año cerrado" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {fiscalYears.map(fy => (
                                                <SelectItem key={fy.id} value={fy.id.toString()}>{fy.year} - Cerrado</SelectItem>
                                            ))}
                                            {fiscalYears.length === 0 && (
                                                <p className="text-[10px] p-2 text-muted-foreground text-center">No hay años cerrados disponibles</p>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Fecha de Resolución</Label>
                                    <Input 
                                        type="date" 
                                        value={formData.resolution_date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, resolution_date: e.target.value }))}
                                        className="font-medium"
                                    />
                                </div>
                            </div>
                            
                            <div className="grid gap-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Resultado Neto ($)</Label>
                                <div className="relative">
                                    <Input 
                                        type="number" 
                                        placeholder="0"
                                        value={formData.net_result}
                                        onChange={(e) => setFormData(prev => ({ ...prev, net_result: e.target.value }))}
                                        className="font-mono text-2xl h-14 pl-12"
                                    />
                                    <Calculator className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <span className={cn(
                                            "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-sm",
                                            parseFloat(formData.net_result) >= 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                                        )}>
                                            {parseFloat(formData.net_result) >= 0 ? "Utilidad" : "Pérdida"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Número de Acta</Label>
                                    <Input 
                                        value={formData.acta_number}
                                        onChange={(e) => setFormData(prev => ({ ...prev, acta_number: e.target.value }))}
                                        placeholder="Ej: Acta N° 42"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Notas Internas</Label>
                                    <Input 
                                        value={formData.notes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="Distribuir según pacto social"
                                    />
                                </div>
                            </div>

                            <Alert className="bg-primary/5 border-primary/20">
                                <CalendarCheck2 className="h-5 w-5 text-primary" />
                                <AlertTitle className="text-primary font-bold uppercase text-[10px]">Automatización Activa</AlertTitle>
                                <AlertDescription className="text-foreground/80 font-medium text-[10px] leading-relaxed">
                                    El sistema calculará la participación exacta a la fecha de resolución y descontará automáticamente los <strong>retiros provisorios</strong> detectados en la contabilidad del ejercicio.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && draftResolution && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <IndustrialCard variant="standard" className="p-4 bg-muted/20">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Monto a Distribuir</p>
                                    <p className="text-xl font-mono font-bold text-primary">{formatCurrency(draftResolution.net_result)}</p>
                                </IndustrialCard>
                                <IndustrialCard variant="standard" className="p-4 bg-muted/20">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Ejercicio</p>
                                    <p className="text-xl font-heading font-black">{draftResolution.fiscal_year}</p>
                                </IndustrialCard>
                            </div>

                            <div className="border rounded-sm overflow-hidden">
                                <table className="w-full text-[11px] text-left">
                                    <thead className="bg-muted text-[10px] font-black uppercase text-muted-foreground tracking-wider border-b">
                                        <tr>
                                            <th className="px-3 py-3">Socio</th>
                                            <th className="px-3 py-3 text-right">Torta (%)</th>
                                            <th className="px-3 py-3 text-right">Bruto</th>
                                            <th className="px-3 py-3 text-right text-destructive">Retiros</th>
                                            <th className="px-3 py-3 text-right">A Destinar</th>
                                            <th className="px-3 py-3">Destino</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {lines.map((line: any) => (
                                            <tr key={line.id} className="hover:bg-muted/30">
                                                <td className="px-3 py-2 font-black">{line.partner_name}</td>
                                                <td className="px-3 py-2 text-right font-bold text-muted-foreground">{line.percentage_at_date}%</td>
                                                <td className="px-3 py-2 text-right font-mono text-success">{formatCurrency(line.gross_amount)}</td>
                                                <td className="px-3 py-2 text-right font-mono text-destructive">
                                                    {parseFloat(line.provisional_withdrawals_offset) > 0 ? `-${formatCurrency(line.provisional_withdrawals_offset)}` : '0'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-primary">
                                                    {formatCurrency(line.net_amount)}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {parseFloat(line.net_amount) > 0 || line.destination === 'ABSORB_LOSS' ? (
                                                        <Select 
                                                            value={lineDestinations[line.id]} 
                                                            onValueChange={(v) => setLineDestinations(prev => ({ ...prev, [line.id]: v }))}
                                                        >
                                                            <SelectTrigger className="h-8 text-[10px] w-[140px] font-bold">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {draftResolution.is_profit ? (
                                                                    <>
                                                                    <SelectItem value="DIVIDEND">Pagar Dividendo</SelectItem>
                                                                    <SelectItem value="RETAINED">Retener Utilidades</SelectItem>
                                                                    <SelectItem value="REINVEST">Reinvertir (Capital)</SelectItem>
                                                                    </>
                                                                ) : (
                                                                    <SelectItem value="LOSS">Absorber Pérdida</SelectItem>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase pl-2">Compensado</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* STEP 3 */}
                    {step === 3 && (
                        <div className="space-y-6 py-4 animate-in zoom-in-95 duration-300">
                            <div className="flex flex-col items-center justify-center text-center space-y-4">
                                <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                                    <Wallet className="h-8 w-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-heading font-black uppercase tracking-tighter">Confirmación de Ejecución</h3>
                                    <p className="text-sm text-muted-foreground max-w-md mt-2">
                                        Al ejecutar, el sistema impactará el patrimonio de la empresa automáticamente.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="grid gap-3 bg-muted/40 p-5 rounded-sm border">
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Impacto Contables Automatizado</p>
                                {[
                                    `Cierre de la cuenta "Utilidades del Ejercicio"`,
                                    `Liquidación contable de retiros provisorios de socios`,
                                    `Creación de pasivos en "Dividendos por Pagar"`,
                                    `Aumento de Capital si hubo Reinversión`
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 text-xs font-medium">
                                        <CheckCircle2 className="h-4 w-4 text-success" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center pt-8 border-t border-border mt-8">
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={step === 1 ? () => onOpenChange(false) : () => setStep(step - 1)}
                            className="font-bold uppercase tracking-widest text-[10px]"
                            disabled={loading}
                        >
                            <ArrowLeft className="w-3 h-3 mr-2" />
                            {step === 1 ? 'Cancelar' : 'Anterior'}
                        </Button>
                    </div>

                    <div className="flex gap-3">
                        {draftResolution?.status === 'DRAFT' && step === 2 && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-destructive border-destructive/20 hover:bg-destructive/10 font-bold uppercase tracking-widest text-[10px]"
                                onClick={handleDeleteDraft}
                                disabled={loading}
                            >
                                Anular Borrador
                            </Button>
                        )}

                        {step === 1 && (
                            <Button onClick={handleCreateOrUpdateDraft} disabled={loading} className="font-bold uppercase tracking-widest text-[10px]">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                                {draftResolution ? "Recalcular Distribución" : "Generar Borrador"}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}

                        {step === 2 && (
                            <Button onClick={handleUpdateDestinations} disabled={loading} className="font-bold uppercase tracking-widest text-[10px]">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                Confirmar Destinos
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}

                        {step === 3 && (
                            <Button onClick={handleExecute} className="bg-primary hover:bg-primary/90 font-black uppercase tracking-[0.15em] px-8" disabled={loading}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
                                Ejecutar Contabilidad
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </BaseModal>
    )
}
