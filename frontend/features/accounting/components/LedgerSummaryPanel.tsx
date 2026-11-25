"use client"

import { ArrowDownRight, ArrowUpRight, Calculator, Scale } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Metric, MetricStrip, MoneyDisplay } from "@/components/shared"

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
 * Resumen de Libro Mayor (ADR-0149, MetricStrip).
 *
 * Muestra Saldo Inicial, Cargos (Debe), Abonos (Haber) y Saldo Final
 * con sus iconos guía respectivos (Calculator, ArrowUpRight, ArrowDownRight, Scale).
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
        <MetricStrip label="Resumen de Libro Mayor" className="shrink-0">
            <Metric
                label="Saldo Inicial"
                lead={Calculator}
                value={<MoneyDisplay amount={openingBalance} showColor={false} />}
                context={dateLabel(fromDate)}
            />
            <Metric
                label="Cargos (Debe)"
                lead={ArrowUpRight}
                value={<MoneyDisplay amount={periodDebit} showColor={false} />}
                context="Total del periodo"
            />
            <Metric
                label="Abonos (Haber)"
                lead={ArrowDownRight}
                value={<MoneyDisplay amount={periodCredit} showColor={false} />}
                context="Total del periodo"
            />
            <Metric
                label="Saldo Final"
                lead={Scale}
                value={<MoneyDisplay amount={closingBalance} showColor={false} />}
                context={dateLabel(toDate)}
            />
        </MetricStrip>
    )
}
