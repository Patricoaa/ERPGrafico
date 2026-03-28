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
import { CashMovementModal } from "@/features/treasury/components/CashMovementModal"
import { InventoryContributionModal } from "@/components/settings/partners/InventoryContributionModal"

const TRANSACTION_TYPE_OPTIONS = [
    { value: "all", label: "Todos los tipos" },
    { value: "SUBSCRIPTION", label: "Suscripción" },
    { value: "REDUCTION", label: "Reducción" },
    { value: "CAPITAL_CASH", label: "Aporte Efectivo" },
    { value: "CAPITAL_INVENTORY", label: "Aporte en Bienes" },
    { value: "WITHDRAWAL", label: "Retiro" },
    { value: "DIVIDEND", label: "Dividendos" },
    { value: "LOAN_IN", label: "Préstamo de Socio" },
    { value: "LOAN_OUT", label: "Préstamo a Socio" },
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
    const [isMovementOpen, setIsMovementOpen] = useState(false)
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

    const filteredTxs = transactions.filter(tx => {
        const matchesPartner = filterPartner === "all" || tx.partner?.toString() === filterPartner
        const matchesType = filterType === "all" || tx.transaction_type === filterType
        const matchesSearch = !search ||
            tx.description?.toLowerCase().includes(search.toLowerCase()) ||
            tx.partner_name?.toLowerCase().includes(search.toLowerCase())
        return matchesPartner && matchesType && matchesSearch
    })

    // Accumulated totals
    const totals = filteredTxs.reduce((acc, tx) => {
        const amount = parseFloat(tx.amount) || 0
        const type = tx.transaction_type
        if (type === 'SUBSCRIPTION' || type === 'CAPITAL_CASH' || type === 'CAPITAL_INVENTORY' || type === 'TRANSFER_IN') {
            acc.inflows += amount
        } else if (type === 'WITHDRAWAL' || type === 'REDUCTION' || type === 'TRANSFER_OUT') {
            acc.outflows += amount
        }
        return acc
    }, { inflows: 0, outflows: 0 })

    const getTransactionIcon = (type: string) => {
        if (type.includes('CAPITAL') || type === 'SUBSCRIPTION' || type === 'TRANSFER_IN') return <ArrowUpRight className="h-4 w-4 text-emerald-500" />
        if (type === 'WITHDRAWAL' || type === 'DIVIDEND' || type === 'REDUCTION' || type === 'TRANSFER_OUT') return <ArrowDownLeft className="h-4 w-4 text-rose-500" />
        return <History className="h-4 w-4 text-muted-foreground" />
    }

    const getTransactionColor = (type: string) => {
        if (type === 'SUBSCRIPTION') return 'bg-blue-100 text-blue-700 border-blue-200'
        if (type.includes('TRANSFER')) return 'bg-amber-100 text-amber-700 border-amber-200'
        if (type === 'CAPITAL_CASH' || type === 'CAPITAL_INVENTORY') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
        if (type === 'WITHDRAWAL' || type === 'DIVIDEND') return 'bg-rose-100 text-rose-700 border-rose-200'
        if (type === 'REDUCTION') return 'bg-orange-100 text-orange-700 border-orange-200'
        return 'bg-muted text-muted-foreground border-transparent'
    }

    const hasActiveFilters = filterPartner !== "all" || filterType !== "all" || search !== ""

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
                            <Button
                                className="h-10"
                                onClick={() => setIsMovementOpen(true)}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Aporte/Retiro Efectivo
                            </Button>
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
                            Detalle de Movimientos
                            {hasActiveFilters && (
                                <Badge variant="secondary" className="text-[9px] ml-2">
                                    {filteredTxs.length} de {transactions.length}
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription>Historial cronológico de capital comprometido vs pagado</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="text-[10px] font-bold uppercase pl-6">Fecha</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Socio</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Tipo</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Descripción</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right">Referencia</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right pr-6">Monto</TableHead>
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
                                            <Badge variant="outline" className={`text-[9px] font-bold uppercase h-5 ${getTransactionColor(tx.transaction_type)}`}>
                                                {tx.transaction_type_display}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs max-w-xs truncate">
                                            {tx.description}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {tx.journal_entry_display ? (
                                                <Badge variant="secondary" className="text-[9px] font-mono hover:bg-muted cursor-default">
                                                    {tx.journal_entry_display}
                                                </Badge>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right pr-6 font-mono font-bold">
                                            <div className="flex items-center justify-end gap-1">
                                                {getTransactionIcon(tx.transaction_type)}
                                                {formatCurrency(tx.amount)}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground uppercase text-[10px] italic">
                                        No hay movimientos registrados para los criterios seleccionados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        {/* Accumulated Totals */}
                        {filteredTxs.length > 0 && (
                            <tfoot>
                                <TableRow className="bg-muted/30 font-bold border-t-2">
                                    <TableCell colSpan={4} className="pl-6 text-[10px] font-extrabold uppercase text-muted-foreground">
                                        Totales ({filteredTxs.length} movimientos)
                                    </TableCell>
                                    <TableCell className="text-right text-[10px] font-extrabold uppercase">
                                        <div className="space-y-0.5">
                                            <div className="text-emerald-600">Ingresos</div>
                                            <div className="text-rose-600">Egresos</div>
                                            <div className="text-primary border-t pt-0.5">Neto</div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6 font-mono">
                                        <div className="space-y-0.5">
                                            <div className="text-emerald-600 font-bold">+{formatCurrency(totals.inflows)}</div>
                                            <div className="text-rose-600 font-bold">-{formatCurrency(totals.outflows)}</div>
                                            <div className="text-primary font-extrabold border-t pt-0.5">{formatCurrency(totals.inflows - totals.outflows)}</div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </tfoot>
                        )}
                    </Table>
                </CardContent>
            </IndustrialCard>

            {/* Movement Wizard Modal */}
            <CashMovementModal
                open={isMovementOpen}
                onOpenChange={setIsMovementOpen}
                onSuccess={fetchData}
                variant="partners"
            />

            {/* Inventory Contribution Modal */}
            <InventoryContributionModal
                open={isInventoryOpen}
                onOpenChange={setIsInventoryOpen}
                onSuccess={fetchData}
            />
        </div>
    )
}
