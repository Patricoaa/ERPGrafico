"use client"

import { usePathname, useRouter } from 'next/navigation'
import {
    Calendar, AlertTriangle, Landmark, CreditCard,
    TrendingUp, TrendingDown, Banknote, ArrowLeftRight, FileCheck,
    Plus, Receipt, Gauge,
} from 'lucide-react'
import {
    Skeleton, EmptyState, Badge, MoneyDisplay, StatCard,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBankOverview } from '../hooks/useBankOverview'
import type { BankOverviewData } from '../hooks/useBankOverview'
import { ChecksClientView } from '../checks/ChecksClientView'
import { LoansClientView } from '../loans/LoansClientView'
import { CardChargesView } from '../card-statements/CardChargesView'
import { StatementsList } from '@/features/finance/bank-reconciliation/components'
import { ResponsivePie } from '@nivo/pie'

function CompactKPIs({ data }: { data: BankOverviewData }) {
    const { accounts, summary, upcoming_maturities } = data
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.current_balance, 0)
    const totalUpcoming = upcoming_maturities.reduce((sum, item) => sum + item.amount, 0)
    const shortTermDebt = summary.card_debt + totalUpcoming
    const netPosition = totalBalance - shortTermDebt
    const accountCount = accounts.length

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
                label="Saldo Total"
                value={<MoneyDisplay amount={totalBalance} />}
                icon={Landmark}
                accent="primary"
                variant="compact"
                valueSize="lg"
                subtext={`${accountCount} ${accountCount === 1 ? 'cuenta' : 'cuentas'} de tesorería`}
            />
            <StatCard
                label="Exposición Neta"
                value={<MoneyDisplay amount={netPosition} />}
                icon={Gauge}
                accent={netPosition >= 0 ? 'success' : 'destructive'}
                variant="compact"
                valueSize="lg"
                subtext={netPosition >= 0
                    ? 'Posición financiera positiva'
                    : 'Pasivos superan el disponible'
                }
            />
            <StatCard
                label="Deuda Corto Plazo"
                value={<MoneyDisplay amount={shortTermDebt} />}
                icon={CreditCard}
                accent="warning"
                variant="compact"
                valueSize="lg"
                subtext={`${summary.card_debt > 0 ? `Tarjetas: ${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(summary.card_debt)}` : 'Sin deuda de tarjetas'}${totalUpcoming > 0 ? ` · ${upcoming_maturities.length} vencimientos` : ''}`}
            />
        </div>
    )
}

const accountTypeColors: Record<string, string> = {
    CHECKING: '#00a1e0',
    CREDIT_CARD: '#e6007e',
    LOAN: '#009639',
    CASH: '#ff6900',
    BRIDGE: '#8b5cf6',
    CHECK_PORTFOLIO: '#f59e0b',
    ISSUED_CHECKS: '#ef4444',
}

const accountTypeLabel: Record<string, string> = {
    CHECKING: 'Ctas. Ctes.',
    CREDIT_CARD: 'Tarjetas',
    LOAN: 'Préstamos',
    CASH: 'Efectivo',
    BRIDGE: 'Puente',
    CHECK_PORTFOLIO: 'Cheques Cartera',
    ISSUED_CHECKS: 'Cheques Girados',
}

