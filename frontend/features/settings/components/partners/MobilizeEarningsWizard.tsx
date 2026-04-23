"use client"

import { showApiError } from "@/lib/errors"
import React, { useState, useEffect, useMemo } from "react"
import { GenericWizard, WizardStep } from "@/components/shared/GenericWizard"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { ArrowRightLeft, CheckCircle2 } from "lucide-react"
import { Partner } from "@/features/contacts/types/partner"

interface MobilizeEarningsWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    initialPartnerId?: number
}

export function MobilizeEarningsWizard({ open, onOpenChange, onSuccess, initialPartnerId }: MobilizeEarningsWizardProps) {
    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<Partner[]>([])
    const [mobilizations, setMobilizations] = useState<Record<number, { dividend: number, reinvest: number }>>({})
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
    const [description, setDescription] = useState("Movilización de utilidades retenidas")

    useEffect(() => {
        if (open) {
            const fetchPartners = async () => {
                try {
                    const data = await partnersApi.getPartners()
                    let availablePartners = data.filter((p: Partner) => parseFloat(p.partner_earnings_balance || "0") > 0)
                    
                    if (initialPartnerId) {
                        availablePartners = availablePartners.filter((p: Partner) => p.id === initialPartnerId)
                    }

                    setPartners(availablePartners)
                    
                    const initial: Record<number, { dividend: number, reinvest: number }> = {}
                    availablePartners.forEach((p: Partner) => {
                        initial[p.id] = { dividend: 0, reinvest: 0 }
                    })
                    setMobilizations(initial)
                } catch (error) {
                    console.error("Error fetching partners:", error)
                }
            }
            fetchPartners()
        }
    }, [open, initialPartnerId])

    const handleExecute = async () => {
        setLoading(true)
        try {
            const payload = Object.keys(mobilizations).map(idStr => {
                const id = parseInt(idStr)
                return {
                    partner_id: id,
                    dividend_amount: mobilizations[id].dividend,
                    reinvest_amount: mobilizations[id].reinvest
                }
            }).filter(m => m.dividend_amount > 0 || m.reinvest_amount > 0)

            await partnersApi.massMobilizeRetainedEarnings({
                date,
                description,
                mobilizations: payload
            })
            
            toast.success("Utilidades movilizadas correctamente.")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al movilizar utilidades")
        } finally {
            setLoading(false)
        }
    }

    const steps: WizardStep[] = useMemo(() => {
        const totalDividend = Object.values(mobilizations).reduce((s, v) => s + v.dividend, 0)
        const totalReinvest = Object.values(mobilizations).reduce((s, v) => s + v.reinvest, 0)
        const totalMobilized = totalDividend + totalReinvest
        
        let hasErrors = false

        return [
            {
                id: 1,
                title: "Asignación de Saldos",
                isValid: totalMobilized > 0 && !hasErrors,
                component: (
                    <div className="space-y-4">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total a Movilizar</p>
                                <p className="text-2xl font-mono font-bold text-primary mt-1">{formatCurrency(totalMobilized)}</p>
                            </div>
                        </div>

                        {partners.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                No hay socios con utilidades retenidas disponibles.
                            </div>
                        ) : (
                            <div className="border border-border/50 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                            <th className="py-2 px-3 text-left font-medium">Socio</th>
                                            <th className="py-2 px-3 text-right font-medium">Retenidas Dispo.</th>
                                            <th className="py-2 px-3 text-right font-medium w-32">A Dividendos</th>
                                            <th className="py-2 px-3 text-right font-medium w-32">A Re-inversión</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {partners.map(partner => {
                                            const available = parseFloat(partner.partner_earnings_balance || "0")
                                            const divValue = mobilizations[partner.id]?.dividend || 0
                                            const reinvValue = mobilizations[partner.id]?.reinvest || 0
                                            const totalAssigned = divValue + reinvValue
                                            const isError = totalAssigned > available
                                            if (isError) hasErrors = true

                                            return (
                                                <tr key={partner.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="py-3 px-3 font-medium">
                                                        {partner.name}
                                                    </td>
                                                    <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                                                        {formatCurrency(available)}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <Input 
                                                            type="number"
                                                            className={`h-8 font-mono text-right ${isError ? 'border-destructive text-destructive' : ''}`}
                                                            value={divValue || ""}
                                                            placeholder="0"
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value) || 0
                                                                setMobilizations(prev => ({
                                                                    ...prev,
                                                                    [partner.id]: { ...prev[partner.id], dividend: val }
                                                                }))
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <Input 
                                                            type="number"
                                                            className={`h-8 font-mono text-right ${isError ? 'border-destructive text-destructive' : ''}`}
                                                            value={reinvValue || ""}
                                                            placeholder="0"
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value) || 0
                                                                setMobilizations(prev => ({
                                                                    ...prev,
                                                                    [partner.id]: { ...prev[partner.id], reinvest: val }
                                                                }))
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {hasErrors && (
                            <p className="text-xs text-destructive mt-2 text-right font-medium">
                                Los montos asignados no pueden superar el disponible de cada socio.
                            </p>
                        )}
                    </div>
                )
            },
            {
                id: 2,
                title: "Confirmación",
                isValid: true,
                component: (
                    <div className="space-y-6">
                        <div className="bg-muted/30 p-4 rounded-lg flex items-start gap-3 border border-border/50">
                            <ArrowRightLeft className="w-5 h-5 text-primary mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="font-heading font-semibold text-sm">Resumen de Movilización</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Se procederá a movilizar utilidades retenidas pasadas. 
                                    Este proceso generará automáticamente los asientos contables correspondientes 
                                    disminuyendo la cuenta de utilidades retenidas y abonando a las cuentas de dividendos por pagar o capital suscrito.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1 border p-3 rounded-lg bg-card">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">A Dividendos Pagar</p>
                                <p className="text-xl font-mono text-foreground font-semibold">{formatCurrency(totalDividend)}</p>
                            </div>
                            <div className="space-y-1 border p-3 rounded-lg bg-card">
                                <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">A Re-Inversión</p>
                                <p className="text-xl font-mono text-muted-foreground font-semibold">{formatCurrency(totalReinvest)}</p>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Opciones Adicionales</Label>
                            
                            <div className="grid gap-2">
                                <Label className="text-sm">Fecha Contable</Label>
                                <Input 
                                    type="date" 
                                    value={date} 
                                    onChange={(e) => setDate(e.target.value)} 
                                />
                            </div>
                            
                            <div className="grid gap-2">
                                <Label className="text-sm">Descripción del Asiento</Label>
                                <Input 
                                    value={description} 
                                    onChange={(e) => setDescription(e.target.value)} 
                                    placeholder="Distribución extraordinaria de utilidades..."
                                />
                            </div>
                        </div>
                    </div>
                )
            }
        ]
    }, [partners, mobilizations, date, description])

    return (
        <GenericWizard
            open={open}
            onOpenChange={onOpenChange}
            title="Movilizar Utilidades Retenidas"
            steps={steps}
            onComplete={handleExecute}
            onClose={() => onOpenChange(false)}
            isCompleting={loading}
        />
    )
}
