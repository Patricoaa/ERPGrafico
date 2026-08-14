"use client"

import { useRouter } from "next/navigation"
import { HandCoins, FileCheck, CreditCard, Calendar } from "lucide-react"
import { EntityCard, MoneyDisplay, SectionHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { useServerDate } from '@/hooks/useServerDate'
import type { BankOverviewData, BankOverviewMaturityItem } from "../hooks/useBankOverview"

interface BankUpcomingMaturitiesPanelProps {
    data: BankOverviewData
    bankId: number
    maxItems?: number
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
    const due = new Date(dateStr + "T00:00:00")
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

export function BankUpcomingMaturitiesPanel({ data, bankId, maxItems = 10 }: BankUpcomingMaturitiesPanelProps) {
    const router = useRouter()
    const { serverDate } = useServerDate()
    const { upcoming_maturities } = data

    if (!upcoming_maturities || upcoming_maturities.length === 0) {
        return (
            <section>
                <SectionHeader icon={Calendar} title="Próximos Vencimientos" />
                <p className="text-xs text-muted-foreground py-2">Sin vencimientos próximos</p>
            </section>
        )
    }

    const totalAmount = upcoming_maturities.reduce((s, m) => s + m.amount, 0)
    const displayItems = upcoming_maturities.slice(0, maxItems)
    const remaining = upcoming_maturities.length - maxItems

    const hasMultipleTypes = new Set(upcoming_maturities.map(m => m.type)).size > 1

    return (
        <section>
            <SectionHeader
                icon={Calendar}
                title="Próximos Vencimientos"
                count={upcoming_maturities.length}
                countLabel="items"
                totalAmount={totalAmount}
                href={hasMultipleTypes ? `/treasury/bank-center/${bankId}/movements` : undefined}
                variant="list"
            />

            <div className="space-y-2">
                {displayItems.map((item, idx) => {
                    const config = TYPE_CONFIG[item.type as keyof typeof TYPE_CONFIG]
                    if (!config) return null
                    const Icon = config.icon
                    const { label: timeLabel, isToday } = formatTimeUntil(item.due_date, serverDate ?? undefined)

                    return (
                        <EntityCard.ListItem
                            key={`${item.type}-${item.entity_id}-${idx}`}
                            icon={Icon}
                            iconClassName={isToday ? "text-destructive" : "text-muted-foreground"}
                            label={item.label}
                            sublabel={timeLabel}
                            value={<MoneyDisplay amount={item.amount} showColor={false} />}
                            onClick={() => router.push(config.href(bankId, item))}
                        />
                    )
                })}
            </div>

            {remaining > 0 && (
                <Button
                    variant="link"
                    size="sm"
                    onClick={() => router.push(`/treasury/bank-center/${bankId}/movements`)}
                    className="text-2xs font-medium text-muted-foreground hover:text-foreground transition-colors mt-1.5 ml-[28px]"
                >
                    y {remaining} más →
                </Button>
            )}
        </section>
    )
}
