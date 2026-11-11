"use client"

import type { ReactNode } from "react"
import { differenceInMinutes, parseISO } from "date-fns"
import { formatCurrency } from "@/lib/money"
import { formatDateWith, formatTimeWith } from "@/lib/utils"

export type SessionTab = "summary" | "sales" | "cash" | "closing" | "activity" | "relations"

/** Importe tabular; `isExpense` lo muestra negativo y en tono destructivo. */
export function AmountCell({ value, bold, isExpense, signed }: { value: number | string; bold?: boolean; isExpense?: boolean; signed?: boolean }) {
    const amount = Number(value)
    const negative = (isExpense && amount > 0) || amount < 0
    const text = isExpense && amount > 0 ? `-${formatCurrency(amount)}` : signed && amount > 0 ? `+${formatCurrency(amount)}` : formatCurrency(amount)
    return <span className={`tabular-nums ${bold ? "font-bold" : ""} ${negative ? "text-destructive" : ""}`}>{text}</span>
}

/** «dd/mm/aaaa HH:mm». La zona horaria de la sesión se muestra aparte (`overview.timezone`). */
export function dateTime(value: string): string {
    const date = formatDateWith(value, { day: "2-digit", month: "2-digit", year: "numeric" })
    const time = formatTimeWith(value, { hour: "2-digit", minute: "2-digit", hour12: false })
    return `${date} ${time}`
}

/** Hito de la sesión: responsable y hora. */
export function MilestoneCell({ who, at, empty }: { who: string | null | undefined; at: string | null | undefined; empty?: ReactNode }) {
    if (!at) return <>{empty ?? null}</>
    return (
        <span className="flex flex-col">
            <span>{who || "—"}</span>
            <span className="tabular-nums text-muted-foreground">{dateTime(at)}</span>
        </span>
    )
}

export function formatDuration(from: string, to: string | null): string {
    const end = to ? parseISO(to) : new Date()
    const minutes = Math.max(0, differenceInMinutes(end, parseISO(from)))
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`
}

export const GRID_LEFT = "w-auto justify-start text-left"
