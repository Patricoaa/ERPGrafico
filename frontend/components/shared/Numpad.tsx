"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Delete } from "lucide-react"
import { cn } from "@/lib/utils"

export interface QuickAmount {
    label: string
    value: number
    action?: 'set' | 'add'
}

interface NumpadProps {
    value: string
    onChange: (value: string) => void
    onConfirm?: () => void
    onClose?: () => void
    className?: string
    allowDecimal?: boolean
    hideDisplay?: boolean
    hideConfirm?: boolean
    confirmLabel?: string
    onExactAmount?: () => void
    exactAmountLabel?: string
    quickAmounts?: QuickAmount[]
    onQuickAmountAction?: (qa: QuickAmount) => void
    label?: string
    displayValue?: string
}

export function Numpad({
    value,
    onChange,
    onConfirm,
    onClose,
    className,
    allowDecimal = true,
    hideDisplay = false,
    hideConfirm = false,
    confirmLabel = "OK",
    onExactAmount,
    exactAmountLabel,
    quickAmounts,
    onQuickAmountAction,
    label,
    displayValue
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

    const handleQuickAmount = (qa: QuickAmount) => {
        if (qa.action === 'add') {
            const current = parseFloat(value) || 0
            onChange((current + qa.value).toString())
        } else {
            onChange(qa.value.toString())
        }
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
        <div className={cn("flex flex-col gap-2 p-1.5 bg-background border rounded-lg shadow-[var(--shadow-overlay)] w-full", className)}>
            {displayValue ? (
                <div className="text-center mb-2">
                    {label && <div className="text-xs font-bold uppercase text-muted-foreground">{label}</div>}
                    <div className="text-3xl font-black font-mono tracking-tight text-primary">
                        {displayValue}
                    </div>
                </div>
            ) : !hideDisplay && (
                <div className="flex justify-between items-center mb-1">
                    <div className="lg:text-xl text-base font-black tracking-tight text-primary truncate px-2 w-full text-center">
                        {value}
                    </div>
                </div>
            )}

            {quickAmounts && quickAmounts.length > 0 && (
                <div className="grid grid-cols-3 lg:gap-1.5 gap-1">
                    {quickAmounts.map((qa) => (
                        <Button
                            key={qa.label}
                            variant="outline"
                            className="h-10 lg:h-12 text-xs lg:text-sm font-bold active:scale-95 transition-transform"
                            onClick={() => {
                                if (onQuickAmountAction) {
                                    onQuickAmountAction(qa)
                                } else {
                                    handleQuickAmount(qa)
                                }
                            }}
                        >
                            {qa.label}
                        </Button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-3 lg:gap-1.5 gap-1">
                {keys.map((key) => (
                    <Button
                        key={key}
                        variant="outline"
                        className="h-12 lg:h-14 text-sm lg:text-base font-bold active:scale-95 transition-transform"
                        onClick={() => handleNumber(key)}
                    >
                        {key}
                    </Button>
                ))}

                {/* Row 4 */}
                <Button
                    variant="destructive"
                    className="h-12 lg:h-14 text-sm lg:text-base font-bold active:scale-95 transition-transform bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
                    onClick={handleClear}
                >
                    C
                </Button>

                <Button
                    variant="outline"
                    className="h-12 lg:h-14 text-sm lg:text-base font-bold active:scale-95 transition-transform"
                    onClick={() => handleNumber("0")}
                >
                    0
                </Button>

                {allowDecimal ? (
                    <Button
                        variant="outline"
                        className="h-12 lg:h-14 text-sm lg:text-base font-bold active:scale-95 transition-transform"
                        onClick={() => handleNumber(".")}
                    >
                        .
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        className="h-12 lg:h-14 text-warning font-bold active:scale-95 transition-transform"
                        onClick={handleDelete}
                    >
                        <Delete className="lg:h-5 lg:w-5 h-4 w-4" />
                    </Button>
                )}
            </div>

            {onExactAmount && (
                <Button
                    variant="outline"
                    className="w-full h-12 lg:h-14 font-bold text-sm lg:text-base bg-success/10 text-success hover:bg-success/20 hover:text-success border-success/20"
                    onClick={onExactAmount}
                >
                    {exactAmountLabel || "MONTO EXACTO"}
                </Button>
            )}

            {onConfirm && !hideConfirm && (
                <Button
                    className="w-full h-12 lg:h-14 font-black uppercase tracking-widest text-sm lg:text-base bg-primary hover:bg-primary"
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </Button>
            )}
        </div>
    )
}
