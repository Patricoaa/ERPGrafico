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
import { Loader2, Wallet, Banknote } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface MassPaymentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    resolution: any
    onSuccess: () => void
}

export function MassPaymentModal({ open, onOpenChange, resolution, onSuccess }: MassPaymentModalProps) {
    const [loading, setLoading] = useState(false)
    const [treasuryAccounts, setTreasuryAccounts] = useState<any[]>([])
    const [selectedAccountId, setSelectedAccountId] = useState<string>("")

    useEffect(() => {
        if (open) {
            setSelectedAccountId("")
            import("@/lib/api").then(m => m.default).then(api => {
                api.get('/treasury/accounts/').then(res => setTreasuryAccounts(res.data)).catch(console.error)
            })
        }
    }, [open])

    if (!resolution) return null

    // Calculate pending dividends
    const pendingLines = resolution.lines?.filter((l: any) => l.destination === 'DIVIDEND_PAYABLE' && parseFloat(l.net_amount) > 0 && !l.treasury_movement) || []
    const totalPending = pendingLines.reduce((sum: number, l: any) => sum + parseFloat(l.net_amount), 0)

    const handleSubmit = async () => {
        if (!selectedAccountId) {
            toast.error("Seleccione una cuenta de origen.")
            return
        }

        setLoading(true)
        try {
            await partnersApi.massPaymentProfitDistribution(resolution.id, parseInt(selectedAccountId))
            toast.success("Pago masivo registrado y contabilizado correctamente.")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error al registrar el pago")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-emerald-500" />
                        Pago Masivo de Dividendos
                    </DialogTitle>
                    <DialogDescription>
                        Liquidar los pasivos de Dividendos por Pagar asociados al ejercicio {resolution.fiscal_year}.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-4 space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex flex-col items-center justify-center">
                        <span className="text-xs uppercase font-bold text-emerald-800 opacity-80">Total a Pagar ({pendingLines.length} socios)</span>
                        <span className="text-3xl font-mono font-bold text-emerald-600 my-1">{formatCurrency(totalPending)}</span>
                    </div>

                    <div className="grid gap-2">
                        <Label>Cuenta de Tesorería (Origen del Pago)</Label>
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
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Al confirmar, se descontará de esta cuenta y se cancelará el pasivo contable, dejando registro de pago formal para cada socio.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading || totalPending <= 0} className="bg-emerald-600 hover:bg-emerald-700">
                        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Banknote className="h-4 w-4 mr-2" />
                        Confirmar Pago
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
