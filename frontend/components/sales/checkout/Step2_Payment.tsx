"use client"

import { Label } from "@/components/ui/label"
import { Wallet } from "lucide-react"
import { PaymentMethodSelector, PaymentMethodValue } from "@/components/shared/PaymentMethodSelector"

import { useState } from "react"
import { Numpad } from "@/components/ui/numpad"
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"


interface Step2_PaymentProps {
    paymentData: any
    setPaymentData: (data: any) => void
    total: number
    terminalId?: number
}

export function Step2_Payment({ paymentData, setPaymentData, terminalId }: Step2_PaymentProps) {
    const [isAmountModalOpen, setIsAmountModalOpen] = useState(false)
    const [tempAmount, setTempAmount] = useState("")

    // New handler for shared selector
    const onMethodChange = (val: PaymentMethodValue) => {
        const newMethod = val.methodType // 'CASH', 'CARD', etc.
        const isReClick = paymentData.method === newMethod

        setPaymentData({
            ...paymentData,
            method: newMethod,
            payment_method_id: val.paymentMethodId, // Store specific method ID
            treasury_account_id: val.treasuryAccountId
        })

        if (!isReClick) {
            setTempAmount((paymentData.amount || 0).toString())
            setIsAmountModalOpen(true)
        }
    }

    const handleAmountConfirm = () => {
        const parsed = parseFloat(tempAmount)
        const finalAmount = parsed || 0
        setPaymentData({
            ...paymentData,
            amount: finalAmount
        })
        setIsAmountModalOpen(false)
    }

    const openAmountModal = () => {
        setTempAmount((paymentData.amount || 0).toString())
        setIsAmountModalOpen(true)
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Payment Methods */}
                <div className="space-y-4">
                    <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Método de Pago
                    </Label>

                    <PaymentMethodSelector
                        value={{
                            methodType: paymentData.method as any,
                            paymentMethodId: paymentData.payment_method_id,
                            treasuryAccountId: paymentData.treasury_account_id
                        }}
                        onChange={onMethodChange}
                        operation="sales"
                        terminalId={terminalId}
                    />

                    {/* Amount Display / Trigger */}
                    <div className="pt-4">
                        <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Monto a Pagar
                        </Label>
                        <div
                            onClick={openAmountModal}
                            className="mt-2 p-6 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                        >
                            <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors">Total a cobrar</span>
                            <span className="text-4xl font-bold font-mono text-primary">
                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(paymentData.amount || 0)}
                            </span>
                            <span className="text-xs text-muted-foreground bg-white px-2 py-1 rounded-full border shadow-sm">
                                Click para modificar
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right: Numpad Placeholder / Summary */}
                <div className="bg-muted/30 p-6 rounded-2xl border flex flex-col items-center justify-center text-center space-y-4">
                    <div className="text-center text-muted-foreground">
                        <Wallet className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">Seleccione un método de pago<br />y confirme el monto.</p>
                        <p className="text-xs opacity-70 mt-2">El vuelto se calculará automáticamente.</p>
                    </div>
                </div>
            </div>

            {/* Amount Modal */}
            <Dialog open={isAmountModalOpen} onOpenChange={setIsAmountModalOpen}>
                <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-background">
                    <div className="p-4 bg-muted/30 border-b flex justify-between items-center">
                        <span className="font-semibold text-sm">Ingresar Monto</span>
                        <span className="font-mono text-xl font-bold text-primary">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(parseFloat(tempAmount) || 0)}
                        </span>
                    </div>
                    <div className="p-4">
                        <Numpad
                            value={tempAmount}
                            onChange={(val) => setTempAmount(val)}
                            onConfirm={handleAmountConfirm}
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
