"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import {
    Banknote, Landmark, ArrowLeftRight, FileCheck,
    CreditCard, Vault, Plus, ArrowRight, Eye,
    TrendingUp, TrendingDown, RefreshCw
} from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { TransferModal } from "@/components/treasury/TransferModal"
import { CashMovementModal } from "@/components/treasury/CashMovementModal"

interface TreasuryStats {
    bank_total: number
    cash_total: number
    total_available: number
}

interface TreasuryAccount {
    id: number
    name: string
    account_type: 'BANK' | 'CASH'
    current_balance: number
    currency: string
}

interface Transaction {
    id: number
    source: 'PAYMENT' | 'CASH_MOVEMENT'
    type: string
    date: string
    amount: number
    description: string
    treasury_account_name: string
    partner_name: string | null
    reference: string
    is_internal: boolean
}

export default function TreasuryPage() {
    const [stats, setStats] = useState<TreasuryStats | null>(null)
    const [accounts, setAccounts] = useState<TreasuryAccount[]>([])
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [transferOpen, setTransferOpen] = useState(false)
    const [movementOpen, setMovementOpen] = useState(false)
    const [selectedTx, setSelectedTx] = useState<{ id: number, type: 'payment' | 'cash_movement' }>({ id: 0, type: 'payment' })

    const fetchData = async () => {
        try {
            setLoading(true)
            const [statsRes, accountsRes, txRes] = await Promise.all([
                api.get('/treasury/dashboard/stats/'),
                api.get('/treasury/dashboard/accounts/'),
                api.get('/treasury/dashboard/')
            ])
            setStats(statsRes.data)
            setAccounts(accountsRes.data)
            setTransactions(txRes.data)
        } catch (error) {
            console.error("Failed to fetch treasury data", error)
            toast.error("Error al cargar datos de tesorería")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleViewDetails = (id: number, source: 'PAYMENT' | 'CASH_MOVEMENT') => {
        setSelectedTx({
            id,
            type: source === 'PAYMENT' ? 'payment' : 'cash_movement'
        })
        setDetailsOpen(true)
    }

    const columns: ColumnDef<Transaction>[] = [
        {
            accessorKey: "date",
            header: "Fecha",
            cell: ({ row }) => {
                const date = new Date(row.getValue("date"))
                return <span className="text-xs">{date.toLocaleDateString()}</span>
            }
        },
        {
            accessorKey: "type",
            header: "Tipo",
            cell: ({ row }) => {
                const type = row.getValue("type") as string
                const source = row.original.source
                return (
                    <div className="flex flex-col">
                        <span className="text-xs font-medium">{type}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{source}</span>
                    </div>
                )
            }
        },
        {
            accessorKey: "description",
            header: "Descripción",
            cell: ({ row }) => (
                <div className="flex flex-col max-w-[300px]">
                    <span className="text-xs truncate font-medium">{row.getValue("description")}</span>
                    <span className="text-[10px] text-muted-foreground truncate italic">
                        {row.original.partner_name || row.original.reference}
                    </span>
                </div>
            )
        },
        {
            accessorKey: "treasury_account_name",
            header: "Cuenta",
            cell: ({ row }) => <span className="text-xs font-bold text-muted-foreground">{row.getValue("treasury_account_name")}</span>
        },
        {
            accessorKey: "amount",
            header: () => <div className="text-right">Monto</div>,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"))
                const isInternal = row.original.is_internal
                const colorClass = isInternal ? 'text-blue-600' : (amount > 0 ? 'text-emerald-600' : 'text-red-600')
                return <div className={`text-right font-bold font-mono ${colorClass}`}>{formatCurrency(Math.abs(amount))}</div>
            }
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleViewDetails(row.original.id, row.original.source)}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    ]

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Tesorería</h2>
                    <p className="text-muted-foreground">Vista general de flujos y estados de cuenta.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={fetchData} variant="outline" size="icon" disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Link href="/treasury/accounts">
                        <Button variant="outline">Ver Cuentas</Button>
                    </Link>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-200 dark:border-blue-900 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Saldos Bancarios</CardTitle>
                        <Landmark className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tighter text-blue-700 dark:text-blue-400">
                            {formatCurrency(stats?.bank_total || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total en todas las cuentas bancarias</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background border-emerald-200 dark:border-emerald-900 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Efectivo en Caja</CardTitle>
                        <Banknote className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tighter text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(stats?.cash_total || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Disponibilidad inmediata física</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 text-white shadow-xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium opacity-80">Total Disponible</CardTitle>
                        <Vault className="h-4 w-4 text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black tracking-tighter text-amber-400">
                            {formatCurrency(stats?.total_available || 0)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-amber-400"
                                    style={{ width: `${stats ? (stats.cash_total / stats.total_available) * 100 : 0}%` }}
                                />
                            </div>
                            <span className="text-[10px] opacity-70">Mix Caja/Bancos</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-7">
                {/* Accounts List */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center justify-between">
                            Cuentas Individuales
                            <Link href="/treasury/accounts">
                                <Button variant="ghost" size="sm" className="text-xs">Ver más</Button>
                            </Link>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {accounts.map(acc => (
                            <div key={acc.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${acc.account_type === 'BANK' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                        {acc.account_type === 'BANK' ? <Landmark className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold leading-none">{acc.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">{acc.account_type === 'BANK' ? 'Cuenta Bancaria' : 'Fondo de Efectivo'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-mono font-bold ${acc.current_balance < 0 ? 'text-red-600' : ''}`}>
                                        {formatCurrency(acc.current_balance)}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground uppercase">{acc.currency}</p>
                                </div>
                            </div>
                        ))}
                        {accounts.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">No hay cuentas configuradas</p>}
                    </CardContent>
                </Card>

                {/* Recent Feed */}
                <Card className="lg:col-span-4 flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">Últimos Movimientos</CardTitle>
                        <div className="flex gap-2">
                            <Link href="/treasury/movements">
                                <Button variant="outline" size="sm" className="h-8 text-xs">Ver todos</Button>
                            </Link>
                            <Button size="sm" className="h-8 text-xs gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800" variant="outline" onClick={() => setMovementOpen(true)}>
                                <Plus className="h-3 w-3" /> Movimiento
                            </Button>
                            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setTransferOpen(true)}>
                                <ArrowLeftRight className="h-3 w-3" /> Traspaso
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <DataTable
                                columns={columns}
                                data={transactions}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            <TransactionViewModal
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                type={selectedTx.type}
                id={selectedTx.id}
                view="details"
            />

            <TransferModal
                open={transferOpen}
                onOpenChange={setTransferOpen}
                onSuccess={fetchData}
            />

            <CashMovementModal
                open={movementOpen}
                onOpenChange={setMovementOpen}
                onSuccess={fetchData}
            />
        </div>
    )
}
