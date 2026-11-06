"use client"

import { useRouter } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { MoneyDisplay } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { formatDateWith } from "@/lib/utils"
import type { BankOverviewMaturityItem } from "../hooks/useBankOverview"

export type MaturityItem = BankOverviewMaturityItem & { bankId: number; bankName?: string }

export const TYPE_LABEL: Record<string, string> = {
    LOAN_INSTALLMENT: "Préstamo bancario",
    CHECK: "Cheque",
    CARD_STATEMENT: "Estado de tarjeta",
}

const TYPE_HREF: Record<string, (bankId: number, entityId: number) => string> = {
    LOAN_INSTALLMENT: (b, id) => `/treasury/bank-center/${b}/loans?selected=${id}`,
    CHECK: (b, id) => `/treasury/bank-center/${b}/checks?selected=${id}`,
    CARD_STATEMENT: (b, id) => `/treasury/bank-center/${b}/cards/statements?selected=${id}`,
}

export function DateBadge({ dateStr }: { dateStr: string }) {
    const day = formatDateWith(dateStr, { day: "2-digit" })
    const month = formatDateWith(dateStr, { month: "short" }).replace(".", "").toUpperCase()

    return (
        <div className="flex flex-col items-center justify-center w-10 shrink-0 rounded-sm bg-muted/60 py-1.5">
            <span className="text-sm font-black leading-none tabular-nums">{day}</span>
            <span className="text-3xs font-medium text-muted-foreground leading-none mt-0.5">{month}</span>
        </div>
    )
}

interface BankUpcomingMaturitiesPanelProps {
    maturities: MaturityItem[]
    globalBankId?: number
    maxItems?: number
}

export function BankUpcomingMaturitiesPanel({ maturities, globalBankId, maxItems = 10 }: BankUpcomingMaturitiesPanelProps) {
    const router = useRouter()

    if (!maturities || maturities.length === 0) {
        return (
            <section className="surface-panel rounded-sm p-4 flex flex-col gap-3">
                <span className="text-sm font-semibold tracking-tight">Próximos vencimientos</span>
                <p className="text-xs text-muted-foreground">Sin vencimientos próximos</p>
            </section>
        )
    }

    const totalAmount = maturities.reduce((s, m) => s + m.amount, 0)
    const displayItems = maturities.slice(0, maxItems)
    const remaining = maturities.length - maxItems

    const presentTypes = [...new Set(maturities.map((m) => TYPE_LABEL[m.type] ?? m.type))]
    const typesLegend = presentTypes.join(", ")

    const nextDate = maturities[0]?.due_date
        ? formatDateWith(maturities[0].due_date, {
              day: "numeric",
              month: "long",
          })
        : null

    return (
        <section className="surface-panel rounded-sm p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold tracking-tight">Próximos vencimientos</span>
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                            {maturities.length}
                        </span>
                    </div>
                    {nextDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {maturities.length} compromiso{maturities.length !== 1 ? "s" : ""} · {nextDate}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <MoneyDisplay amount={totalAmount} className="text-xs font-medium tabular-nums" />
                    {globalBankId != null && (
                        <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={() => router.push(`/treasury/bank-center/${globalBankId}/movements`)}
                            className="h-auto p-0 text-3xs font-medium gap-0.5"
                        >
                            Ver todos <ArrowUpRight className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-1.5">
                {displayItems.map((item, idx) => {
                    const href = TYPE_HREF[item.type]?.(item.bankId, item.entity_id)
                    const sublabel = [item.bankName, TYPE_LABEL[item.type] ?? item.type].filter(Boolean).join(" · ")

                    return (
                        <Button
                            key={`${item.type}-${item.entity_id}-${idx}`}
                            type="button"
                            variant="ghost"
                            onClick={() => href && router.push(href)}
                            disabled={!href}
                            className="w-full h-auto flex items-center justify-start gap-2.5 rounded-sm px-1 py-1 hover:bg-muted/30 transition-colors focus-visible:ring-1 focus-visible:ring-primary/40 text-left whitespace-normal disabled:cursor-default disabled:opacity-100"
                        >
                            <DateBadge dateStr={item.due_date} />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate leading-tight">{item.label}</p>
                                <p className="text-2xs text-muted-foreground truncate mt-0.5">{sublabel}</p>
                            </div>
                            <MoneyDisplay amount={item.amount} showColor={false} className="text-xs font-semibold tabular-nums shrink-0" />
                        </Button>
                    )
                })}
            </div>

            <div className="mt-auto space-y-1">
                {remaining > 0 && (
                    <p className="text-3xs text-muted-foreground px-1">y {remaining} más</p>
                )}
                {typesLegend && (
                    <p className="text-2xs text-muted-foreground px-1 pt-1 border-t border-border/60">
                        {typesLegend}
                    </p>
                )}
            </div>
        </section>
    )
}
