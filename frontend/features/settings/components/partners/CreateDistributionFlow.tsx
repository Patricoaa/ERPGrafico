"use client"

import { showApiError } from "@/lib/errors"
import React, { useState, useEffect, useMemo } from "react"
import { GenericWizard, WizardStep } from "@/components/shared/GenericWizard"
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
import { ProfitDistribution, ProfitDistributionLine } from "@/features/contacts/types/partner"
import { accountingApi } from "@/features/accounting/api/accountingApi"
import { FiscalYear } from "@/features/accounting/types"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { 
    PieChart,
    Calculator,
    CheckCircle2,
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
    initialResolution?: ProfitDistribution
}

export function CreateDistributionFlow({ open, onOpenChange, onSuccess, initialResolution }: ModalProps) {
    const [loading, setLoading] = useState(false)
    const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
    
    // Step 1 Form
    const [formData, setFormData] = useState({
        fiscal_year_id: "",
        net_result: "",
        resolution_date: new Date().toISOString().split('T')[0],
        acta_number: "",
        notes: ""
    })

    // Draft Resolution State (from backend)
    const [draftResolution, setDraftResolution] = useState<ProfitDistribution | null>(null)
    const [lines, setLines] = useState<ProfitDistributionLine[]>([])

    type DestinationAllocation = {
        destination: string;
        amount: number;
    }
    // Destinations config: line_id -> array of allocations
    const [lineDestinations, setLineDestinations] = useState<Record<number, DestinationAllocation[]>>({})

    const resetFlow = () => {
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
            
            const dests: Record<number, DestinationAllocation[]> = {}
            initialResolution.lines?.forEach((l) => {
                dests[l.id] = (l.destinations || []).map(d => ({
                    ...d,
                    amount: parseFloat(d.amount as unknown as string)
                }))
                // if it's loss, auto assign
                if (initialResolution.is_loss && dests[l.id].length === 0) {
                     dests[l.id] = [{ destination: 'LOSS', amount: Math.abs(parseFloat(l.net_amount)) }]
                }
            })
            setLineDestinations(dests)
        } else if (!open) {
            resetFlow()
        }
    }, [open, initialResolution])

    const handleCreateOrUpdateDraft = async () => {
        if (!formData.fiscal_year_id || !formData.net_result || !formData.resolution_date) {
            toast.error("Complete los parámetros obligatorios")
            return false
        }

        const resultAmount = parseFloat(formData.net_result)
        if (isNaN(resultAmount) || resultAmount === 0) {
            toast.error("El resultado del ejercicio no puede ser cero para realizar una distribución.")
            return false
        }

        try {
            const payload = {
                fiscal_year_id: parseInt(formData.fiscal_year_id),
                net_result: parseFloat(formData.net_result),
                resolution_date: formData.resolution_date,
                acta_number: formData.acta_number,
                notes: formData.notes
            }

            let res: ProfitDistribution;
            if (draftResolution?.status === 'DRAFT') {
                await partnersApi.updateProfitDistribution(draftResolution.id, payload)
                res = await partnersApi.recalculateProfitDistribution(draftResolution.id)
            } else {
                res = await partnersApi.createProfitDistribution(payload)
            }
            
            setDraftResolution(res)
            setLines(res.lines || [])
            
            const dests: Record<number, DestinationAllocation[]> = {}
            res.lines?.forEach((l) => {
                dests[l.id] = (l.destinations || []).map(d => ({
                    ...d,
                    amount: parseFloat(d.amount as unknown as string)
                }))
                if (res.is_loss && dests[l.id].length === 0) {
                     dests[l.id] = [{ destination: 'LOSS', amount: Math.abs(parseFloat(l.net_amount)) }]
                }
            })
            setLineDestinations(dests)
            
            return true
        } catch (error: unknown) {
            showApiError(error, "Error al procesar distribución")
            return false
        }
    }

    const handleUpdateDestinations = async () => {
        let hasError = false
        lines.forEach(l => {
            const net = parseFloat(l.net_amount)
            if (net <= 0 && draftResolution?.is_profit) return;
            const dests = lineDestinations[l.id] || []
            const sum = dests.reduce((acc, d) => acc + d.amount, 0)
            if (Math.abs(sum - Math.abs(net)) > 0.01) {
                hasError = true
            }
        })

        if (hasError) {
            toast.error("Debe asignar la totalidad del monto neto exacto para cada socio.")
            return false
        }

        try {
            const updates = Object.keys(lineDestinations).map(id => ({
                line_id: parseInt(id),
                destinations: lineDestinations[parseInt(id)].filter(d => d.amount > 0)
            }))
            
            if (draftResolution) {
                await partnersApi.updateProfitDistributionLines(draftResolution.id, updates)
            }
            return true
        } catch (error: unknown) {
            showApiError(error, "Error al actualizar destinos")
            return false
        }
    }

    const handleExecute = async () => {
        setLoading(true)
        try {
            if (draftResolution) {
                if (draftResolution.status === 'DRAFT') {
                    await partnersApi.approveProfitDistribution(draftResolution.id)
                }
                await partnersApi.executeProfitDistribution(draftResolution.id)
            }
            toast.success("Distribución contable ejecutada con éxito")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al ejecutar la distribución")
        } finally {
            setLoading(false)
        }
    }

    const steps: WizardStep[] = useMemo(() => [
        {
            id: 1,
            title: "Parámetros del Ejercicio",
            isValid: !!formData.fiscal_year_id && !!formData.net_result && !!formData.resolution_date,
            onNext: handleCreateOrUpdateDraft,
            component: (
                <div className="grid gap-6">
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
                                readOnly
                                className="font-mono text-2xl h-14 pl-12 bg-muted/50 cursor-not-allowed"
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
            )
        },
        {
            id: 2,
            title: "Asignación y Destino",
            isValid: lines.length > 0 && lines.every(l => {
                const net = parseFloat(l.net_amount);
                if (net <= 0 && draftResolution?.is_profit) return true;
                const dests = lineDestinations[l.id] || [];
                const sum = dests.reduce((acc, d) => acc + d.amount, 0);
                return Math.abs(sum - Math.abs(net)) <= 0.01;
            }),
            onNext: handleUpdateDestinations,
            component: (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <IndustrialCard variant="standard" className="p-4 bg-muted/20">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Monto a Distribuir</p>
                            <p className="text-xl font-mono font-bold text-primary">{formatCurrency(draftResolution?.net_result || 0)}</p>
                        </IndustrialCard>
                        <IndustrialCard variant="standard" className="p-4 bg-muted/20">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Ejercicio</p>
                            <p className="text-xl font-heading font-black">{draftResolution?.fiscal_year}</p>
                        </IndustrialCard>
                    </div>

                    <div className="border rounded-sm overflow-hidden min-h-[300px]">
                        <table className="w-full text-[11px] text-left">
                            <thead className="bg-muted text-[10px] font-black uppercase text-muted-foreground tracking-wider border-b">
                                <tr>
                                    <th className="px-3 py-3">Socio</th>
                                    <th className="px-3 py-3 text-right">Torta (%)</th>
                                    <th className="px-3 py-3 text-right">Info Montos</th>
                                    {draftResolution?.is_profit ? (
                                        <>
                                        <th className="px-2 py-3 w-[120px]">Dividendos ($)</th>
                                        <th className="px-2 py-3 w-[120px]">Reinversión ($)</th>
                                        <th className="px-2 py-3 w-[120px]">Retenido ($)</th>
                                        <th className="px-3 py-3 w-[90px] text-right">Diferencia</th>
                                        </>
                                    ) : (
                                        <th className="px-3 py-3">Absorción (Pérdida)</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {lines.map((line) => {
                                    const net = parseFloat(line.net_amount);
                                    const isCompensated = net <= 0 && draftResolution?.is_profit;
                                    const dests = lineDestinations[line.id] || [];
                                    
                                    const getAmount = (type: string) => dests.find(d => d.destination === type)?.amount || 0;
                                    
                                    const handleAmountChange = (type: string, val: string) => {
                                        const numVal = val === '' ? 0 : parseFloat(val);
                                        setLineDestinations(prev => {
                                            const arr = [...(prev[line.id] || [])];
                                            const idx = arr.findIndex(d => d.destination === type);
                                            if (idx >= 0) arr[idx] = { destination: type, amount: numVal };
                                            else arr.push({ destination: type, amount: numVal });
                                            return { ...prev, [line.id]: arr };
                                        });
                                    };

                                    const sumAllocated = dests.reduce((sum, d) => sum + d.amount, 0);
                                    const remaining = Math.abs(net) - sumAllocated;
                                    
                                    return (
                                        <tr key={line.id} className="hover:bg-muted/30">
                                            <td className="px-3 py-2 font-black">{line.partner_name}</td>
                                            <td className="px-3 py-2 text-right font-bold text-muted-foreground">{line.percentage_at_date}%</td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="flex flex-col text-[10px]">
                                                    <span className="text-success">Bruto: {formatCurrency(line.gross_amount)}</span>
                                                    <span className="text-destructive">Retiros: {parseFloat(line.provisional_withdrawals_offset) > 0 ? `-${formatCurrency(line.provisional_withdrawals_offset)}` : '0'}</span>
                                                    <span className="font-bold text-primary text-[11px]">Neto: {formatCurrency(line.net_amount)}</span>
                                                </div>
                                            </td>
                                            {isCompensated ? (
                                                <td colSpan={draftResolution?.is_profit ? 4 : 1} className="px-3 py-2 text-center">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Retiros Compensan Totalmente Utilidad Bruta</span>
                                                </td>
                                            ) : draftResolution?.is_profit ? (
                                                <>
                                                <td className="px-2 py-2">
                                                    <Input 
                                                        type="number"
                                                        className="h-8 text-[11px] font-mono text-right"
                                                        value={getAmount('DIVIDEND') || ''}
                                                        onChange={(e) => handleAmountChange('DIVIDEND', e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <Input 
                                                        type="number"
                                                        className="h-8 text-[11px] font-mono text-right"
                                                        value={getAmount('REINVEST') || ''}
                                                        onChange={(e) => handleAmountChange('REINVEST', e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <Input 
                                                        type="number"
                                                        className="h-8 text-[11px] font-mono text-right"
                                                        value={getAmount('RETAINED') || ''}
                                                        onChange={(e) => handleAmountChange('RETAINED', e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-[11px]">
                                                    <span className={Math.abs(remaining) <= 0.01 ? "text-success" : remaining < 0 ? "text-destructive" : "text-muted-foreground"}>
                                                        {remaining > 0 ? '+' : ''}{formatCurrency(remaining)}
                                                    </span>
                                                </td>
                                                </>
                                            ) : (
                                                <td className="px-3 py-2 text-[10px] font-bold text-muted-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <span>Monto Automático a Absorber: {formatCurrency(Math.abs(parseFloat(line.net_amount)))}</span>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
        },
        {
            id: 3,
            title: "Confirmación y Ejecución",
            isValid: true,
            component: (
                <div className="space-y-6 py-4">
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <Wallet className="h-8 w-8" />
                        <div>
                            <h3 className="text-xl font-heading font-black uppercase tracking-tighter">Confirmación de Ejecución</h3>
                            <p className="text-sm text-muted-foreground max-w-md mt-2">
                                Al ejecutar, el sistema impactará el patrimonio de la empresa automáticamente.
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid gap-3 bg-muted/40 p-5 rounded-sm border">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Impactos Contables Automatizados</p>
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
            )
        }
    ], [fiscalYears, formData, lines, lineDestinations, draftResolution])

    return (
        <GenericWizard
            open={open}
            onOpenChange={onOpenChange}
            onClose={() => {
                onOpenChange(false)
                resetFlow()
            }}
            title={
                <div className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    <span>Distribución de Utilidades</span>
                </div>
            }
            steps={steps}
            onComplete={handleExecute}
            isCompleting={loading}
            completeButtonLabel="Ejecutar Contabilidad"
            size="xl"
            initialStep={initialResolution?.status === 'DRAFT' ? 1 : 0}
        />
    )
}
