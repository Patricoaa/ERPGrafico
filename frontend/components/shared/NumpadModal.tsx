"use client"

import { formatCurrency } from "@/lib/money"

import React from "react"

import { Button } from "@/components/ui/button"
import { BaseModal } from "./BaseModal"
import { Numpad } from "./Numpad"

interface NumpadModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    value: string
    onChange: (value: string) => void
    onConfirm: () => void
    title: string
    description?: string
    icon?: React.ComponentType<{ className?: string }> | React.ReactNode
    allowDecimal?: boolean
    maxValue?: number
    netValue?: string | number
    /**
     * Controla cómo se formatea el valor en el display superior del numpad.
     * - `"currency"` (default): muestra el valor formateado como moneda (ej. $1.000).
     * - `"number"`: muestra el valor como número plano, sin símbolo de moneda (ej. folio, cantidad).
     */
    mode?: "currency" | "number"
}

export function NumpadModal({
    open,
    onOpenChange,
    value,
    onChange,
    onConfirm,
    title,
    description,
    icon,
    allowDecimal = true,
    maxValue,
    netValue,
    mode = "currency",
}: NumpadModalProps) {
    const displayValue = mode === "currency"
        ? formatCurrency(parseFloat(value) || 0)
        : (value || "0")
    return (
        <BaseModal
            asDialog
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description={description}
            icon={icon}
            size="sm"
            headerClassName="border-b-0"
            footerClassName="border-t-0"
            centered
            footer={
                <Button
                    className="w-full h-12 lg:h-14 bg-primary hover:bg-primary font-black uppercase tracking-widest text-sm lg:text-base active:scale-95 transition-transform"
                    onClick={onConfirm}
                >
                    CONFIRMAR
                </Button>
            }
        >
            <div className="flex flex-col items-center gap-2">
                {(maxValue !== undefined && maxValue !== Infinity) && (
                    <div className="lg:text-xs text-3xs font-bold text-warning uppercase tracking-wider mb-1">
                        Máximo permitido: {maxValue} unidades
                    </div>
                )}
                {netValue !== undefined && (
                    <div className="lg:text-xs text-3xs font-bold text-primary uppercase tracking-wider mb-1">
                        Valor Neto: {typeof netValue === 'number' ? formatCurrency(netValue) : netValue}
                    </div>
                )}
                <Numpad
                    value={value}
                    onChange={onChange}
                    onConfirm={onConfirm}
                    onClose={() => onOpenChange(false)}
                    allowDecimal={allowDecimal}
                    hideConfirm
                    displayValue={displayValue}
                    className="border-none shadow-none p-0 w-full max-w-none"
                />
            </div>
        </BaseModal>
    )
}