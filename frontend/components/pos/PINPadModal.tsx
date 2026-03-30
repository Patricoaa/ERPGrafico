"use client"

import React, { useState } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Numpad } from "@/components/ui/numpad"
import { ShieldCheck } from "lucide-react"

interface PINPadModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (pin: string) => void
    title?: string
    description?: string
}

export function PINPadModal({
    open,
    onOpenChange,
    onConfirm,
    title = "Firma de Transacción",
    description = "Ingrese su PIN para autorizar esta venta"
}: PINPadModalProps) {
    const [pin, setPin] = useState("")

    const handleConfirm = () => {
        if (pin.length > 0) {
            onConfirm(pin)
            setPin("")
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <span className="font-bold">{title}</span>
                </div>
            }
            description={description}
            size="sm"
        >
            <div className="flex flex-col items-center gap-6 py-6 font-primary">
                {/* Visual PIN Feedback */}
                <div className="flex gap-6 justify-center mb-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div 
                            key={i} 
                            className={`w-5 h-5 rounded-full border-2 transition-all duration-300 shadow-sm ${
                                pin.length > i 
                                    ? "bg-primary border-primary scale-125 shadow-primary/20" 
                                    : "bg-muted border-muted-foreground/10"
                            }`} 
                        />
                    ))}
                </div>

                <Numpad
                    value={pin}
                    onChange={(val) => {
                        if (val.length <= 4) setPin(val)
                    }}
                    onConfirm={handleConfirm}
                    onClose={() => onOpenChange(false)}
                    allowDecimal={false}
                    hideDisplay={true}
                    confirmLabel="AUTORIZAR PAGO"
                    className="border-none shadow-none p-0 w-full max-w-none bg-transparent"
                />
                
                <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest font-medium opacity-60">
                    El uso de su PIN equivale a una firma electrónica de responsabilidad
                </p>
            </div>
        </BaseModal>
    )
}
