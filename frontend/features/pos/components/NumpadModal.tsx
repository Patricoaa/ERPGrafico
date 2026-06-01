"use client"

import { formatCurrency } from "@/lib/money"

import React from "react"

import { Button } from "@/components/ui/button"
import { BaseModal, Numpad } from '@/components/shared'

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
                <Button
                    className="w-full bg-primary hover:bg-primary font-black uppercase tracking-widest text-xs lg:text-base"
                    onClick={onConfirm}
                >
                    CONFIRMAR
                </Button>
            }
        >
            <div className="flex flex-col items-center gap-2">
                {(maxValue !== undefined && maxValue !== Infinity) && (
                    <div className="lg:text-xs text-[10px] font-bold text-warning uppercase tracking-wider mb-1">
                        Máximo permitido: {maxValue} unidades
                    </div>
                )}
                {netValue !== undefined && (
                    <div className="lg:text-xs text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
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
                    className="border-none shadow-none p-0 w-full max-w-none"
                />
            </div>
        </BaseModal>
    )
}
