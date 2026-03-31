"use client"

import React, { useEffect, useState } from "react"
import {
    History,
    Filter,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    Calendar,
    Search,
    Plus,
    Package
} from "lucide-react"
import { IndustrialCard } from "@/components/shared/IndustrialCard"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { toast } from "sonner"
import { formatCurrency, formatPlainDate as formatDate } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InventoryContributionModal } from "@/components/settings/partners/InventoryContributionModal"
import { CapitalContributionModal, ProvisionalWithdrawalModal } from "@/components/settings/partners/EquityMovementModals"

const TRANSACTION_TYPE_OPTIONS = [
    { value: "all", label: "Todos los tipos" },
    { value: "SUBSCRIPTION", label: "Suscripción de Capital" },
    { value: "REDUCTION", label: "Reducción de Capital" },
    { value: "CAPITAL_CASH", label: "Aporte Efectivo" },
    { value: "CAPITAL_INVENTORY", label: "Aporte en Bienes" },
    { value: "PROV_WITHDRAWAL", label: "Retiro Provisorio (Anticipo)" },
    { value: "WITHDRAWAL", label: "Retiro de Utilidades" },
    { value: "DIVIDEND", label: "Distribución (Asignación)" },
    { value: "DIVIDEND_PAY", label: "Pago de Dividendo" },
    { value: "REINVESTMENT", label: "Reinversión de Utilidades" },
    { value: "RETAINED", label: "Utilidades Retenidas" },
    { value: "LOSS_ABSORB", label: "Absorción de Pérdidas" },
    { value: "TRANSFER_IN", label: "Transferencia (Ingreso)" },
    { value: "TRANSFER_OUT", label: "Transferencia (Egreso)" },
]

