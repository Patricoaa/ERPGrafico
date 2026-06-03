"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { Landmark, Banknote, CreditCard, CheckSquare } from 'lucide-react'
import {
    StatCard, Skeleton, EmptyState, MoneyDisplay,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useAllBanksOverview } from '../hooks/useAllBanksOverview'

export function BankCenterAllView() {
    const router = useRouter()
    const { overviews, isLoading } = useAllBanksOverview()

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-64" />
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
        <div className="space-y-6">
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

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <Landmark className="h-4 w-4" />
                        Bancos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {overviews.length === 0 ? (
                        <EmptyState
                            title="No hay bancos configurados"
                            description="Agregue bancos desde Configuración > Bancos."
                            icon={Landmark}
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase">Banco</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase">Cuentas</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase">Deuda TC</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase">Cheques Cartera</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase">Préstamos</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase">Deuda Préstamos</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {overviews.map((item) => (
                                    <TableRow
                                        key={item.bank.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => router.push(`/treasury/centro-bancos?bank=${item.bank.id}`)}
                                    >
                                        <TableCell className="font-bold text-xs">{item.bank.name}</TableCell>
                                        <TableCell className="text-center text-xs">{item.summary.total_accounts}</TableCell>
                                        <TableCell className="text-right text-xs">
                                            <MoneyDisplay amount={item.summary.card_debt} />
                                        </TableCell>
                                        <TableCell className="text-right text-xs">
                                            <MoneyDisplay amount={item.summary.portfolio_checks} />
                                        </TableCell>
                                        <TableCell className="text-center text-xs">{item.summary.active_loan_count}</TableCell>
                                        <TableCell className="text-right text-xs">
                                            <MoneyDisplay amount={item.summary.total_loan_debt} />
                                        </TableCell>
                                        <TableCell className="text-right text-xs">
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="h-auto p-0"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    router.push(`/treasury/centro-bancos?bank=${item.bank.id}`)
                                                }}
                                            >
                                                Ver detalle
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