function AccountPieChart({ accounts }: { accounts: BankOverviewData['accounts'] }) {
    const pieData = accounts.reduce<Record<string, { id: string; label: string; value: number; color: string }>>(
        (acc, acct) => {
            const type = acct.account_type
            if (!acc[type]) {
                acc[type] = {
                    id: type,
                    label: accountTypeLabel[type] || type,
                    value: 0,
                    color: accountTypeColors[type] || '#6b7280',
                }
            }
            acc[type].value += Math.abs(acct.current_balance)
            return acc
        }, {},
    )

    const chartData = Object.values(pieData).filter(d => d.value > 0)

    if (chartData.length === 0) return null

    return (
        <div className="h-[200px]">
            <ResponsivePie
                data={chartData}
                margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                innerRadius={0.55}
                padAngle={2}
                cornerRadius={4}
                activeOuterRadiusOffset={6}
                colors={{ datum: 'data.color' }}
                enableArcLinkLabels={false}
                arcLabelsSkipAngle={15}
                arcLabelsTextColor="#fff"
                arcLabelsRadiusOffset={0.65}
                arcLabel={(d) => `${Math.round(d.arc.angle / 360 * 100)}%`}
                tooltip={({ datum }) => (
                    <div className="bg-popover text-popover-foreground text-xs font-bold px-3 py-2 rounded-md shadow-elevated border">
                        {datum.label}: <MoneyDisplay amount={datum.value} />
                    </div>
                )}
            />
        </div>
    )
}

