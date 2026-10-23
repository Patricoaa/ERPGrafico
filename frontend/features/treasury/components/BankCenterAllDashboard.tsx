"use client"

import { useMemo, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import {
    ArrowRight,
    CheckSquare,
    CreditCard,
    HandCoins,
    Landmark,
    Wallet,
} from "lucide-react"
import { EmptyState, MoneyDisplay, Skeleton, StatCard } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { useAllBanksOverview } from "../hooks/useAllBanksOverview"
import { useBanks } from "../hooks/useMasterData"

interface BankTotals {
    accounts: number
    cards: number
    cardDebt: number
    activeLoans: number
    loanDebt: number
    portfolioChecks: number
    issuedChecks: number
}

const ZERO_TOTALS: BankTotals = {
    accounts: 0,
    cards: 0,
    cardDebt: 0,
    activeLoans: 0,
    loanDebt: 0,
    portfolioChecks: 0,
    issuedChecks: 0,
}

/**
 * Resumen consolidado de todos los bancos activos.
 * Complementa la vista de gestión (`BankCenterClientView`): aquí sólo se
 * consultan métricas y se navega al detalle de cada banco.
 */
export function BankCenterAllDashboard() {
    const router = useRouter()
    const { banks, isLoading: banksLoading } = useBanks()
    const { overviews, isLoading: overviewsLoading } = useAllBanksOverview()

    const activeBanks = useMemo(() => banks.filter((bank) => bank.is_active), [banks])
    const summaryByBank = useMemo(
        () => new Map(overviews.map((overview) => [overview.bank.id, overview.summary])),
        [overviews],
    )

    const totals = useMemo<BankTotals>(
        () => activeBanks.reduce<BankTotals>((acc, bank) => {
            const summary = summaryByBank.get(bank.id)
            if (!summary) return acc
            return {
                accounts: acc.accounts + (summary.total_accounts ?? 0),
                cards: acc.cards + (summary.card_count ?? 0),
                cardDebt: acc.cardDebt + (summary.card_debt ?? 0),
                activeLoans: acc.activeLoans + (summary.active_loan_count ?? 0),
                loanDebt: acc.loanDebt + (summary.total_loan_debt ?? 0),
                portfolioChecks: acc.portfolioChecks + (summary.portfolio_checks ?? 0),
                issuedChecks: acc.issuedChecks + (summary.issued_checks ?? 0),
            }
        }, ZERO_TOTALS),
        [activeBanks, summaryByBank],
    )

    if (banksLoading || overviewsLoading) return <OverviewSkeleton />

    if (activeBanks.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <EmptyState
                    context="treasury"
                    title="Sin bancos activos"
                    description="Cree o reactive una entidad bancaria para ver el resumen consolidado."
                />
            </div>
        )
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="p-4 space-y-6">
                <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    <StatCard
                        label="Bancos activos"
                        value={activeBanks.length}
                        icon={Landmark}
                        variant="fill"
                        accent="primary"
                    />
                    <StatCard
                        label="Cuentas"
                        value={totals.accounts}
                        icon={Wallet}
                        variant="fill"
                        accent="info"
                    />
                    <StatCard
                        label="Tarjetas"
                        value={totals.cards}
                        icon={CreditCard}
                        variant="fill"
                        accent="accent"
                    />
                    <StatCard
                        label="Deuda tarjetas"
                        value={<MoneyDisplay amount={totals.cardDebt} inline />}
                        icon={CreditCard}
                        variant="fill"
                        accent="warning"
                    />
                    <StatCard
                        label="Deuda préstamos"
                        value={<MoneyDisplay amount={totals.loanDebt} inline />}
                        icon={HandCoins}
                        variant="fill"
                        accent="destructive"
                    />
                    <StatCard
                        label="Cheques en cartera"
                        value={<MoneyDisplay amount={totals.portfolioChecks} inline />}
                        icon={CheckSquare}
                        variant="fill"
                        accent="success"
                    />
                </section>

                <section className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-semibold tracking-tight">Resumen por banco</h2>
                            <p className="text-xs text-muted-foreground">
                                {totals.activeLoans} préstamo{totals.activeLoans === 1 ? "" : "s"} activo{totals.activeLoans === 1 ? "" : "s"} ·{" "}
                                {totals.issuedChecks > 0
                                    ? <><MoneyDisplay amount={totals.issuedChecks} inline /> en cheques emitidos</>
                                    : "Sin cheques emitidos"}
                            </p>
                        </div>
                        <p className="text-3xs uppercase tracking-widest text-muted-foreground">
                            {activeBanks.length} {activeBanks.length === 1 ? "entidad" : "entidades"}
                        </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {activeBanks.map((bank) => {
                            const summary = summaryByBank.get(bank.id)
                            return (
                                <Button
                                    key={bank.id}
                                    type="button"
                                    variant="ghost"
                                    onClick={() => router.push(`/treasury/bank-center/${bank.id}/overview`)}
                                    className="surface-panel group h-auto w-full flex-col items-stretch justify-start gap-0 rounded-sm p-4 text-left whitespace-normal hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-primary/40"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
                                            <Landmark className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold">{bank.name}</p>
                                            <p className="truncate text-2xs text-muted-foreground">{bank.code || "Sin código"}</p>
                                        </div>
                                        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                                        <BankMetric label="Cuentas" value={summary?.total_accounts ?? "—"} />
                                        <BankMetric label="Tarjetas" value={summary?.card_count ?? "—"} />
                                        <BankMetric
                                            label="Deuda TC"
                                            value={summary ? <MoneyDisplay amount={summary.card_debt} inline /> : "—"}
                                        />
                                        <BankMetric
                                            label="Deuda préstamos"
                                            value={summary ? <MoneyDisplay amount={summary.total_loan_debt} inline /> : "—"}
                                        />
                                        <BankMetric label="Préstamos activos" value={summary?.active_loan_count ?? "—"} />
                                        <BankMetric
                                            label="Cheques cartera"
                                            value={summary ? <MoneyDisplay amount={summary.portfolio_checks} inline /> : "—"}
                                        />
                                    </div>
                                </Button>
                            )
                        })}
                    </div>
                </section>
            </div>
        </div>
    )
}

function BankMetric({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="min-w-0">
            <p className="text-3xs uppercase tracking-widest text-muted-foreground">{label}</p>
            <div className="truncate text-sm font-medium tabular-nums">{value}</div>
        </div>
    )
}

function OverviewSkeleton() {
    return (
        <div className="p-4 space-y-6" role="status" aria-label="Cargando resumen de bancos">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} className="h-24" />
                ))}
            </div>
            <div className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }, (_, index) => (
                        <Skeleton key={index} className="h-40" />
                    ))}
                </div>
            </div>
        </div>
    )
}
