"use client"

import { useRouter } from "next/navigation"
import { FileCheck } from "lucide-react"
import { MoneyDisplay, SectionHeader } from "@/components/shared"
import { useServerDate } from '@/hooks/useServerDate'
import { cn, parseDateOnly } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankOverviewCheckCards({ data, bankId }: Props) {
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
                        <button
                            key={chk.id}
                            onClick={() => router.push(`/treasury/bank-center/${bankId}/checks?selected=${chk.id}`)}
                            className={cn(
                                "w-full text-left rounded-lg border border-border/50 bg-card p-3 border-l-4",
                                isOverdue ? "border-l-warning" : "border-l-muted-foreground/30",
                                "hover:bg-accent hover:border-border transition-all",
                            )}
                        >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-xs font-semibold font-mono">N° {chk.check_number}</span>
                                </div>
                                <MoneyDisplay amount={chk.amount} className="text-sm font-bold" />
                            </div>

                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                <span>
                                    Emitido: {parseDateOnly(chk.issue_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                </span>
                                <span className="text-border/60">·</span>
                                <span className={cn(isOverdue && "text-warning font-semibold")}>
                                    Vence: {parseDateOnly(chk.due_date).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                                </span>
                            </div>

                            {chk.counterparty_name && (
                                <div className="text-[10px] text-muted-foreground mt-1">
                                    A nombre de: <span className="font-medium text-foreground/80">{chk.counterparty_name}</span>
                                </div>
                            )}
                        </button>
                    )
                })}
            </div>
        </section>
    )
}
