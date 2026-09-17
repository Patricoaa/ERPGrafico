"use client"

import { ArrowDownRight, ArrowUpRight, Calculator, Scale } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { MoneyDisplay } from "@/components/shared"

type LedgerAmount = number | string | null | undefined

export interface LedgerSummaryPanelProps {
    openingBalance?: LedgerAmount
    periodDebit?: LedgerAmount
    periodCredit?: LedgerAmount
    closingBalance?: LedgerAmount
    fromDate?: Date
    toDate?: Date
}

const dateLabel = (date: Date | undefined) =>
    date ? `Al ${format(date, 'dd/MM/yy', { locale: es })}` : 'Al -'

/**
 * Ledger ink metaphor — CMYK carve-out (ADR-0071, color-system.md §4.6/§8).
 *
 * Cargos/Debe = Process Cyan, Abonos/Haber = Process Magenta, Saldo Final = Process Yellow.
 * The ink is carried by border + tinted background + icon (plus the label text); the
 * small label text stays `text-foreground` because the fixed inks fail WCAG 2.1 SC 1.4.3
 * as text on light surfaces (cyan 2.5:1, yellow 1.2:1). Saldo Inicial is neutral, not "K".
 * Cue icons (ArrowUpRight / ArrowDownRight / Scale) carry the meaning non-chromatically.
 */
export function LedgerSummaryPanel({
    openingBalance,
    periodDebit,
    periodCredit,
    closingBalance,
    fromDate,
    toDate,
}: LedgerSummaryPanelProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
            {/* Neutral — Saldo Inicial (opening balance) */}
            <div className="rounded-md border border-foreground/20 bg-foreground/5 px-3 py-2.5 flex items-start gap-2.5">
                <div className="rounded-sm bg-foreground/10 p-1.5 shrink-0">
                    <Calculator className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-3xs font-semibold uppercase tracking-widest text-foreground/80">Saldo Inicial</p>
                    <p className="text-sm font-bold text-foreground font-mono truncate">
                        <MoneyDisplay amount={openingBalance} showColor={false} />
                    </p>
                    <p className="text-3xs text-muted-foreground mt-0.5">{dateLabel(fromDate)}</p>
                </div>
            </div>

            {/* Process Cyan — Cargos (Debe) */}
            <div className="rounded-md border border-cyan/30 bg-cyan/10 px-3 py-2.5 flex items-start gap-2.5">
                <div className="rounded-sm bg-cyan/20 p-1.5 shrink-0">
                    <ArrowUpRight className="h-3.5 w-3.5 text-cyan" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-3xs font-semibold uppercase tracking-widest text-foreground">Cargos (Debe)</p>
                    <p className="text-sm font-bold text-foreground font-mono truncate">
                        <MoneyDisplay amount={periodDebit} showColor={false} />
                    </p>
                    <p className="text-3xs text-muted-foreground mt-0.5">Total del periodo</p>
                </div>
            </div>

            {/* Process Magenta — Abonos (Haber) */}
            <div className="rounded-md border border-magenta/30 bg-magenta/10 px-3 py-2.5 flex items-start gap-2.5">
                <div className="rounded-sm bg-magenta/20 p-1.5 shrink-0">
                    <ArrowDownRight className="h-3.5 w-3.5 text-magenta" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-3xs font-semibold uppercase tracking-widest text-foreground">Abonos (Haber)</p>
                    <p className="text-sm font-bold text-foreground font-mono truncate">
                        <MoneyDisplay amount={periodCredit} showColor={false} />
                    </p>
                    <p className="text-3xs text-muted-foreground mt-0.5">Total del periodo</p>
                </div>
            </div>

            {/* Process Yellow — Saldo Final */}
            <div className="rounded-md border border-yellow/40 bg-yellow/10 px-3 py-2.5 flex items-start gap-2.5">
                <div className="rounded-sm bg-yellow/20 p-1.5 shrink-0">
                    <Scale className="h-3.5 w-3.5 text-yellow" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <p className="text-3xs font-semibold uppercase tracking-widest text-foreground">Saldo Final</p>
                    <p className="text-sm font-bold text-foreground font-mono truncate">
                        <MoneyDisplay amount={closingBalance} showColor={false} />
                    </p>
                    <p className="text-3xs text-muted-foreground mt-0.5">{dateLabel(toDate)}</p>
                </div>
            </div>
        </div>
    )
}
