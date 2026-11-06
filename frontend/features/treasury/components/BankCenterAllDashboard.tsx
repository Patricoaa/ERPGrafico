"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { EmptyState, Skeleton } from "@/components/shared"
import { useAllBanksOverview } from "../hooks/useAllBanksOverview"
import { useBanks } from "../hooks/useMasterData"
import { BankRecentActivity, type MovementItem } from "./BankRecentActivity"
import { BankUpcomingMaturitiesPanel, type MaturityItem } from "./BankUpcomingMaturities"
import { CheckingAccountCard, CreditCardCard, LoanCard, PositionColumn } from "./BankPositionSection"

type AccountWithBank = ReturnType<typeof useAllBanksOverview>["overviews"][number]["accounts"][number] & {
    bankId: number
    bankName: string
}
type LoanWithBank = ReturnType<typeof useAllBanksOverview>["overviews"][number]["active_loans"][number] & {
    bankId: number
    bankName: string
}

export function BankCenterAllDashboard() {
    const router = useRouter()
    const { banks, isLoading: banksLoading } = useBanks()
    const { overviews, isLoading: overviewsLoading } = useAllBanksOverview()

    const activeBanks = useMemo(() => banks.filter((b) => b.is_active), [banks])

    const allCheckingAccounts = useMemo<AccountWithBank[]>(
        () =>
            overviews.flatMap((o) =>
                o.accounts
                    .filter((a) => a.account_type === "CHECKING")
                    .map((a) => ({ ...a, bankId: o.bank.id, bankName: o.bank.name })),
            ),
        [overviews],
    )

    const allLoans = useMemo<LoanWithBank[]>(
        () =>
            overviews.flatMap((o) =>
                o.active_loans.map((l) => ({ ...l, bankId: o.bank.id, bankName: o.bank.name })),
            ),
        [overviews],
    )

    const allCreditCards = useMemo<AccountWithBank[]>(
        () =>
            overviews.flatMap((o) =>
                o.accounts
                    .filter((a) => a.account_type === "CREDIT_CARD")
                    .map((a) => ({ ...a, bankId: o.bank.id, bankName: o.bank.name })),
            ),
        [overviews],
    )

    const allMaturities = useMemo<MaturityItem[]>(
        () =>
            overviews
                .flatMap((o) =>
                    o.upcoming_maturities.map((m) => ({ ...m, bankId: o.bank.id, bankName: o.bank.name })),
                )
                .sort((a, b) => a.due_date.localeCompare(b.due_date)),
        [overviews],
    )

    const allMovements = useMemo<MovementItem[]>(
        () =>
            overviews
                .flatMap((o) =>
                    o.recent_movements.map((m) => ({ ...m, bankName: o.bank.name })),
                )
                .sort((a, b) => b.date.localeCompare(a.date)),
        [overviews],
    )

    const activeColumnCount = [allCheckingAccounts.length > 0, allLoans.length > 0, allCreditCards.length > 0].filter(Boolean).length
    const gridCols =
        activeColumnCount === 1
            ? "grid-cols-1"
            : activeColumnCount === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"

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
            <div className="p-4 space-y-5">
                {/* Summary pill */}
                <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{activeBanks.length}</span>{" "}
                    {activeBanks.length === 1 ? "banco" : "bancos"}
                    {allCheckingAccounts.length > 0 && (
                        <> · <span className="font-medium text-foreground">{allCheckingAccounts.length}</span> {allCheckingAccounts.length === 1 ? "cuenta" : "cuentas"}</>
                    )}
                    {allLoans.length > 0 && (
                        <> · <span className="font-medium text-foreground">{allLoans.length}</span> {allLoans.length === 1 ? "préstamo" : "préstamos"}</>
                    )}
                    {allCreditCards.length > 0 && (
                        <> · <span className="font-medium text-foreground">{allCreditCards.length}</span> {allCreditCards.length === 1 ? "tarjeta" : "tarjetas"}</>
                    )}
                </p>

                {/* Position columns */}
                {activeColumnCount > 0 && (
                    <div className={`grid gap-4 ${gridCols}`}>
                        {allCheckingAccounts.length > 0 && (
                            <PositionColumn title="Cuentas bancarias" count={allCheckingAccounts.length}>
                                {allCheckingAccounts.map((acc) => (
                                    <CheckingAccountCard
                                        key={`${acc.bankId}-${acc.id}`}
                                        account={acc}
                                        bankName={acc.bankName}
                                        onClick={() =>
                                            router.push(`/treasury/bank-center/${acc.bankId}/movements?account=${acc.id}`)
                                        }
                                    />
                                ))}
                            </PositionColumn>
                        )}
                        {allLoans.length > 0 && (
                            <PositionColumn title="Préstamos bancarios" count={allLoans.length}>
                                {allLoans.map((loan) => (
                                    <LoanCard
                                        key={`${loan.bankId}-${loan.id}`}
                                        loan={loan}
                                        bankName={loan.bankName}
                                        onClick={() =>
                                            router.push(`/treasury/bank-center/${loan.bankId}/loans?selected=${loan.id}`)
                                        }
                                    />
                                ))}
                            </PositionColumn>
                        )}
                        {allCreditCards.length > 0 && (
                            <PositionColumn title="Tarjetas de crédito" count={allCreditCards.length}>
                                {allCreditCards.map((card) => (
                                    <CreditCardCard
                                        key={`${card.bankId}-${card.id}`}
                                        account={card}
                                        bankName={card.bankName}
                                        onClick={() =>
                                            router.push(`/treasury/bank-center/${card.bankId}/cards/unbilled?card=${card.id}`)
                                        }
                                    />
                                ))}
                            </PositionColumn>
                        )}
                    </div>
                )}

                {/* Activity + Maturities */}
                {(allMovements.length > 0 || allMaturities.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <BankRecentActivity movements={allMovements} maxItems={5} />
                        <BankUpcomingMaturitiesPanel maturities={allMaturities} />
                    </div>
                )}
            </div>
        </div>
    )
}

function OverviewSkeleton() {
    return (
        <div className="p-4 space-y-5" role="status" aria-label="Cargando resumen de bancos">
            <Skeleton className="h-4 w-56" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-36" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
            </div>
        </div>
    )
}
