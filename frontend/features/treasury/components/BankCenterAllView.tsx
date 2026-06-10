"use client"

import React from 'react'
import { Landmark, Banknote, CreditCard, CheckSquare } from 'lucide-react'
import {
    StatCard, Skeleton, MoneyDisplay,
} from '@/components/shared'
import { useAllBanksOverview } from '../hooks/useAllBanksOverview'

export function BankCenterAllView() {
    const { overviews, isLoading } = useAllBanksOverview()

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
        )
    }

    const totals = overviews.reduce(
        (acc, item) => ({
            total_accounts: acc.total_accounts + item.summary.total_accounts,
            card_debt: acc.card_debt + item.summary.card_debt,
            portfolio_checks: acc.portfolio_checks + item.summary.portfolio_checks,
            issued_checks: acc.issued_checks + item.summary.issued_checks,
            active_loan_count: acc.active_loan_count + item.summary.active_loan_count,
            total_loan_debt: acc.total_loan_debt + item.summary.total_loan_debt,
        }),
        { total_accounts: 0, card_debt: 0, portfolio_checks: 0, issued_checks: 0, active_loan_count: 0, total_loan_debt: 0 }
    )

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard
                label="Total Cuentas"
                value={totals.total_accounts.toString()}
                icon={Landmark}
                accent="primary"
            />
            <StatCard
                label="Deuda Tarjetas"
                value={<MoneyDisplay amount={totals.card_debt} inline />}
                icon={CreditCard}
                accent="warning"
            />
            <StatCard
                label="Cheques en Cartera"
                value={<MoneyDisplay amount={totals.portfolio_checks} inline />}
                icon={CheckSquare}
                accent="info"
            />
            <StatCard
                label="Cheques Propios"
                value={<MoneyDisplay amount={totals.issued_checks} inline />}
                icon={CheckSquare}
                accent="destructive"
            />
            <StatCard
                label="Préstamos Activos"
                value={totals.active_loan_count.toString()}
                icon={Banknote}
                accent="primary"
            />
            <StatCard
                label="Deuda Préstamos"
                value={<MoneyDisplay amount={totals.total_loan_debt} inline />}
                icon={Banknote}
                accent="warning"
            />
        </div>
    )
}
