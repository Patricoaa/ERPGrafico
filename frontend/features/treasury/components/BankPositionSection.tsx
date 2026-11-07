"use client"

import { useRouter } from "next/navigation"
import { ArrowUpRight, CreditCard, HandCoins, Landmark } from "lucide-react"
import { MoneyDisplay } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { CardCarousel } from "@/components/ui/card-carousel"
import type { BankOverviewData, BankOverviewLoanItem } from "../hooks/useBankOverview"

type BankAccount = BankOverviewData["accounts"][number]

function maskedCardNumber(value: string | null | undefined): string | null {
    const digits = value?.replace(/\D/g, "") ?? ""
    if (!digits) return null
    return `•••• ${digits.slice(-4)}`
}

function detectCardNetwork(name: string): string | null {
    const upper = name.toUpperCase()
    if (upper.includes("VISA")) return "VISA"
    if (upper.includes("MASTERCARD") || upper.includes("MASTER CARD")) return "MC"
    if (upper.includes("AMEX") || upper.includes("AMERICAN EXPRESS")) return "AMEX"
    return null
}

// --- Card components ---

export function CheckingAccountCard({ account, bankName, onClick }: { account: BankAccount; bankName?: string; onClick: () => void }) {
    const creditLimit = account.credit_line_credit_limit ?? 0
    const hasCredit = account.credit_line_credit_limit != null
    const disponible = hasCredit ? account.current_balance + creditLimit : null

    return (
        <Button
            type="button"
            variant="ghost"
            onClick={onClick}
            className="group text-left w-full h-auto flex flex-col items-stretch justify-start gap-3 p-4 rounded-sm surface-panel hover:bg-muted/20 transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 whitespace-normal"
        >
            <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
                    <Landmark className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate leading-tight">{account.name}</p>
                    <p className="text-2xs text-muted-foreground truncate mt-0.5">
                        {bankName ? `${bankName} · ` : ""}{account.code || account.account_number || "—"}
                    </p>
                </div>
            </div>
            <div>
                <p className="text-3xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Saldo de la cuenta</p>
                <MoneyDisplay amount={account.current_balance} className="text-2xl font-black tracking-tighter tabular-nums" />
            </div>
            {disponible != null && (
                <div className="rounded-sm bg-info/8 px-3 py-2 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-info">Disponible</span>
                        <MoneyDisplay amount={disponible} className="text-xs font-medium text-info tabular-nums" />
                    </div>
                    <p className="text-3xs text-muted-foreground">El disponible puede incluir línea de crédito.</p>
                </div>
            )}
        </Button>
    )
}

export function LoanCard({ loan, bankName, onClick }: { loan: BankOverviewLoanItem; bankName?: string; onClick: () => void }) {
    return (
        <Button
            type="button"
            variant="ghost"
            onClick={onClick}
            className="group text-left w-full h-auto flex flex-col items-stretch justify-start gap-3 p-4 rounded-sm surface-panel hover:bg-muted/20 transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 whitespace-normal"
        >
            <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning">
                    <HandCoins className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate leading-tight">
                        {loan.loan_number || loan.display_id}
                    </p>
                    <p className="text-2xs text-muted-foreground mt-0.5">{bankName ?? "Préstamo bancario"}</p>
                </div>
                <span className="shrink-0 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-3xs font-medium text-success">
                    Vigente
                </span>
            </div>
            <div>
                <p className="text-3xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Saldo insoluto</p>
                <MoneyDisplay amount={loan.outstanding_balance} className="text-2xl font-black tracking-tighter tabular-nums" />
            </div>
            <div className="grid grid-cols-2 gap-x-3">
                <div>
                    <p className="text-3xs font-medium uppercase tracking-widest text-muted-foreground">Capital</p>
                    <MoneyDisplay amount={loan.principal} className="text-xs font-medium tabular-nums" />
                </div>
                <div>
                    <p className="text-3xs font-medium uppercase tracking-widest text-muted-foreground">Cuotas pagadas</p>
                    <p className="text-xs font-medium">
                        {loan.paid_installments_count} de {loan.installments_count}
                    </p>
                </div>
            </div>
        </Button>
    )
}

