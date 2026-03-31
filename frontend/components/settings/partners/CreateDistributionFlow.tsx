"use client"

import React, { useState, useEffect } from "react"
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from "@/components/ui/dialog"
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
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { 
    Loader2, 
    PieChart,
    ArrowRight,
    CheckCircle2,
    Calculator,
    AlertTriangle,
    Wallet
} from "lucide-react"

interface ModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function CreateDistributionFlow({ open, onOpenChange, onSuccess }: ModalProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    
    // Step 1 Form
    const [formData, setFormData] = useState({
        fiscal_year: new Date().getFullYear() - 1,
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

    const resetFlow = () => {
        setStep(1)
        setDraftResolution(null)
        setLines([])
        setLineDestinations({})
        setFormData({
            fiscal_year: new Date().getFullYear() - 1,
            net_result: "",
            resolution_date: new Date().toISOString().split('T')[0],
            acta_number: "",
            notes: ""
        })
    }

    const handleCreateDraft = async () => {
        if (!formData.fiscal_year || !formData.net_result || !formData.resolution_date) {
            toast.error("Complete los parámetros obligatorios")
            return
        }
        
        setLoading(true)
        try {
            const res = await partnersApi.createProfitDistribution({
                fiscal_year: formData.fiscal_year,
                net_result: parseFloat(formData.net_result),
                resolution_date: formData.resolution_date,
                acta_number: formData.acta_number,
                notes: formData.notes
            })
            setDraftResolution(res)
            setLines(res.lines || [])
            
            // Initialize destinations
            const dests: Record<number, string> = {}
            res.lines?.forEach((l: any) => {
                dests[l.id] = l.destination
            })
            setLineDestinations(dests)
            
            setStep(2)
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al crear borrador de distribución")
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateDestinations = async () => {
        setLoading(true)
        try {
            const updates = Object.keys(lineDestinations).map(id => ({
                line_id: parseInt(id),
                destination: lineDestinations[parseInt(id)]
            }))
            
            await partnersApi.updateProfitDistributionLines(draftResolution.id, updates)
            setStep(3)
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al actualizar destinos")
        } finally {
            setLoading(false)
        }
    }

    const handleExecute = async () => {
        setLoading(true)
        try {
            // First approve, then execute
            await partnersApi.approveProfitDistribution(draftResolution.id)
            await partnersApi.executeProfitDistribution(draftResolution.id)
            
            toast.success("Distribución contable ejecutada con éxito")
            onSuccess()
            onOpenChange(false)
            resetFlow()
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al ejecutar la distribución")
        } finally {
            setLoading(false)
        }
    }

    // Determine titles based on step
    const stepTitles = [
        "Parámetros del Ejercicio",
        "Asignación y Destino",
        "Confirmación y Ejecución"
    ]

    return (
        <Dialog open={open} onOpenChange={(v) => { 
            if (!v && step > 1) {
                toast.warning("El borrador quedó guardado pero no ejecutado.")
            }
            onOpenChange(v) 
            if (!v) resetFlow() 
        }}>
            <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden">
                <div className="bg-muted/30 px-6 py-4 border-b flex items-center justify-between">
                    <div>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <PieChart className="h-5 w-5 text-primary" />
                            Distribución de Utilidades
                        </DialogTitle>
                        <DialogDescription className="mt-1">
                            Paso {step} de 3: {stepTitles[step-1]}
                        </DialogDescription>
                    </div>
                </div>

                <div className="p-6">
                    {/* STEP 1 */}
                    {step === 1 && (
                        <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Año Fiscal</Label>
                                    <Input 
                                        type="number" 
                                        value={formData.fiscal_year}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fiscal_year: parseInt(e.target.value) }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Fecha Resolución (Corte para %)</Label>
                                    <Input 
                                        type="date" 
                                        value={formData.resolution_date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, resolution_date: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2 mt-2">
                                <Label>Resultado Neto Contable ($)</Label>
                                <Input 
                                    type="number" 
                                    placeholder="Ej: 5000000 (Utilidad) o -2000000 (Pérdida)"
                                    value={formData.net_result}
                                    onChange={(e) => setFormData(prev => ({ ...prev, net_result: e.target.value }))}
                                    className="font-mono text-lg"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    * Los valores positivos (-) son Pérdidas.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="grid gap-2">
                                    <Label>Acta / Referencia (Opcional)</Label>
                                    <Input 
                                        value={formData.acta_number}
                                        onChange={(e) => setFormData(prev => ({ ...prev, acta_number: e.target.value }))}
                                        placeholder="Ej: Junta Ordinaria N° 12"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Notas</Label>
                                    <Input 
                                        value={formData.notes}
                                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mt-4 flex gap-3">
                                <Calculator className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                <div className="text-xs text-blue-800">
                                    Al continuar, el sistema buscará la <strong>participación exacta de cada socio a la fecha de resolución</strong> y pre-calculará la asignación descontando automáticamente los retiros provisorios realizados durante el año fiscal.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && draftResolution && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-emerald-50 text-emerald-900 p-3 rounded-lg border border-emerald-200">
                                <div>
                                    <div className="text-xs font-bold uppercase opacity-80">Resultado a Repartir</div>
                                    <div className="text-xl font-mono font-bold">{formatCurrency(draftResolution.net_result)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold uppercase opacity-80">Año</div>
                                    <div className="font-bold">{draftResolution.fiscal_year}</div>
                                </div>
                            </div>

                            <div className="border rounded-md overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted text-xs uppercase text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2">Socio</th>
                                            <th className="px-3 py-2 text-right">Torta (%)</th>
                                            <th className="px-3 py-2 text-right">Asignación</th>
                                            <th className="px-3 py-2 text-right text-rose-600">Menos Retirado</th>
                                            <th className="px-3 py-2 text-right">Neto a Destinar</th>
                                            <th className="px-3 py-2">Destino</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {lines.map((line: any) => (
                                            <tr key={line.id} className="hover:bg-muted/30">
                                                <td className="px-3 py-2 font-medium">{line.partner_name}</td>
                                                <td className="px-3 py-2 text-right font-bold">{line.percentage_at_date}%</td>
                                                <td className="px-3 py-2 text-right font-mono text-emerald-600">{formatCurrency(line.gross_amount)}</td>
                                                <td className="px-3 py-2 text-right font-mono text-rose-500">
                                                    {parseFloat(line.provisional_withdrawals_offset) > 0 ? `-${formatCurrency(line.provisional_withdrawals_offset)}` : '0'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-blue-600">
                                                    {formatCurrency(line.net_amount)}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {parseFloat(line.net_amount) > 0 || line.destination === 'ABSORB_LOSS' ? (
                                                        <Select 
                                                            value={lineDestinations[line.id]} 
                                                            onValueChange={(v) => setLineDestinations(prev => ({ ...prev, [line.id]: v }))}
                                                        >
                                                            <SelectTrigger className="h-8 text-xs w-[140px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {draftResolution.is_profit ? (
                                                                    <>
                                                                    <SelectItem value="DIVIDEND_PAYABLE">Pagar Dividendo</SelectItem>
                                                                    <SelectItem value="RETAIN">Retener Utilidades</SelectItem>
                                                                    <SelectItem value="REINVEST">Reinvertir (Capital)</SelectItem>
                                                                    </>
                                                                ) : (
                                                                    <SelectItem value="ABSORB_LOSS">Absorber Pérdida</SelectItem>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic pl-2">Compensado</span>
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
                        <div className="space-y-6 py-4">
                            <div className="flex flex-col items-center justify-center text-center space-y-4">
                                <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-8 w-8" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">Distribución Lista para Ejecutar</h3>
                                    <p className="text-sm text-muted-foreground max-w-md mt-2">
                                        Al ejecutar, el sistema registrará automáticamente:
                                    </p>
                                </div>
                            </div>
                            
                            <ul className="text-sm space-y-3 bg-muted/40 p-4 rounded-lg border">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                    <span>Cierre de la cuenta <strong>Utilidades del Ejercicio</strong>.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                    <span>Liquidación contable de los retiros provisorios de los socios seleccionados.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                    <span>Creación de pasivos en <strong>Dividendos por Pagar</strong> listos para ser emitidos desde la caja.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                    <span>Actualización de participaciones si hubo <strong>Reinversión de Utilidades</strong>.</span>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>

                <div className="bg-muted/30 px-6 py-4 border-t flex items-center justify-between">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        {step === 1 ? 'Cancelar' : 'Cerrar sin Ejecutar'}
                    </Button>
                    
                    {step === 1 && (
                        <Button onClick={handleCreateDraft} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Continuar a Asignación <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    )}
                    
                    {step === 2 && (
                        <Button onClick={handleUpdateDestinations} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Revisar Ejecución <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    )}

                    {step === 3 && (
                        <Button onClick={handleExecute} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
                            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Ejecutar Distribución Contable
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
