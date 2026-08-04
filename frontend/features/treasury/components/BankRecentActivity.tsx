"use client"

import { useRouter } from "next/navigation"
import { TrendingDown, TrendingUp, ArrowLeftRight, Receipt } from "lucide-react"
import { EntityCard, MoneyDisplay, SectionHeader } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { parseDateOnly } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface BankRecentActivityProps {
    data: BankOverviewData
    bankId: number
    maxItems?: number
}

export function BankRecentActivity({ data, bankId, maxItems = 8 }: BankRecentActivityProps) {
    const router = useRouter()
    const { recent_movements } = data

    if (!recent_movements || recent_movements.length === 0) return null

    const displayItems = recent_movements.slice(0, maxItems)
    const remaining = recent_movements.length - maxItems

    return (
        <section>
            <SectionHeader
                icon={Receipt}
                title="Movimientos Recientes"
                count={recent_movements.length}
                href={`/treasury/bank-center/${bankId}/movements`}
                variant="list"
            />

            <div className="space-y-2">
                {displayItems.map(mov => {
                    const isInbound = mov.movement_type === "INBOUND"
                    const isOutbound = mov.movement_type === "OUTBOUND"
                    const DotIcon = isInbound ? TrendingDown : isOutbound ? TrendingUp : ArrowLeftRight
                    const dotColor = isInbound
                        ? "text-success"
                        : isOutbound
                        ? "text-destructive"
                        : "text-muted-foreground"

                    const counterparty = isInbound
                        ? mov.from_account_name
                        : isOutbound
                        ? mov.to_account_name
                        : mov.from_account_name && mov.to_account_name
                        ? `${mov.from_account_name} → ${mov.to_account_name}`
                        : null

                    const dateStr = parseDateOnly(mov.date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })

                    return (
                        <EntityCard.ListItem
                            key={mov.id}
                            icon={DotIcon}
                            iconClassName={dotColor}
                            label={counterparty || mov.movement_type_display}
                            sublabel={`${mov.payment_method_display} · ${dateStr}`}
                            value={<MoneyDisplay amount={mov.movement_type === "OUTBOUND" ? -Math.abs(mov.amount) : mov.amount} className="text-xs font-bold" />}
                            onClick={() => router.push(`/treasury/operaciones/movements?selected=${mov.id}`)}
                        />
                    )
                })}
            </div>

            {remaining > 0 && (
                <Button
                    variant="link"
                    size="sm"
                    onClick={() => router.push(`/treasury/bank-center/${bankId}/movements`)}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-1.5 ml-[28px]"
                >
                    y {remaining} más →
                </Button>
            )}
        </section>
    )
}