export function CreditCardCard({ account, bankName, onClick }: { account: BankAccount; bankName?: string; onClick: () => void }) {
    const usedAmount = Math.abs(account.current_balance)
    const available = account.credit_limit != null ? account.credit_limit - usedAmount : null
    const network = detectCardNetwork(account.name)
    const cardNumber = maskedCardNumber(account.card_number || account.account_number || account.code)

    return (
        <Button
            type="button"
            variant="ghost"
            onClick={onClick}
            className="group text-left w-full h-auto flex flex-col items-stretch justify-start gap-3 p-4 rounded-sm surface-panel hover:bg-muted/20 transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 whitespace-normal"
        >
            <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent-foreground">
                    <CreditCard className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate leading-tight">{account.name}</p>
                    <p className="text-2xs text-muted-foreground mt-0.5">
                        {bankName ? `${bankName} · ` : ""}{cardNumber ?? "—"}
                    </p>
                </div>
            </div>
            <div>
                <p className="text-3xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Disponible de la tarjeta</p>
                <MoneyDisplay amount={available ?? 0} className="text-2xl font-black tracking-tighter tabular-nums" />
            </div>
            <div className="flex items-end justify-between gap-2">
                <div>
                    <p className="text-3xs font-medium uppercase tracking-widest text-muted-foreground">Cupo total</p>
                    <MoneyDisplay amount={account.credit_limit ?? 0} className="text-xs font-medium tabular-nums" />
                </div>
                {network && (
                    <span className="text-sm font-black tracking-tighter text-muted-foreground/60 italic select-none">
                        {network}
                    </span>
                )}
            </div>
        </Button>
    )
}

// --- Column wrapper with header ---

export function PositionColumn({
    title,
    count,
    viewAllHref,
    children,
}: {
    title: string
    count: number
    viewAllHref?: string
    children: React.ReactNode
}) {
    const router = useRouter()

    return (
        <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">{title}</span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-3xs font-medium text-muted-foreground tabular-nums">
                        {count}
                    </span>
                </div>
                {viewAllHref && (
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => router.push(viewAllHref)}
                        className="h-auto p-0 text-3xs font-medium gap-0.5"
                    >
                        Ver todos <ArrowUpRight className="h-3 w-3" />
                    </Button>
                )}
            </div>
            <CardCarousel>{children}</CardCarousel>
        </div>
    )
}

/** @deprecated — CardCarousel inside PositionColumn handles layout; kept for call-site compat. */
export function CarouselItem({ children }: { single?: boolean; children: React.ReactNode }) {
    return <>{children}</>
}

// --- Main exported section ---

interface BankPositionSectionProps {
    data: BankOverviewData
    bankId: number
}

export function BankPositionSection({ data, bankId }: BankPositionSectionProps) {
    const router = useRouter()

    const checkingAccounts = data.accounts.filter((a) => a.account_type === "CHECKING")
    const creditCards = data.accounts.filter((a) => a.account_type === "CREDIT_CARD")
    const loans = data.active_loans

    const columns = [
        checkingAccounts.length > 0 && (
            <PositionColumn
                key="checking"
                title="Cuenta bancaria"
                count={checkingAccounts.length}
                viewAllHref={`/treasury/bank-center/${bankId}/movements`}
            >
                {checkingAccounts.map((acc) => (
                    <CheckingAccountCard
                        key={acc.id}
                        account={acc}
                        onClick={() =>
                            router.push(`/treasury/bank-center/${bankId}/movements?account=${acc.id}`)
                        }
                    />
                ))}
            </PositionColumn>
        ),
        loans.length > 0 && (
            <PositionColumn
                key="loans"
                title="Préstamo bancario"
                count={loans.length}
                viewAllHref={`/treasury/bank-center/${bankId}/loans`}
            >
                {loans.map((loan) => (
                    <LoanCard
                        key={loan.id}
                        loan={loan}
                        onClick={() =>
                            router.push(`/treasury/bank-center/${bankId}/loans?selected=${loan.id}`)
                        }
                    />
                ))}
            </PositionColumn>
        ),
        creditCards.length > 0 && (
            <PositionColumn
                key="cards"
                title="Tarjeta de crédito"
                count={creditCards.length}
                viewAllHref={`/treasury/bank-center/${bankId}/cards/unbilled`}
            >
                {creditCards.map((card) => (
                    <CreditCardCard
                        key={card.id}
                        account={card}
                        onClick={() =>
                            router.push(`/treasury/bank-center/${bankId}/cards/unbilled?card=${card.id}`)
                        }
                    />
                ))}
            </PositionColumn>
        ),
    ].filter(Boolean)

    if (columns.length === 0) return null

    return (
        <div className={`grid gap-4 ${columns.length === 1 ? "grid-cols-1" : columns.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
            {columns}
        </div>
    )
}
