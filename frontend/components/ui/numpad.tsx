"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Delete, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface NumpadProps {
    value: string
    onChange: (value: string) => void
    onConfirm?: () => void
    onClose?: () => void
    className?: string
    allowDecimal?: boolean
}

export function Numpad({
    value,
    onChange,
    onConfirm,
    onClose,
    className,
    allowDecimal = true
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

    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", allowDecimal ? "." : ""]

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
    }, [value, allowDecimal, onConfirm, onClose]) // Dependencies to ensure handlers have latest state/props

    return (
        <div className={cn("grid grid-cols-3 gap-2 p-2 bg-background border rounded-xl shadow-xl w-full max-w-[280px]", className)}>
            <div className="col-span-3 flex justify-between items-center mb-1">
                <div className="text-2xl font-black tracking-tight text-primary truncate px-2">
                    {value}
                </div>
                {onClose && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {keys.map((key, idx) => (
                key !== "" ? (
                    <Button
                        key={key}
                        variant="outline"
                        className="h-14 text-xl font-bold active:scale-95 transition-transform"
                        onClick={() => handleNumber(key)}
                    >
                        {key}
                    </Button>
                ) : (allowDecimal || idx !== 10) ? <div key={`empty-${idx}`} /> : null
            ))}

            <Button
                variant="outline"
                className="h-14 text-orange-600 font-bold active:scale-95 transition-transform"
                onClick={handleDelete}
            >
                <Delete className="h-6 w-6" />
            </Button>

            <Button
                variant="destructive"
                className="h-14 font-bold col-span-1 active:scale-95 transition-transform"
                onClick={handleClear}
            >
                C
            </Button>

            {onConfirm && (
                <Button
                    className="h-14 font-bold col-span-2 text-lg active:scale-95 transition-transform"
                    onClick={onConfirm}
                >
                    OK
                </Button>
            )}
        </div>
    )
}
