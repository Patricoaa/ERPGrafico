"use client"

import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Calendar, AlertTriangle } from 'lucide-react'
import {
    Skeleton, EmptyState, StatusBadge, MoneyDisplay,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { treasuryApi } from '../api/treasuryApi'
import { BANKS_KEYS } from '../hooks/queryKeys'
import { ChecksView } from '../checks/ChecksView'
import { LoansView } from '../loans/LoansView'
import { CardChargesView } from '../card-statements/CardChargesView'
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
        currency: string
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

export function BankCenterView({ bankId, subtab }: { bankId: number; subtab?: string }) {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const activeTab = segments[3] || 'overview'
    const { data, isLoading, isError } = useBankOverview(bankId)

    const creditCardAccounts = data?.accounts?.filter(
        (acc: { account_type: string }) => acc.account_type === 'CREDIT_CARD'
    ) || []

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
        <div className="h-full flex flex-col">
            {activeTab === 'overview' && (
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    <div className="space-y-6">

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
                </div>
            )}

            {activeTab === 'checks' && (
                <div className="flex-1 min-h-0">
                    <ChecksView bankId={bankId} direction="ISSUED" />
                </div>
            )}

            {activeTab === 'loans' && (
                <div className="flex-1 min-h-0">
                    <LoansView bankId={bankId} />
                </div>
            )}

            {activeTab === 'cards' && (
                <div className="flex-1 min-h-0 flex flex-col">
                    <CardChargesView bankId={bankId} creditCardAccounts={creditCardAccounts} subtab={subtab} />
                </div>
            )}

            {activeTab === 'reconciliation' && (
                <div className="flex-1 min-h-0">
                    <StatementsList
                        bankId={bankId}
                        detailBasePath={`/treasury/centro-bancos/${bankId}/reconciliation`}
                        accounts={accounts
                            .filter((acc: { account_type: string }) => acc.account_type === 'CHECKING')
                            .map((acc: { id: number; name: string }) => ({ id: acc.id, name: acc.name }))
                        }
                    />
                </div>
            )}
        </div>
    )
}
