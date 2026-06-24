"use client"

import { useRouter } from "next/navigation"
import { Landmark, HandCoins, FileCheck, CreditCard, ShieldCheck } from "lucide-react"
import { MoneyDisplay } from "@/components/shared"
import { cn } from "@/lib/utils"
import type { BankOverviewData } from "../hooks/useBankOverview"

interface BankMastheadProps {
    data: BankOverviewData
    bankId: number
}

const quickLinks = [
    { key: "loans", icon: HandCoins, label: "Préstamos", href: (id: number) => `/treasury/bank-center/${id}/loans` },
    { key: "checks", icon: FileCheck, label: "Cheques", href: (id: number) => `/treasury/bank-center/${id}/checks` },
    { key: "cards", icon: CreditCard, label: "Tarjetas", href: (id: number) => `/treasury/bank-center/${id}/cards` },
    { key: "reconciliation", icon: ShieldCheck, label: "Conciliación", href: (id: number) => `/treasury/bank-center/${id}/reconciliation` },
]

export function BankMasthead({ data, bankId }: BankMastheadProps) {
    const router = useRouter()
    const { bank, accounts, summary } = data

    const checking = accounts.filter(a => a.account_type === "CHECKING")
    const totalCash = checking.reduce((s, a) => s + a.current_balance, 0)
    const totalCreditLines = checking.reduce((s, a) => s + (a.credit_line_credit_limit ?? 0), 0)
    const totalDebt = summary.card_debt + summary.issued_checks + summary.total_loan_debt
    const netPosition = totalCash + totalCreditLines - totalDebt

    return (
        <section className="py-4 space-y-3">
            <div className="flex items-center justify-between">
                <hgroup>
                    <h1 className="text-xl font-heading font-black tracking-tight text-foreground">
                        {bank.name}
                    </h1>
                    {bank.code && (
                        <p className="text-xs font-mono text-muted-foreground leading-none -mt-0.5">
                            {bank.code}
                        </p>
                    )}
                </hgroup>
                <div className="flex items-center gap-4">
                    {quickLinks.map(link => (
                        <button
                            key={link.key}
                            onClick={() => router.push(link.href(bankId))}
                            className="group flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <link.icon className="h-3 w-3" />
                            {link.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative group/deuda">
                <div className="flex items-center gap-4 text-sm border-y border-border/40 py-2">
                    <span className="pointer-events-none"><Metric label="Saldo" value={totalCash} /></span>
                    <span className="pointer-events-none"><Divider /></span>
                    <span className="pointer-events-none"><Metric label="+ Líneas" value={totalCreditLines} /></span>
                    <span className="pointer-events-none"><Divider /></span>
                    <span className="cursor-pointer text-warning">
                        <Metric label="Deuda" value={totalDebt} />
                    </span>
                    <span className="pointer-events-none"><Divider /></span>
                    <span className={cn(
                        "flex items-baseline gap-1.5 pointer-events-none",
                        netPosition >= 0 ? "text-success" : "text-destructive"
                    )}>
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Posición</span>
                        <MoneyDisplay amount={netPosition} showColor={false} className="text-sm font-heading font-black tracking-tight" />
                    </span>
                </div>

                <div className="hidden group-hover/deuda:flex items-center gap-4 text-sm text-warning pt-1">
                    <span className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-medium text-warning/70 uppercase tracking-wider">Préstamos</span>
                        <span className="text-warning">{summary.active_loan_count}</span>
                        {" · "}
                        <MoneyDisplay amount={summary.total_loan_debt} className="text-sm font-heading font-black tracking-tight" />
                    </span>
                    <Divider />
                    <span className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-medium text-warning/70 uppercase tracking-wider">Cheques</span>
                        <MoneyDisplay amount={summary.issued_checks} className="text-sm font-heading font-black tracking-tight" />
                    </span>
                    <Divider />
                    <span className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-medium text-warning/70 uppercase tracking-wider">Deuda TC</span>
                        <MoneyDisplay amount={summary.card_debt} className="text-sm font-heading font-black tracking-tight" />
                        {" · "}
                        <span className="text-warning">{summary.card_count ?? 0} tarjeta(s)</span>
                    </span>
                </div>
            </div>
        </section>
    )
}

function Metric({ label, value }: { label: string; value: number; accent?: boolean }) {
    return (
        <span className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
            <MoneyDisplay amount={value} showColor={false} className="text-sm font-heading font-black tracking-tight" />
        </span>
    )
}

function Divider() {
    return <span className="text-border/50 select-none">|</span>
}


