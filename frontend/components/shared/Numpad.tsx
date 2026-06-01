"use client"

import { useEffect } from "react"
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
    hideConfirm?: boolean
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
    hideConfirm = false,
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
        <div className={cn("flex flex-col gap-2 p-1.5 bg-background border rounded-lg shadow-[var(--shadow-overlay)] w-full max-w-[260px] lg:max-w-[280px]", className)}>
            {!hideDisplay && (
                <div className="flex justify-between items-center mb-1">
                    <div className="lg:text-xl text-base font-black tracking-tight text-primary truncate px-2 w-full text-right">
                        {value}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 lg:gap-1.5 gap-1">
                {keys.map((key) => (
                    <Button
                        key={key}
                        variant="outline"
                        className="h-9 lg:h-11 text-xs lg:text-sm font-bold active:scale-95 transition-transform"
                        onClick={() => handleNumber(key)}
                    >
                        {key}
                    </Button>
                ))}

                {/* Row 4 */}
                <Button
                    variant="destructive"
                    className="h-9 lg:h-11 text-xs lg:text-sm font-bold active:scale-95 transition-transform bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20"
                    onClick={handleClear}
                >
                    C
                </Button>

                <Button
                    variant="outline"
                    className="h-9 lg:h-11 text-xs lg:text-sm font-bold active:scale-95 transition-transform"
                    onClick={() => handleNumber("0")}
                >
                    0
                </Button>

                {allowDecimal ? (
                    <Button
                        variant="outline"
                        className="h-9 lg:h-11 text-xs lg:text-sm font-bold active:scale-95 transition-transform"
                        onClick={() => handleNumber(".")}
                    >
                        .
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        className="h-9 lg:h-11 text-warning font-bold active:scale-95 transition-transform"
                        onClick={handleDelete}
                    >
                        <Delete className="lg:h-4 lg:w-4 h-3.5 w-3.5" />
                    </Button>
                )}
            </div>

            {onExactAmount && (
                <Button
                    variant="outline"
                    className="w-full lg:h-11 h-9 font-bold lg:text-sm text-xs bg-success/10 text-success hover:bg-success/20 hover:text-success border-success/20"
                    onClick={onExactAmount}
                >
                    {exactAmountLabel || "MONTO EXACTO"}
                </Button>
            )}

            {onConfirm && !hideConfirm && (
                <Button
                    className="w-full lg:h-11 h-9 font-black uppercase tracking-widest lg:text-sm text-[11px] bg-primary hover:bg-primary"
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </Button>
            )}
        </div>
    )
}