function AccountSummaryCard({ accounts }: { accounts: BankOverviewData['accounts'] }) {
    const groups = accounts.reduce<Record<string, typeof accounts>>((acc, acct) => {
        const key = acct.account_type
        if (!acc[key]) acc[key] = []
        acc[key].push(acct)
        return acc
    }, {})

    const groupOrder = ['CHECKING', 'CREDIT_CARD', 'LOAN', 'CASH', 'BRIDGE', 'CHECK_PORTFOLIO', 'ISSUED_CHECKS']

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <Landmark className="h-3.5 w-3.5" />
                    Distribución por Tipo de Cuenta
                </CardTitle>
            </CardHeader>
            <CardContent>
                <AccountPieChart accounts={accounts} />
                <div className="space-y-1.5 mt-2">
                    {groupOrder.map((type) => {
                        const group = groups[type]
                        if (!group || group.length === 0) return null
                        const total = group.reduce((sum, a) => sum + a.current_balance, 0)
                        const colorDot = accountTypeColors[type] || '#6b7280'
                        return (
                            <div key={type} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorDot }} />
                                    <span className="text-muted-foreground truncate">
                                        {accountTypeLabel[type] || type}
                                    </span>
                                    <span className="text-muted-foreground/60 font-mono">
                                        ({group.length})
                                    </span>
                                </div>
                                <MoneyDisplay amount={total} />
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}

function RecentActivityCard({ data }: { data: BankOverviewData }) {
    const router = useRouter()
    const { recent_movements } = data

    if (!recent_movements || recent_movements.length === 0) return null

    const top = recent_movements.slice(0, 5)

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <ActivityIcon className="h-3.5 w-3.5" />
                    Actividad Reciente
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                    {top.map((mov) => {
                        const isInbound = mov.movement_type === 'INBOUND'
                        const isOutbound = mov.movement_type === 'OUTBOUND'
                        const DotIcon = isInbound ? TrendingDown : isOutbound ? TrendingUp : ArrowLeftRight
                        const dotColor = isInbound ? 'text-success' : isOutbound ? 'text-destructive' : 'text-muted-foreground'
                        return (
                            <div
                                key={mov.id}
                                role="button"
                                tabIndex={0}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                                onClick={() => router.push(`/treasury/operaciones/movements?selected=${mov.id}`)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/treasury/operaciones/movements?selected=${mov.id}`) } }}
                            >
                                <DotIcon className={`h-3.5 w-3.5 shrink-0 ${dotColor}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium truncate">
                                            {mov.movement_type_display}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                            {new Date(mov.date).toLocaleDateString('es-CL')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                        {mov.from_account_name || mov.to_account_name || mov.display_id}
                                    </p>
                                </div>
                                <MoneyDisplay amount={mov.amount} className="text-xs shrink-0" />
                            </div>
                        )
                    })}
                </div>
                {recent_movements.length > 5 && (
                    <div className="px-4 py-2 border-t border-border/40">
                        <Button
                            variant="link"
                            size="sm"
                            className="text-xs h-auto p-0"
                            onClick={() => router.push('/treasury/operaciones/movements')}
                        >
                            Ver todos los movimientos →
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function MaturitiesCard({ data, bankId }: { data: BankOverviewData; bankId: number }) {
    const router = useRouter()
    const { upcoming_maturities } = data

    if (upcoming_maturities.length === 0) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        Próximos Vencimientos (30 días)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-muted-foreground italic">No hay vencimientos próximos.</p>
                </CardContent>
            </Card>
        )
    }

    const totalUpcoming = upcoming_maturities.reduce((sum, item) => sum + item.amount, 0)
    const top = upcoming_maturities.slice(0, 6)

    const maturityBadge: Record<string, { label: string; variant: 'info' | 'warning' | 'destructive' }> = {
        LOAN_INSTALLMENT: { label: 'Cuota', variant: 'warning' },
        CHECK: { label: 'Cheque', variant: 'info' },
        CARD_STATEMENT: { label: 'Tarjeta', variant: 'destructive' },
    }

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
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Próximos Vencimientos (30 días)
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="px-4 py-2 bg-muted/20 border-b border-border/40">
                    <span className="text-sm font-bold">
                        <MoneyDisplay amount={totalUpcoming} />
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                        en {upcoming_maturities.length} {upcoming_maturities.length === 1 ? 'vencimiento' : 'vencimientos'}
                    </span>
                </div>
                <div className="divide-y divide-border/40">
                    {top.map((item, idx) => {
                        const config = maturityBadge[item.type]
                        return (
                            <div
                                key={idx}
                                role="button"
                                tabIndex={0}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                                onClick={() => handleNavigate(item)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavigate(item) } }}
                            >
                                <Badge
                                    intent={config?.variant || 'neutral'}
                                    size="sm"
                                    className="shrink-0"
                                >
                                    {config?.label || item.type}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium truncate block">
                                        {item.label}
                                    </span>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xs font-bold">
                                        <MoneyDisplay amount={item.amount} />
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {new Date(item.due_date).toLocaleDateString('es-CL')}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                {upcoming_maturities.length > 6 && (
                    <div className="px-4 py-2 border-t border-border/40">
                        <Button
                            variant="link"
                            size="sm"
                            className="text-xs h-auto p-0"
                            onClick={() => router.push(`/treasury/bank-center/${bankId}/loans`)}
                        >
                            +{upcoming_maturities.length - 6} vencimientos más →
                        </Button>
                    </div>
                )}
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
            label: 'Cheques',
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
        {
            label: 'Tarjetas',
            icon: CreditCard,
            onClick: () => router.push(`/treasury/bank-center/${bankId}/cards`),
            variant: 'outline' as const,
        },
    ]

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest">
                    Acciones Rápidas
                </CardTitle>
            </CardHeader>
            <CardContent>
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
                            {action.label}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

function ActivityIcon(props: React.ComponentProps<typeof Receipt>) {
    return <Receipt {...props} />
}

function OverviewContent({ data, bankId }: { data: BankOverviewData; bankId: number }) {
    return (
        <div className="overflow-y-auto custom-scrollbar flex-1">
            <div className="space-y-5">
                <CompactKPIs data={data} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <AccountSummaryCard accounts={data.accounts} />
                    <RecentActivityCard data={data} />
                </div>
                <MaturitiesCard data={data} bankId={bankId} />
                <QuickActions bankId={bankId} />
            </div>
        </div>
    )
}

export function BankCenterDashboard({ bankId, subtab }: { bankId: number; subtab?: string }) {
    const pathname = usePathname()
    const segments = pathname.split('/').filter(Boolean)
    const activeTab = segments[3] || 'overview'
    const queryResult = useBankOverview(bankId)
    const { data, isLoading, isError } = queryResult as { data: BankOverviewData | undefined; isLoading: boolean; isError: boolean }

    if (isLoading && activeTab !== 'cards') {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <Skeleton className="h-72" />
                    <Skeleton className="h-72" />
                </div>
                <Skeleton className="h-48" />
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
