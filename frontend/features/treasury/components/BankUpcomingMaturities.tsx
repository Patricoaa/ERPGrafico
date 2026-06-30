"use client"

import { useRouter } from "next/navigation"
import { HandCoins, FileCheck, CreditCard, ArrowRight, Calendar } from "lucide-react"
import { MoneyDisplay, EmptyState, SectionHeader } from "@/components/shared"
import { useServerDate } from '@/hooks/useServerDate'
import { cn, parseDateOnly } from "@/lib/utils"
import type { BankOverviewData, BankOverviewMaturityItem } from "../hooks/useBankOverview"

interface BankUpcomingMaturitiesProps {
    data: BankOverviewData
    bankId: number
}

const TYPE_CONFIG = {
    LOAN_INSTALLMENT: {
        icon: HandCoins,
        href: (bankId: number, item: BankOverviewMaturityItem) =>
            `/treasury/bank-center/${bankId}/loans?selected=${item.entity_id}`,
    },
    CHECK: {
        icon: FileCheck,
        href: (bankId: number, item: BankOverviewMaturityItem) =>
            `/treasury/bank-center/${bankId}/checks?selected=${item.entity_id}`,
    },
    CARD_STATEMENT: {
        icon: CreditCard,
        href: (bankId: number, item: BankOverviewMaturityItem) =>
            `/treasury/bank-center/${bankId}/cards/statements?selected=${item.entity_id}`,
    },
} as const

function formatTimeUntil(dateStr: string, todayDate?: Date): { label: string; isToday: boolean } {
    const today = todayDate ?? new Date()
    today.setHours(0, 0, 0, 0)
    const due = parseDateOnly(dateStr)
    due.setHours(0, 0, 0, 0)
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return { label: "HOY", isToday: true }
    if (diffDays === 1) return { label: "MAÑANA", isToday: false }
    if (diffDays < 0) return { label: `VENCIDO`, isToday: false }
    return {
        label: due.toLocaleDateString("es-CL", { day: "numeric", month: "short" }).toUpperCase(),
        isToday: false,
    }
}

export function BankUpcomingMaturities({ data, bankId }: BankUpcomingMaturitiesProps) {
    const router = useRouter()
    const { serverDate } = useServerDate()
    const { upcoming_maturities } = data

    if (!upcoming_maturities || upcoming_maturities.length === 0) {
        return (
            <section className="py-4">
                <SectionHeader icon={Calendar} title="Próximos Vencimientos" />
                <p className="text-xs text-muted-foreground py-2">Sin vencimientos próximos</p>
            </section>
        )
    }

    const totalAmount = upcoming_maturities.reduce((s, m) => s + m.amount, 0)
    const displayItems = upcoming_maturities.slice(0, 10)
    const remaining = upcoming_maturities.length - 10

    const hasMultipleTypes = new Set(upcoming_maturities.map(m => m.type)).size > 1

    return (
        <section className="py-4">
            <SectionHeader
                icon={Calendar}
                title="Próximos Vencimientos"
                count={upcoming_maturities.length}
                countLabel="items"
                totalAmount={totalAmount}
                href={hasMultipleTypes ? `/treasury/bank-center/${bankId}/movements` : undefined}
                variant="list"
            />

            <div className="divide-y divide-border/40">
                {displayItems.map((item, idx) => {
                    const config = TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG]
                    if (!config) return null
                    const Icon = config.icon
                    const { label: timeLabel, isToday } = formatTimeUntil(item.due_date, serverDate ?? undefined)

                    return (
                        <button
                            key={`${item.type}-${item.entity_id}-${idx}`}
                            onClick={() => router.push(config.href(bankId, item))}
                            className="w-full flex items-center gap-3 py-2 px-1 -mx-1 text-left hover:bg-muted/30 transition-colors rounded-sm group"
                        >
                            <span className={cn(
                                "min-w-[60px] text-[10px] font-black uppercase tracking-wider shrink-0",
                                isToday ? "text-destructive" : "text-muted-foreground"
                            )}>
                                {timeLabel}
                            </span>
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-xs font-medium truncate">{item.label}</span>
                            <span className="text-xs font-bold tabular-nums shrink-0">
                                <MoneyDisplay amount={item.amount} showColor={false} />
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-all shrink-0" />
                        </button>
                    )
                })}
            </div>

            {remaining > 0 && (
                <button
                    onClick={() => router.push(`/treasury/bank-center/${bankId}/movements`)}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-1.5 ml-[68px]"
                >
                    y {remaining} más →
                </button>
            )}
        </section>
    )
}


