"use client"

import { useRouter } from "next/navigation"
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ArrowLeftRight } from "lucide-react"
import { MoneyDisplay } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { parseDateOnly } from "@/lib/utils"
import type { BankOverviewRecentMovement } from "../hooks/useBankOverview"

export type MovementItem = BankOverviewRecentMovement & { bankName?: string }

interface BankRecentActivityProps {
    movements: MovementItem[]
    bankId?: number
    maxItems?: number
}

export function BankRecentActivity({ movements, bankId, maxItems = 3 }: BankRecentActivityProps) {
    const router = useRouter()

    if (!movements || movements.length === 0) return null

    const displayItems = movements.slice(0, maxItems)

    return (
        <section className="surface-panel rounded-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold tracking-tight">Movimientos recientes</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-3xs font-medium text-muted-foreground tabular-nums">
                        {movements.length}
                    </span>
                </div>
                {bankId != null && (
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => router.push(`/treasury/bank-center/${bankId}/movements`)}
                        className="h-auto p-0 text-3xs font-medium gap-0.5"
                    >
                        Ver todos <ArrowUpRight className="h-3 w-3" />
                    </Button>
                )}
            </div>

            <div className="flex items-center justify-between px-1 pb-1 border-b border-border/60">
                <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Concepto / Medio</span>
                <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Importe CLP</span>
            </div>

            <div className="space-y-1">
                {displayItems.map((mov) => {
                    const isInbound = mov.movement_type === "INBOUND"
                    const isOutbound = mov.movement_type === "OUTBOUND"

                    const Icon = isInbound ? ArrowDownLeft : isOutbound ? ArrowUpRight : ArrowLeftRight
                    const iconColor = isInbound ? "text-success" : isOutbound ? "text-destructive" : "text-muted-foreground"
                    const iconBg = isInbound ? "bg-success/10" : isOutbound ? "bg-destructive/10" : "bg-muted"

                    const concept = isInbound
                        ? mov.from_account_name
                        : isOutbound
                        ? mov.to_account_name
                        : mov.from_account_name && mov.to_account_name
                        ? `${mov.from_account_name} → ${mov.to_account_name}`
                        : null

                    const dateStr = parseDateOnly(mov.date).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "numeric",
                    })

                    const sublabel = [mov.bankName, mov.payment_method_display, dateStr].filter(Boolean).join(" · ")

                    return (
                        <Button
                            key={mov.id}
                            type="button"
                            variant="ghost"
                            onClick={() => router.push(`/treasury/operaciones/movements?selected=${mov.id}`)}
                            className="w-full h-auto flex items-center justify-start gap-2.5 rounded-sm px-1 py-1.5 hover:bg-muted/30 transition-colors focus-visible:ring-1 focus-visible:ring-primary/40 text-left whitespace-normal"
                        >
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconBg} ${iconColor}`}>
                                <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate leading-tight">
                                    {concept || mov.movement_type_display}
                                </p>
                                <p className="text-2xs text-muted-foreground truncate mt-0.5">{sublabel}</p>
                            </div>
                            <MoneyDisplay
                                amount={isOutbound ? -Math.abs(mov.amount) : mov.amount}
                                className="text-xs font-semibold tabular-nums shrink-0"
                            />
                        </Button>
                    )
                })}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/60 mt-auto">
                <p className="text-2xs text-muted-foreground">
                    Últimos {displayItems.length} movimientos registrados
                </p>
                {bankId != null && (
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => router.push(`/treasury/bank-center/${bankId}/movements`)}
                        className="h-auto p-0 text-3xs font-medium gap-1"
                    >
                        Ir a tesorería <ArrowRight className="h-3 w-3" />
                    </Button>
                )}
            </div>
        </section>
    )
}
