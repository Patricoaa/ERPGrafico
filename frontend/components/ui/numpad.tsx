"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Delete } from "lucide-react"
import { cn } from "@/lib/utils"

interface NumpadProps {
    value: string
    onChange: (value: string) => void
    onConfirm?: () => void
    onClose?: () => void
    className?: string
    allowDecimal?: boolean
    hideDisplay?: boolean
    confirmLabel?: string
    onExactAmount?: () => void
    exactAmountLabel?: string
}

export function Numpad({
    value,
    onChange,
    onConfirm,
    onClose,
    className,
    allowDecimal = true,
    hideDisplay = false,
    confirmLabel = "OK",
    onExactAmount,
    exactAmountLabel
}: NumpadProps) {
    const handleNumber = (n: string) => {
        if (n === "." && value.includes(".")) return
        if (value === "0" && n !== ".") {
            onChange(n)
        } else {
            onChange(value + n)
        }
    }

    const handleDelete = () => {
        if (value.length <= 1) {
            onChange("0")
        } else {
            onChange(value.slice(0, -1))
        }
    }

    const handleClear = () => {
        onChange("0")
    }

    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Numbers 0-9
            if (/^[0-9]$/.test(e.key)) {
                handleNumber(e.key)
            }
            // Dot/Comma if decimal allowed
            else if ((e.key === "." || e.key === ",") && allowDecimal) {
                handleNumber(".")
            }
            // Backspace
            else if (e.key === "Backspace") {
                handleDelete()
            }
            // Enter -> Confirm
            else if (e.key === "Enter" && onConfirm) {
                onConfirm()
            }
            // Escape -> Close
            else if (e.key === "Escape" && onClose) {
                onClose()
            }
            // 'c' or 'C' -> Clear
            else if (e.key.toLowerCase() === "c") {
                handleClear()
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [value, allowDecimal, onConfirm, onClose])

    return (
        <div className={cn("flex flex-col gap-2 p-2 bg-background border rounded-lg shadow-xl w-full max-w-[280px]", className)}>
            {!hideDisplay && (
                <div className="flex justify-between items-center mb-1">
                    <div className="text-2xl font-black tracking-tight text-primary truncate px-2 w-full text-right">
                        {value}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-2">
                {keys.map((key) => (
                    <Button
                        key={key}
                        variant="outline"
                        className="h-14 text-xl font-bold active:scale-95 transition-transform"
                        onClick={() => handleNumber(key)}
                    >
                        {key}
                    </Button>
                ))}

                {/* Row 4 */}
                <Button
                    variant="destructive"
                    className="h-14 text-lg font-bold active:scale-95 transition-transform bg-red-100 text-destructive hover:bg-red-200 border-red-200"
                    onClick={handleClear}
                >
                    C
                </Button>

                <Button
                    variant="outline"
                    className="h-14 text-xl font-bold active:scale-95 transition-transform"
                    onClick={() => handleNumber("0")}
                >
                    0
                </Button>

                {allowDecimal ? (
                    <Button
                        variant="outline"
                        className="h-14 text-xl font-bold active:scale-95 transition-transform"
                        onClick={() => handleNumber(".")}
                    >
                        .
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        className="h-14 text-amber-700 font-bold active:scale-95 transition-transform"
                        onClick={handleDelete}
                    >
                        <Delete className="h-6 w-6" />
                    </Button>
                )}
            </div>

            {onExactAmount && (
                <Button
                    variant="outline"
                    className="w-full h-12 font-bold text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-emerald-200 mb-2"
                    onClick={onExactAmount}
                >
                    {exactAmountLabel || "MONTO EXACTO"}
                </Button>
            )}

            {onConfirm && (
                <Button
                    className="w-full h-14 font-black uppercase tracking-widest text-lg bg-primary hover:bg-primary mt-2"
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </Button>
            )}
        </div>
    )
}
