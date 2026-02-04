"use client"

import React from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Numpad } from "@/components/ui/numpad"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"

interface NumpadModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    value: string
    onChange: (value: string) => void
    onConfirm: () => void
    title: string
    description?: string
    allowDecimal?: boolean
    maxValue?: number
    netValue?: string | number
}

export function NumpadModal({
    open,
    onOpenChange,
    value,
    onChange,
    onConfirm,
    title,
    description,
    allowDecimal = true,
    maxValue,
    netValue
}: NumpadModalProps) {
    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description={description}
            size="sm"
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={onConfirm}>
                        Confirmar
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col items-center gap-2 py-4">
                {(maxValue !== undefined && maxValue !== Infinity) && (
                    <div className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">
                        Máximo permitido: {maxValue} unidades
                    </div>
                )}
                {netValue !== undefined && (
                    <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                        Valor Neto: {typeof netValue === 'number' ? formatCurrency(netValue) : netValue}
                    </div>
                )}
                <Numpad
                    value={value}
                    onChange={onChange}
                    onConfirm={onConfirm}
                    onClose={() => onOpenChange(false)}
                    allowDecimal={allowDecimal}
                    className="border-none shadow-none p-0"
                />
            </div>
        </BaseModal>
    )
}