export function PartnerLedgerTab() {
    const [loading, setLoading] = useState(true)
    const [transactions, setTransactions] = useState<any[]>([])
    const [partners, setPartners] = useState<any[]>([])
    const [filterPartner, setFilterPartner] = useState<string>("all")
    const [filterType, setFilterType] = useState<string>("all")
    const [search, setSearch] = useState("")
    
    // Movement Modals
    const [isContributionOpen, setIsContributionOpen] = useState(false)
    const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)
    const [isInventoryOpen, setIsInventoryOpen] = useState(false)

    const fetchData = async () => {
        setLoading(true)
        try {
            const [pData, tData] = await Promise.all([
                partnersApi.getPartners(),
                partnersApi.getTransactions()
            ])
            setPartners(pData)
            setTransactions(tData)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar el libro auxiliar")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    if (loading) {
        return <Skeleton className="h-[500px] w-full" />
    }

    // Identify Inflow vs Outflow types for UI and Balance
    const isInflow = (type: string) => [
        'SUBSCRIPTION', 'CAPITAL_CASH', 'CAPITAL_INVENTORY', 
        'TRANSFER_IN', 'REINVESTMENT', 'RETAINED'
    ].includes(type)
    
    const isOutflow = (type: string) => [
        'WITHDRAWAL', 'PROV_WITHDRAWAL', 'REDUCTION', 
        'TRANSFER_OUT', 'LOSS_ABSORB', 'DIVIDEND_PAY'
    ].includes(type)

    // Calculate Running Balance and filter
    // To calculate a true running balance, we sort by date ASC
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    let runningBalance = 0
    const txsWithBalance = sortedTxs.map(tx => {
        const amount = parseFloat(tx.amount) || 0
        if (isInflow(tx.transaction_type)) {
            runningBalance += amount
        } else if (isOutflow(tx.transaction_type)) {
            runningBalance -= amount
        }
        return { ...tx, balance_after: runningBalance }
    })

    // Now filter the result for display (usually newest first in table)
    const filteredTxs = txsWithBalance.reverse().filter(tx => {
        const matchesPartner = filterPartner === "all" || tx.partner?.toString() === filterPartner
        const matchesType = filterType === "all" || tx.transaction_type === filterType
        const matchesSearch = !search ||
            tx.description?.toLowerCase().includes(search.toLowerCase()) ||
            tx.partner_name?.toLowerCase().includes(search.toLowerCase())
        return matchesPartner && matchesType && matchesSearch
    })

    const getTransactionIcon = (type: string) => {
        if (isInflow(type)) return <ArrowUpRight className="h-4 w-4 text-emerald-500" />
        if (isOutflow(type)) return <ArrowDownLeft className="h-4 w-4 text-rose-500" />
        return <History className="h-4 w-4 text-muted-foreground" />
    }

    const getTransactionColor = (type: string) => {
        if (type === 'SUBSCRIPTION') return 'bg-blue-100 text-blue-700 border-blue-200'
        if (type.includes('TRANSFER')) return 'bg-amber-100 text-amber-700 border-amber-200'
        if (type === 'CAPITAL_CASH' || type === 'CAPITAL_INVENTORY' || type === 'REINVESTMENT' || type === 'RETAINED') 
            return 'bg-emerald-100 text-emerald-700 border-emerald-200'
        if (isOutflow(type)) return 'bg-rose-100 text-rose-700 border-rose-200'
        return 'bg-muted text-muted-foreground border-transparent'
    }

    const hasActiveFilters = filterPartner !== "all" || filterType !== "all" || search !== ""

    // Total summary for footer (based on filtered set)
    const totals = filteredTxs.reduce((acc, tx) => {
        const amount = parseFloat(tx.amount) || 0
        if (isInflow(tx.transaction_type)) acc.inflows += amount
        else if (isOutflow(tx.transaction_type)) acc.outflows += amount
        return acc
    }, { inflows: 0, outflows: 0 })

    return (
        <div className="space-y-6">
            {/* Filter Bar */}
            <IndustrialCard variant="industrial">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Filtrar por Socio</label>
                            <Select value={filterPartner} onValueChange={setFilterPartner}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Todos los socios" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los socios</SelectItem>
                                    {partners.map(p => (
                                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Tipo de Movimiento</label>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Todos los tipos" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TRANSACTION_TYPE_OPTIONS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Búsqueda</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    className="pl-9 h-10"
                                    placeholder="Concepto o descripción..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {hasActiveFilters && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10"
                                    onClick={() => {
                                        setFilterPartner("all")
                                        setFilterType("all")
                                        setSearch("")
                                    }}
                                    title="Limpiar filtros"
                                >
                                    <Filter className="h-4 w-4" />
                                </Button>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button className="h-10">
                                        <Wallet className="h-4 w-4 mr-2" />
                                        Movimiento de Caja
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 font-mono text-xs">
                                    <DropdownMenuLabel>Operaciones de Tesorería</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setIsContributionOpen(true)} className="gap-2 cursor-pointer font-medium text-emerald-600 focus:text-emerald-700">
                                        <ArrowUpRight className="h-4 w-4" />
                                        <span>Registrar Aporte Efectivo</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsWithdrawalOpen(true)} className="gap-2 cursor-pointer font-medium text-rose-600 focus:text-rose-700">
                                        <ArrowDownLeft className="h-4 w-4" />
                                        <span>Registrar Retiro Socio</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                                variant="outline"
                                className="h-10 border-amber-200 hover:bg-amber-50 text-amber-700"
                                onClick={() => setIsInventoryOpen(true)}
                            >
                                <Package className="h-4 w-4 mr-2" />
                                Aporte/Retiro Bienes
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </IndustrialCard>

            {/* Ledger Table */}
            <IndustrialCard variant="industrial" className="border-t-primary">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Libro Auxiliar de Socios
                            {hasActiveFilters && (
                                <Badge variant="secondary" className="text-[9px] ml-2 font-mono">
                                    {filteredTxs.length} de {transactions.length}
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>Trazabilidad cronológica de aportes, retiros y utilidades</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="text-[10px] font-bold uppercase pl-6">Fecha</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Socio</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Tipo y Concepto</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right">Referencia</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right">Monto</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right pr-6 text-primary">Saldo</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTxs.length > 0 ? (
                                filteredTxs.map((tx) => (
                                    <TableRow key={tx.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="pl-6 py-4">
                                            <div className="flex items-center gap-2 text-xs font-medium">
                                                <Calendar className="h-3 w-3 opacity-40" />
                                                {formatDate(tx.date)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs font-bold">{tx.partner_name}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <Badge variant="outline" className={`text-[9px] font-bold uppercase w-fit h-5 px-1 ${getTransactionColor(tx.transaction_type)}`}>
                                                    {tx.transaction_type_display}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground max-w-[200px] truncate">{tx.description}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {tx.journal_entry_display ? (
                                                <Button variant="ghost" className="h-6 px-2 text-[10px] font-mono hover:bg-primary/10 hover:text-primary transition-all">
                                                    {tx.journal_entry_display}
                                                </Button>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs font-bold">
                                            <div className="flex items-center justify-end gap-1">
                                                {getTransactionIcon(tx.transaction_type)}
                                                <span className={isOutflow(tx.transaction_type) ? 'text-rose-600' : 'text-emerald-600'}>
                                                    {isOutflow(tx.transaction_type) ? '-' : '+'}{formatCurrency(tx.amount)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6 font-mono text-xs font-bold text-primary bg-primary/5">
                                            {formatCurrency(tx.balance_after)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground uppercase text-[10px] italic">
                                        No hay movimientos registrados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        {/* Accumulated Totals */}
                        {filteredTxs.length > 0 && (
                            <tfoot>
                                <TableRow className="bg-muted/30 font-bold border-t-2">
                                    <TableCell colSpan={3} className="pl-6 text-[10px] font-extrabold uppercase text-muted-foreground leading-tight">
                                        Totales de la Selección<br/>
                                        <span className="text-[9px] font-medium italic">({filteredTxs.length} movimientos)</span>
                                    </TableCell>
                                    <TableCell className="text-right text-[10px] font-bold uppercase pr-4">
                                        <div className="flex flex-col justify-end">
                                            <span className="text-emerald-600">Ingresos (+)</span>
                                            <span className="text-rose-600">Retiros (-)</span>
                                            <span className="text-primary border-t border-muted-foreground/20 mt-0.5 pt-0.5">Saldo Neto</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs pr-4">
                                        <div className="flex flex-col justify-end">
                                            <span className="text-emerald-600">+{formatCurrency(totals.inflows)}</span>
                                            <span className="text-rose-600">-{formatCurrency(totals.outflows)}</span>
                                            <span className="text-primary border-t border-muted-foreground/20 mt-0.5 pt-0.5 font-extrabold">{formatCurrency(totals.inflows - totals.outflows)}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="bg-primary/10 text-right pr-6 font-mono text-sm font-black text-primary">
                                        {formatCurrency(filteredTxs[0].balance_after)}
                                    </TableCell>
                                </TableRow>
                            </tfoot>
                        )}
                    </Table>
                </CardContent>
            </IndustrialCard>

            {/* Movement Wizard Modal */}
            <CapitalContributionModal 
                open={isContributionOpen}
                onOpenChange={setIsContributionOpen}
                onSuccess={fetchData}
            />
            
            <ProvisionalWithdrawalModal 
                open={isWithdrawalOpen}
                onOpenChange={setIsWithdrawalOpen}
                onSuccess={fetchData}
            />

            <InventoryContributionModal
                open={isInventoryOpen}
                onOpenChange={setIsInventoryOpen}
                onSuccess={fetchData}
            />
        </div>
    )
}
