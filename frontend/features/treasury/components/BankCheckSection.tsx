"use client"

import { useRouter } from "next/navigation"
import { CalendarClock, FileCheck } from "lucide-react"
import { CardRail, CardSurface, MoneyDisplay, SectionHeader } from "@/components/shared"
import { useServerDate } from '@/hooks/useServerDate'
import { cn, parseDateOnly } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankCheckSection({ data, bankId }: Props) {
    const router = useRouter()
    const { serverDate } = useServerDate()
    const { issued_checks_list } = data

    if (issued_checks_list.length === 0) return null

    return (
        <section>
            <SectionHeader
                icon={FileCheck}
                title="Cheques Girados"
                count={issued_checks_list.length}
                href={`/treasury/bank-center/${bankId}/checks`}
                variant="card"
            />

            <div className="space-y-2">
                {issued_checks_list.map(chk => {
                    const isOverdue = parseDateOnly(chk.due_date) < (serverDate ?? new Date())
                    return (
                        <CardSurface
                            key={chk.id}
                            kind="item"
                            layout="inline"
                            onClick={() => router.push(`/treasury/bank-center/${bankId}/checks?selected=${chk.id}`)}
                            className="w-full"
                        >
                            <div className="min-w-0 flex-1 p-3">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-xs font-semibold font-mono">N° {chk.check_number}</span>
                                    </div>
                                    <MoneyDisplay amount={chk.amount} className="text-sm font-medium" />
                                </div>

                                <div className="flex items-center gap-3 text-3xs text-muted-foreground">
                                    <span>
                                        Emitido: {parseDateOnly(chk.issue_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                    </span>
                                    <span className="text-border/60">·</span>
                                    <span className={cn(isOverdue && "text-warning font-semibold")}>
                                        Vence: {parseDateOnly(chk.due_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                    </span>
                                </div>

                                {chk.counterparty_name && (
                                    <div className="text-3xs text-muted-foreground mt-1">
                                        A nombre de: <span className="font-medium text-foreground/80">{chk.counterparty_name}</span>
                                    </div>
                                )}
                            </div>
                            {isOverdue && (
                                <CardRail tone="warning" size="sm" decorative={false}>
                                    <CalendarClock className="size-4" aria-hidden />
                                    <span className="sr-only">Vencido</span>
                                </CardRail>
                            )}
                        </CardSurface>
                    )
                })}
            </div>
        </section>
    )
}
