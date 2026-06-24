"use client"

import { useRouter } from "next/navigation"
import { FileCheck, ArrowRight } from "lucide-react"
import { MoneyDisplay } from "@/components/shared"
import { cn, parseDateOnly } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface Props {
    data: BankOverviewData
    bankId: number
}

export function BankOverviewCheckCards({ data, bankId }: Props) {
    const router = useRouter()
    const { issued_checks_list } = data

    if (issued_checks_list.length === 0) return null

    return (
        <section>
            <button
                onClick={() => router.push(`/treasury/bank-center/${bankId}/checks`)}
                className="w-full flex items-center justify-between group mb-3"
            >
                <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <FileCheck className="h-3 w-3" />
                    Cheques Girados
                    <span className="font-normal text-border/60 mx-1">·</span>
                    <span className="font-normal">{issued_checks_list.length}</span>
                </h2>
                <span className="text-[10px] font-medium text-muted-foreground/0 group-hover:text-muted-foreground transition-all flex items-center gap-0.5">
                    Ver todos <ArrowRight className="h-3 w-3" />
                </span>
            </button>

            <div className="space-y-2">
                {issued_checks_list.map(chk => {
                    const isOverdue = parseDateOnly(chk.due_date) < new Date()
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
