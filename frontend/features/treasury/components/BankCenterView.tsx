"use client"

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Landmark, Banknote, CreditCard, CheckSquare, Calendar, AlertTriangle } from 'lucide-react'
import {
    StatCard, Skeleton, EmptyState, StatusBadge, MoneyDisplay,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { treasuryApi } from '../api/treasuryApi'
import { BANKS_KEYS } from '../hooks/queryKeys'
import { ChecksView } from '../checks/ChecksView'
import { LoansView } from '../loans/LoansView'
import { StatementsView } from '../card-statements/StatementsView'
import { StatementsList } from '@/features/finance/bank-reconciliation/components'

interface MaturityItem {
    type: string
    label: string
    due_date: string
    amount: number
    entity_id: number
    display_id: string
}

interface BankOverviewData {
    bank: { id: number; name: string; code: string | null }
    accounts: Array<{
        id: number
        name: string
        account_type: string
        account_type_display: string
        current_balance: number
    }>
    summary: {
        total_accounts: number
        card_debt: number
        portfolio_checks: number
        issued_checks: number
        active_loan_count: number
        total_loan_debt: number
    }
    upcoming_maturities: MaturityItem[]
}

function useBankOverview(bankId: number | null) {
    return useQuery({
        queryKey: [...BANKS_KEYS.all, 'overview', bankId],
        queryFn: () => treasuryApi.getBankOverview(bankId!),
        enabled: bankId != null,
    })
}

export function BankCenterView({ bankId }: { bankId: number }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const activeTab = searchParams.get('tab') || 'overview'
    const { data, isLoading, isError } = useBankOverview(bankId)

    const handleTabChange = (tab: string) => {
        router.push(`/treasury/centro-bancos?bank=${bankId}&tab=${tab}`, { scroll: false })
    }

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

    if (isError || !data) {
        return (
            <EmptyState
                title="Error al cargar datos del banco"
                description="Intente nuevamente más tarde."
                icon={AlertTriangle}
            />
        )
    }

    const { bank, accounts, summary, upcoming_maturities } = data as BankOverviewData

    const typeColors: Record<string, string> = {
        LOAN_INSTALLMENT: 'text-warning',
        CHECK: 'text-info',
        CARD_STATEMENT: 'text-destructive',
    }

    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
            <TabsList className="shrink-0">
                <TabsTrigger value="overview">Resumen</TabsTrigger>
                <TabsTrigger value="checks">Cheques</TabsTrigger>
                <TabsTrigger value="loans">Préstamos</TabsTrigger>
                <TabsTrigger value="cards">Tarjetas</TabsTrigger>
                <TabsTrigger value="reconciliation">Conciliación</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 overflow-y-auto data-[state=inactive]:hidden custom-scrollbar">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard
                            label="Cuentas"
                            value={summary.total_accounts.toString()}
                            icon={Landmark}
                            accent="primary"
                        />
                        <StatCard
                            label="Deuda Tarjeta"
                            value={<MoneyDisplay amount={summary.card_debt} inline />}
                            icon={CreditCard}
                            accent="warning"
                        />
                        <StatCard
                            label="Cheques en Cartera"
                            value={<MoneyDisplay amount={summary.portfolio_checks} inline />}
                            icon={CheckSquare}
                            accent="info"
                        />
                        <StatCard
                            label="Cheques Propios"
                            value={<MoneyDisplay amount={summary.issued_checks} inline />}
                            icon={CheckSquare}
                            accent="destructive"
                        />
                        <StatCard
                            label="Préstamos Activos"
                            value={summary.active_loan_count.toString()}
                            icon={Banknote}
                            accent="primary"
                        />
                        <StatCard
                            label="Deuda Préstamos"
                            value={<MoneyDisplay amount={summary.total_loan_debt} inline />}
                            icon={Banknote}
                            accent="warning"
                        />
                    </div>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">
                                Cuentas de Tesorería
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {accounts.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No hay cuentas asociadas a este banco.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-[10px] font-black uppercase">Nombre</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase">Tipo</TableHead>
                                            <TableHead className="text-right text-[10px] font-black uppercase">Saldo</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {accounts.map((acc) => (
                                            <TableRow key={acc.id}>
                                                <TableCell className="font-bold text-xs">{acc.name}</TableCell>
                                                <TableCell>
                                                    <StatusBadge status={acc.account_type} />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <MoneyDisplay amount={acc.current_balance} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Próximos Vencimientos (30 días)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {upcoming_maturities.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No hay vencimientos próximos.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-[10px] font-black uppercase">Tipo</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase">Descripción</TableHead>
                                            <TableHead className="text-[10px] font-black uppercase">Vencimiento</TableHead>
                                            <TableHead className="text-right text-[10px] font-black uppercase">Monto</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {upcoming_maturities.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    <span className={`text-[10px] font-bold uppercase ${typeColors[item.type] || 'text-muted-foreground'}`}>
                                                        {item.type === 'LOAN_INSTALLMENT' ? 'Cuota' :
                                                         item.type === 'CHECK' ? 'Cheque' : 'Tarjeta'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs font-medium">{item.label}</TableCell>
                                                <TableCell className="text-xs">
                                                    {new Date(item.due_date).toLocaleDateString('es-CL')}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <MoneyDisplay amount={item.amount} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            <TabsContent value="checks" className="mt-6 overflow-y-auto data-[state=inactive]:hidden custom-scrollbar">
                <ChecksView bankId={bankId} />
            </TabsContent>

            <TabsContent value="loans" className="mt-6 overflow-y-auto data-[state=inactive]:hidden custom-scrollbar">
                <LoansView bankId={bankId} />
            </TabsContent>

            <TabsContent value="cards" className="mt-6 overflow-y-auto data-[state=inactive]:hidden custom-scrollbar">
                <StatementsView bankId={bankId} />
            </TabsContent>

            <TabsContent value="reconciliation" className="mt-6 flex-1 min-h-0 data-[state=inactive]:hidden">
                <StatementsList
                    bankId={bankId}
                    accounts={accounts
                        .filter(acc => acc.account_type === 'CHECKING')
                        .map(acc => ({ id: acc.id, name: acc.name }))
                    }
                />
            </TabsContent>
        </Tabs>
    )
}
