"use client"

import { Label } from "@/components/ui/label"
import { PaymentMethodSelector, PaymentMethodValue } from "@/components/shared/PaymentMethodSelector"

import { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Numpad } from "@/components/ui/numpad"


interface Step3_PurchasePaymentProps {
    paymentData: any
    setPaymentData: (data: any) => void
    total: number
}

export function Step3_PurchasePayment({ paymentData, setPaymentData, total }: Step3_PurchasePaymentProps) {
    // Determine context for accounts (General purchase usually implies general accounts unless specified otherwise)
    // Removed useOrdersAccounts here as selector handles it or we rely on defaults.

    // Initialize amount to total if not set
    useEffect(() => {
        if (paymentData.amount === undefined || paymentData.amount === null) {
            setPaymentData({ ...paymentData, amount: total })
        }
    }, [total]) // eslint-disable-line react-hooks/exhaustive-deps

    const onMethodChange = (val: PaymentMethodValue) => {
        setPaymentData({
            ...paymentData,
            method: val.methodType,
            payment_method_id: val.paymentMethodId,
            treasury_account_id: val.treasuryAccountId
        })
    }

    const handleAmountChange = (val: string) => {
        setPaymentData({ ...paymentData, amount: parseFloat(val) || 0 })
    }

    // Business Logic: No change for cash purchases
    const change = (paymentData.amount || 0) - total
    const showChange = change > 0 && paymentData.method !== 'CASH'

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Payment Method & Details */}
                <div className="space-y-6">
                    <div className="space-y-2">
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
                            operation="purchases"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Monto a Pagar
                        </Label>
                        <div className="bg-muted/30 p-4 rounded-xl border flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Total Documento</span>
                            <span className="font-mono text-xl font-bold">
                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(total)}
                            </span>
                        </div>

                        <div className="bg-primary/5 p-4 rounded-xl border-2 border-primary/20 flex justify-between items-center">
                            <span className="text-sm font-semibold text-primary">Monto a Pagar</span>
                            <span className="font-mono text-2xl font-bold text-primary">
                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(paymentData.amount || 0)}
                            </span>
                        </div>

                        {showChange && (
                            <div className="bg-green-50 p-3 rounded-xl border border-green-200 flex justify-between items-center animate-in slide-in-from-top-1">
                                <span className="text-xs font-bold text-green-700 uppercase">Vuelto / Excedente</span>
                                <span className="font-mono text-lg font-bold text-green-700">
                                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(change)}
                                </span>
                            </div>
                        )}

                        {/* Warning if paying less? */}
                        {(paymentData.amount || 0) < total && (paymentData.amount || 0) > 0 && (
                            <div className="text-xs text-amber-600 font-medium text-right">
                                Pendiente: {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(total - (paymentData.amount || 0))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Numpad */}
                <div className="h-full">
                    <Card className="h-full border-0 shadow-none bg-transparent">
                        <CardContent className="p-0 h-full">
                            <Numpad
                                value={paymentData.amount?.toString() || "0"}
                                onChange={handleAmountChange}
                                onConfirm={() => { }}
                                className="w-full h-full min-h-[400px]"
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
