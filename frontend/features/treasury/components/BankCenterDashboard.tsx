"use client"

import { usePathname, useRouter } from 'next/navigation'
import {
    Calendar, AlertTriangle, Landmark, CreditCard, Wallet, ArrowUpRight,
    TrendingUp, TrendingDown, Banknote, ArrowLeftRight, FileCheck,
    Plus, ArrowRight,
} from 'lucide-react'
import {
    Skeleton, EmptyState, StatusBadge, MoneyDisplay, StatCard, Badge,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { useBankOverview } from '../hooks/useBankOverview'
import type { BankOverviewData } from '../hooks/useBankOverview'
import { ChecksClientView } from '../checks/ChecksClientView'
import { LoansClientView } from '../loans/LoansClientView'
import { CardChargesView } from '../card-statements/CardChargesView'
import { StatementsList } from '@/features/finance/bank-reconciliation/components'

function KpiRow({ data }: { data: BankOverviewData }) {
    const { accounts, summary, upcoming_maturities } = data
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.current_balance, 0)
    const totalUpcoming = upcoming_maturities.reduce((sum, item) => sum + item.amount, 0)

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
                label="Saldo Total"
                value={<MoneyDisplay amount={totalBalance} />}
                icon={Landmark}
                accent="primary"
                variant="compact"
                valueSize="md"
            />
            <StatCard
                label="Deuda Tarjetas"
                value={<MoneyDisplay amount={summary.card_debt} />}
                icon={CreditCard}
                accent="destructive"
                variant="compact"
                valueSize="md"
            />
            <StatCard
                label="Cheques Cartera"
                value={<MoneyDisplay amount={summary.portfolio_checks} />}
                icon={Wallet}
                accent="info"
                variant="compact"
                valueSize="md"
            />
            <StatCard
                label="Cheques Girados"
                value={<MoneyDisplay amount={summary.issued_checks} />}
                icon={ArrowUpRight}
                accent="warning"
                variant="compact"
                valueSize="md"
            />
            <StatCard
                label="Préstamos"
                value={`${summary.active_loan_count} · ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(summary.total_loan_debt)}`}
                icon={Banknote}
                accent="accent"
                variant="compact"
                valueSize="sm"
            />
            <StatCard
                label="Próx. Vencimientos"
                value={`${upcoming_maturities.length} · ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalUpcoming)}`}
                icon={Calendar}
                accent="muted"
                variant="compact"
                valueSize="sm"
            />
        </div>
    )
}

const accountTypeGroupLabel: Record<string, string> = {
    CHECKING: 'Cuentas Corrientes',
    CREDIT_CARD: 'Tarjetas de Crédito',
    LOAN: 'Préstamos',
    CASH: 'Efectivo',
    BRIDGE: 'Cuentas Puente',
    CHECK_PORTFOLIO: 'Cheques en Cartera',
    ISSUED_CHECKS: 'Cheques Girados',
}

