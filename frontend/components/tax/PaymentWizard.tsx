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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
    CreditCard,
    DollarSign,
    Calendar,
    CheckCircle2,
    ArrowRight
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

interface PaymentWizardProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    declaration: any
    onSuccess: () => void
}

export function PaymentWizard({ isOpen, onOpenChange, declaration, onSuccess }: PaymentWizardProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [treasuryAccounts, setTreasuryAccounts] = useState<any[]>([])
    const [formData, setFormData] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        amount: 0,
        payment_method: 'TRANSFER',
        reference: '',
        treasury_account: '',
        notes: ''
    })

    useEffect(() => {
        if (declaration) {
            setFormData(prev => ({ ...prev, amount: Number(declaration.vat_to_pay) }))
        }
        fetchTreasuryAccounts()
    }, [declaration])

    const fetchTreasuryAccounts = async () => {
        try {
            const response = await api.get("/treasury/accounts/")
            setTreasuryAccounts(response.data.results || response.data)
        } catch (error) {
            console.error("Error fetching treasury accounts:", error)
        }
    }

    const handleSave = async () => {
        if (!formData.treasury_account) {
            toast.error("Debe seleccionar una cuenta de origen")
            return
        }

        setIsLoading(true)
        try {
            await api.post("/tax/payments/", {
                declaration: declaration.id,
                ...formData
            })

            toast.success("Pago de impuestos registrado correctamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error saving payment:", error)
            toast.error(error.response?.data?.error || "Error al registrar el pago")
        } finally {
            setIsLoading(false)
        }
    }

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val || 0)

    if (!declaration) return null

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest">Tesorería</Badge>
                    </div>
                    <DialogTitle className="text-xl font-bold">Registrar Pago F29</DialogTitle>
                    <DialogDescription>
                        {declaration.tax_period_display}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="p-4 bg-muted/50 rounded-2xl border border-border/50">
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-muted-foreground">Monto Pendiente</span>
                            <span className="font-bold text-lg">{formatCurrency(declaration.vat_to_pay)}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="pay_date">Fecha de Pago</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="pay_date"
                                    type="date"
                                    className="pl-9 rounded-xl"
                                    value={formData.payment_date}
                                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="account">Cuenta de Origen</Label>
                            <Select 
                                value={formData.treasury_account} 
                                onValueChange={(val) => setFormData({ ...formData, treasury_account: val })}
                            >
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Seleccione una cuenta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {treasuryAccounts.map((acc) => (
                                        <SelectItem key={acc.id} value={acc.id.toString()}>
                                            {acc.name} ({formatCurrency(acc.balance)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="method">Método de Pago</Label>
                            <Select 
                                value={formData.payment_method} 
                                onValueChange={(val) => setFormData({ ...formData, payment_method: val })}
                            >
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                    <SelectItem value="CHECK">Cheque</SelectItem>
                                    <SelectItem value="CASH">Efectivo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="ref">Referencia / comprobante</Label>
                            <Input
                                id="ref"
                                placeholder="Ej: Transf. 123456"
                                className="rounded-xl"
                                value={formData.reference}
                                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="rounded-xl px-8 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20"
                    >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirmar Pago
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
