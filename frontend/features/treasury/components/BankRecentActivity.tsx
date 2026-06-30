"use client"

import { useRouter } from "next/navigation"
import { TrendingDown, TrendingUp, ArrowLeftRight, Receipt, ArrowRight } from "lucide-react"
import { MoneyDisplay, EmptyState, SectionHeader } from "@/components/shared"
import { cn, parseDateOnly } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface BankRecentActivityProps {
    data: BankOverviewData
    bankId: number
}

export function BankRecentActivity({ data, bankId }: BankRecentActivityProps) {
    const router = useRouter()
    const { recent_movements } = data

    if (!recent_movements || recent_movements.length === 0) return null

    return (
        <section className="py-4">
            <SectionHeader
                icon={Receipt}
                title="Movimientos Recientes"
                href={`/treasury/bank-center/${bankId}/movements`}
                variant="list"
            />

            <div className="divide-y divide-border/40">
                {recent_movements.map(mov => {
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

                    return (
                        <button
                            key={mov.id}
                            onClick={() => router.push(`/treasury/operaciones/movements?selected=${mov.id}`)}
                            className="w-full flex items-center gap-3 py-2 px-1 -mx-1 text-left hover:bg-muted/30 transition-colors rounded-sm group"
                        >
                            <DotIcon className={cn("h-3.5 w-3.5 shrink-0", dotColor)} />
                            <span className="text-[11px] text-muted-foreground font-mono tabular-nums shrink-0 w-12">
                                {parseDateOnly(mov.date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" })}
                            </span>
                            <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium truncate block">
                                    {counterparty || mov.movement_type_display}
                                </span>
                                {counterparty && (
                                    <span className="text-[10px] text-muted-foreground truncate block">
                                        {mov.movement_type_display}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-2 shrink-0">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                    {mov.payment_method_display}
                                </span>
                                <MoneyDisplay amount={mov.amount} className="text-xs font-bold tabular-nums" />
                            </div>
                            <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-all shrink-0" />
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