function AccountsSection({ data }: { data: BankOverviewData }) {
    const router = useRouter()
    const { accounts } = data

    const groups = accounts.reduce<Record<string, typeof accounts>>((acc, acct) => {
        const key = acct.account_type
        if (!acc[key]) acc[key] = []
        acc[key].push(acct)
        return acc
    }, {})

    const groupOrder = ['CHECKING', 'CREDIT_CARD', 'LOAN', 'CASH', 'BRIDGE', 'CHECK_PORTFOLIO', 'ISSUED_CHECKS']

    if (accounts.length === 0) {
        return (
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">
                        Cuentas de Tesorería
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-muted-foreground italic">No hay cuentas asociadas a este banco.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">
                    Cuentas de Tesorería
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {groupOrder.map((type) => {
                    const group = groups[type]
                    if (!group || group.length === 0) return null
                    return (
                        <div key={type}>
                            <div className="px-4 py-2 bg-muted/30 border-t border-border/50">
                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                    {accountTypeGroupLabel[type] || type}
                                </span>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase">Nombre</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase">Tipo</TableHead>
                                        <TableHead className="text-right text-[10px] font-black uppercase">Saldo</TableHead>
                                        <TableHead className="text-right text-[10px] font-black uppercase">Límite</TableHead>
                                        <TableHead className="text-right text-[10px] font-black uppercase">Moneda</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {group.map((acc) => (
                                        <TableRow
                                            key={acc.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => router.push(`/treasury/operaciones/movements?treasury_account=${acc.id}`)}
                                        >
                                            <TableCell className="font-bold text-xs">{acc.name}</TableCell>
                                            <TableCell>
                                                <StatusBadge status={acc.account_type} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <MoneyDisplay amount={acc.current_balance} />
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {acc.credit_limit != null ? <MoneyDisplay amount={acc.credit_limit} /> : '-'}
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-mono text-muted-foreground">
                                                {acc.currency}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}

const maturityTypeConfig: Record<string, { label: string; color: 'info' | 'warning' | 'destructive' }> = {
    LOAN_INSTALLMENT: { label: 'Cuota', color: 'warning' },
    CHECK: { label: 'Cheque', color: 'info' },
    CARD_STATEMENT: { label: 'Tarjeta', color: 'destructive' },
}

function MaturitiesSection({ data, bankId }: { data: BankOverviewData; bankId: number }) {
    const router = useRouter()
    const { upcoming_maturities } = data
    const totalUpcoming = upcoming_maturities.reduce((sum, item) => sum + item.amount, 0)

    const handleNavigate = (item: BankOverviewData['upcoming_maturities'][0]) => {
        if (item.type === 'LOAN_INSTALLMENT') {
            router.push(`/treasury/bank-center/${bankId}/loans?selected=${item.entity_id}`)
        } else if (item.type === 'CHECK') {
            router.push(`/treasury/bank-center/${bankId}/checks?selected=${item.entity_id}`)
        } else if (item.type === 'CARD_STATEMENT') {
            router.push(`/treasury/bank-center/${bankId}/cards/statements?selected=${item.entity_id}`)
        }
    }

    return (
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
                    <>
                        <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                            <span className="font-bold">{upcoming_maturities.length}</span>
                            <span>vencimientos por un total de</span>
                            <span className="font-bold font-mono">
                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalUpcoming)}
                            </span>
                        </div>
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
                                {upcoming_maturities.map((item, idx) => {
                                    const config = maturityTypeConfig[item.type]
                                    return (
                                        <TableRow
                                            key={idx}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleNavigate(item)}
                                        >
                                            <TableCell>
                                                <Badge intent={config?.color || 'neutral'} size="sm">
                                                    {config?.label || item.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs font-medium">{item.label}</TableCell>
                                            <TableCell className="text-xs">
                                                {new Date(item.due_date).toLocaleDateString('es-CL')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <MoneyDisplay amount={item.amount} />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </>
                )}
            </CardContent>
        </Card>
    )
}

function RecentMovementsSection({ data }: { data: BankOverviewData }) {
    const router = useRouter()
    const { recent_movements } = data

    if (!recent_movements || recent_movements.length === 0) return null

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Movimientos Recientes
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase">Folio</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Tipo</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Origen / Destino</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Fecha</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {recent_movements.map((mov) => {
                            const isInbound = mov.movement_type === 'INBOUND'
                            const isOutbound = mov.movement_type === 'OUTBOUND'
                            const isTransfer = mov.movement_type === 'TRANSFER'
                            const DirectionIcon = isInbound ? TrendingDown : isOutbound ? TrendingUp : ArrowLeftRight
                            const directionColor = isInbound ? 'text-success' : isOutbound ? 'text-destructive' : 'text-muted-foreground'

                            return (
                                <TableRow
                                    key={mov.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => router.push(`/treasury/operaciones/movements?selected=${mov.id}`)}
                                >
                                    <TableCell className="font-mono text-xs">{mov.display_id}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <DirectionIcon className={`h-3 w-3 ${directionColor}`} />
                                            <span className="text-xs">{mov.movement_type_display}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {mov.from_account_name || mov.to_account_name || '-'}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {new Date(mov.date).toLocaleDateString('es-CL')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <MoneyDisplay amount={mov.amount} />
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

function QuickActions({ bankId }: { bankId: number }) {
    const router = useRouter()

    const actions = [
        {
            label: 'Nuevo Movimiento',
            icon: Plus,
            onClick: () => router.push('/treasury/operaciones/movements?modal=new'),
            variant: 'default' as const,
        },
        {
            label: 'Conciliación',
            icon: ArrowLeftRight,
            onClick: () => router.push(`/treasury/bank-center/${bankId}/reconciliation`),
            variant: 'outline' as const,
        },
        {
            label: 'Cheques Girados',
            icon: FileCheck,
            onClick: () => router.push(`/treasury/bank-center/${bankId}/checks`),
            variant: 'outline' as const,
        },
        {
            label: 'Préstamos',
            icon: Banknote,
            onClick: () => router.push(`/treasury/bank-center/${bankId}/loans`),
            variant: 'outline' as const,
        },
    ]

    return (
        <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
                <Button
                    key={action.label}
                    variant={action.variant}
                    size="sm"
                    onClick={action.onClick}
                    className="gap-1.5"
                >
                    <action.icon className="h-3.5 w-3.5" />
                    <span className="text-xs">{action.label}</span>
                    <ArrowRight className="h-3 w-3 ml-0.5" />
                </Button>
            ))}
        </div>
    )
}

function OverviewContent({ data, bankId }: { data: BankOverviewData; bankId: number }) {
    return (
        <div className="overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-6">
                <KpiRow data={data} />
                <QuickActions bankId={bankId} />
                <AccountsSection data={data} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <MaturitiesSection data={data} bankId={bankId} />
                    <RecentMovementsSection data={data} />
                </div>
            </div>
        </div>
    )
}

export function BankCenterDashboard({ bankId, subtab }: { bankId: number; subtab?: string }) {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const activeTab = segments[3] || 'overview'
    const { data, isLoading, isError } = useBankOverview(bankId)

    if (isLoading && activeTab !== 'cards') {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-6 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-64" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                </div>
            </div>
        )
    }

    const overviewData = (data && !isError ? data : null) as BankOverviewData | null
    const checkingAccounts = overviewData
        ? overviewData.accounts.filter((acc) => acc.account_type === 'CHECKING')
            .map((acc) => ({ id: acc.id, name: acc.name }))
        : []

    return (
        <div className="h-full flex flex-col">
            {activeTab === 'overview' && (
                isError ? (
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        <EmptyState
                            title="Error al cargar datos del banco"
                            description="Intente nuevamente más tarde."
                            icon={AlertTriangle}
                        />
                    </div>
                ) : overviewData ? (
                    <OverviewContent data={overviewData} bankId={bankId} />
                ) : null
            )}

            {activeTab === 'checks' && (
                <div className="flex-1 min-h-0">
                    <ChecksClientView bankId={bankId} direction="ISSUED" />
                </div>
            )}

            {activeTab === 'loans' && (
                <div className="flex-1 min-h-0">
                    <LoansClientView bankId={bankId} />
                </div>
            )}

            {activeTab === 'cards' && (
                <div className="flex-1 min-h-0 flex flex-col">
                    <CardChargesView bankId={bankId} subtab={subtab} />
                </div>
            )}

            {activeTab === 'reconciliation' && (
                <div className="flex-1 min-h-0">
                    <StatementsList
                        bankId={bankId}
                        detailBasePath={`/treasury/bank-center/${bankId}/reconciliation`}
                        accounts={checkingAccounts}
                    />
                </div>
            )}
        </div>
    )
}
