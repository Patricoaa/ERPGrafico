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
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { Wallet, CheckCircle2, Banknote } from "lucide-react"
import { ProfitDistribution, ProfitDistributionLine } from "@/features/contacts/types/partner"
import { TreasuryAccount } from "@/features/treasury/types"

interface MassPaymentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    resolution: ProfitDistribution
    onSuccess: () => void
}

export function MassPaymentModal({ open, onOpenChange, resolution, onSuccess }: MassPaymentModalProps) {
    const [loading, setLoading] = useState(false)
    const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([])
    const [selectedAccountId, setSelectedAccountId] = useState<string>("")
    const [payments, setPayments] = useState<Record<number, number>>({})

    const pendingLines = useMemo(() => {
        if (!resolution?.lines) return [];
        return resolution.lines.map((l: ProfitDistributionLine) => {
            const divAlloc = l.destinations?.find(d => d.destination === 'DIVIDEND');
            const totalAllocated = divAlloc ? parseFloat(divAlloc.amount) : 0;
            const paid = parseFloat(l.paid_dividend_amount || "0");
            return {
                ...l,
                pendingAmount: Math.max(0, totalAllocated - paid),
                totalAllocated,
                paid
            }
        }).filter(l => l.pendingAmount > 0)
    }, [resolution])

    useEffect(() => {
        if (open) {
            setSelectedAccountId("")
            const initialPayments: Record<number, number> = {}
            pendingLines.forEach(l => {
                initialPayments[l.partner] = l.pendingAmount
            })
            setPayments(initialPayments)

            import("@/lib/api").then(m => m.default).then(api => {
                api.get('/treasury/accounts/').then(res => setTreasuryAccounts(res.data)).catch(console.error)
            })
        }
    }, [open, pendingLines])

    const handleExecutePayment = async () => {
        setLoading(true)
        try {
            const paymentsData = Object.keys(payments).map(pId => ({
                partner_id: parseInt(pId),
                amount: payments[parseInt(pId)]
            })).filter(p => p.amount > 0)

            await partnersApi.massPaymentProfitDistribution(resolution.id, parseInt(selectedAccountId), paymentsData)
            toast.success("Pagos procesados correctamente.")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al procesar pagos")
        } finally {
            setLoading(false)
        }
    }

    const steps: WizardStep[] = useMemo(() => {
        const totalToPay = Object.values(payments).reduce((sum, val) => sum + val, 0)
        const partnersCount = Object.values(payments).filter(val => val > 0).length

        return [
            {
                id: 1,
                title: "Beneficiarios y Montos",
                isValid: totalToPay > 0 && pendingLines.every(l => (payments[l.partner] || 0) <= l.pendingAmount),
                component: (
                    <div className="space-y-4">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Suma a Pagar</p>
                                <p className="text-2xl font-mono font-bold text-success mt-1">{formatCurrency(totalToPay)}</p>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        const next: Record<number, number> = {}
                                        pendingLines.forEach(l => next[l.partner] = l.pendingAmount)
                                        setPayments(next)
                                    }}
                                    className="text-[10px] font-bold text-primary underline hover:text-primary/80"
                                >
                                    Pagar Totalidad
                                </button>
                                <button
                                    onClick={() => setPayments({})}
                                    className="text-[10px] font-bold text-muted-foreground underline hover:text-muted-foreground/80"
                                >
                                    Limpiar Todo
                                </button>
                            </div>
                        </div>

                        <div className="border rounded-sm overflow-x-auto max-h-[300px] overflow-y-auto">
                            <table className="w-full text-[11px] text-left">
                                <thead className="bg-muted text-[10px] font-black uppercase text-muted-foreground tracking-wider border-b sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-3">Socio</th>
                                        <th className="px-3 py-3 text-right">Pendiente ($)</th>
                                        <th className="px-3 py-3 w-[160px] text-right">A Pagar ($)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y relative z-0">
                                    {pendingLines.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground text-[11px] font-bold">
                                                No hay dividendos pendientes de pago
                                            </td>
                                        </tr>
                                    )}
                                    {pendingLines.map((line) => {
                                        const currentVal = payments[line.partner] || 0
                                        const isOver = currentVal > line.pendingAmount
                                        return (
                                            <tr key={line.id} className="hover:bg-muted/30">
                                                <td className="px-3 py-2 font-black">{line.partner_name}</td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-primary">{formatCurrency(line.pendingAmount)}</td>
                                                <td className="px-3 py-2">
                                                    <Input 
                                                        type="number"
                                                        className={`h-8 text-[11px] font-mono text-right ${isOver ? 'border-destructive text-destructive focus-visible:ring-destructive' : ''}`}
                                                        value={payments[line.partner] !== undefined ? payments[line.partner] : ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                                            setPayments(p => ({ ...p, [line.partner]: val }))
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            },
            {
                id: 2,
                title: "Cuenta de Origen",
                isValid: !!selectedAccountId,
                component: (
                    <div className="space-y-4">
                        <div className="bg-success/5 border border-success/20 rounded-sm p-4 flex flex-col items-center justify-center">
                            <span className="text-[10px] uppercase font-black text-success tracking-widest opacity-80 mb-1">Monto de la Transacción ({partnersCount} pagos)</span>
                            <span className="text-3xl font-mono font-bold text-success">{formatCurrency(totalToPay)}</span>
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Cuenta de Tesorería (Salida de Dinero)</Label>
                            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione banco o caja" />
                                </SelectTrigger>
                                <SelectContent>
                                    {treasuryAccounts.map(a => (
                                        <SelectItem key={a.id} value={a.id.toString()}>{a.name} ({a.identifier})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground mt-1 pl-1 font-medium">
                                Esta será la cuenta bancaria de donde se extraerán los fondos para liquidar los dividendos seleccionados.
                            </p>
                        </div>
                    </div>
                )
            },
            {
                id: 3,
                title: "Confirmación",
                isValid: true,
                component: (
                    <div className="space-y-6 py-4">
                        <div className="flex flex-col items-center justify-center text-center space-y-4">
                            <Banknote className="h-8 w-8" />
                            <div>
                                <h3 className="text-xl font-heading font-black uppercase tracking-tighter">Ejecutar Pagos Masivos</h3>
                                <p className="text-sm text-muted-foreground max-w-md mt-2">
                                    Se registrará la salida del dinero de la tesorería y la disminución de la deuda de &quot;Dividendos por Pagar&quot; con {partnersCount} miembros.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-3 bg-muted/40 p-5 rounded-sm border">
                            <div className="flex items-center gap-3 text-xs font-medium">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                <span>Total Neto Desembolsado: <strong className="font-mono">{formatCurrency(totalToPay)}</strong></span>
                            </div>
                        </div>
                    </div>
                )
            }
        ]
    }, [payments, pendingLines, selectedAccountId, treasuryAccounts])

    if (!resolution) return null

    return (
        <GenericWizard
            open={open}
            onOpenChange={onOpenChange}
            onClose={() => onOpenChange(false)}
            title={
                <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-success" />
                    <span>Pagos de Dividendos</span>
                </div>
            }
            steps={steps}
            onComplete={handleExecutePayment}
            isCompleting={loading}
            completeButtonLabel="Firmar y Transferir"
            size="xl"
            initialStep={0}
        />
    )
}
