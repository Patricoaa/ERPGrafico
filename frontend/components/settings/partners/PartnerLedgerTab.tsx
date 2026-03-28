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
    Download,
    CreditCard,
    Plus
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

export function PartnerLedgerTab() {
    const [loading, setLoading] = useState(true)
    const [transactions, setTransactions] = useState<any[]>([])
    const [partners, setPartners] = useState<any[]>([])
    const [filterPartner, setFilterPartner] = useState<string>("all")
    const [search, setSearch] = useState("")
    const [isMovementOpen, setIsMovementOpen] = useState(false)

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
        const matchesPartner = filterPartner === "all" || tx.partner?.id?.toString() === filterPartner
        const matchesSearch = !search ||
            tx.description?.toLowerCase().includes(search.toLowerCase()) ||
            tx.partner?.name?.toLowerCase().includes(search.toLowerCase())
        return matchesPartner && matchesSearch
    })

    const getTransactionIcon = (type: string) => {
        if (type.includes('CAPITAL') || type === 'SUBSCRIPTION') return <ArrowUpRight className="h-4 w-4 text-emerald-500" />
        if (type === 'WITHDRAWAL' || type === 'DIVIDEND' || type === 'REDUCTION') return <ArrowDownLeft className="h-4 w-4 text-rose-500" />
        return <History className="h-4 w-4 text-muted-foreground" />
    }

    const getTransactionColor = (type: string) => {
        if (type === 'SUBSCRIPTION') return 'bg-blue-100 text-blue-700 border-blue-200'
        if (type.includes('TRANSFER')) return 'bg-amber-100 text-amber-700 border-amber-200'
        if (type === 'CAPITAL_CASH' || type === 'CAPITAL_INVENTORY') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
        if (type === 'WITHDRAWAL' || type === 'DIVIDEND') return 'bg-rose-100 text-rose-700 border-rose-200'
        return 'bg-muted text-muted-foreground border-transparent'
    }

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
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => {
                                    setFilterPartner("all")
                                    setSearch("")
                                }}
                            >
                                <Filter className="h-4 w-4" />
                            </Button>
                            <Button
                                className="h-10"
                                onClick={() => setIsMovementOpen(true)}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Registrar Aporte/Retiro
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
                            Detalle de Movimientos (Libro Auxiliar)
                        </CardTitle>
                        <CardDescription>Historial cronológico de capital comprometido vs pagado</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase">
                        <Download className="h-3 w-3 mr-1" /> Exportar
                    </Button>
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
                                            {tx.journal_entry ? (
                                                <Badge variant="secondary" className="text-[9px] font-mono hover:bg-muted cursor-default">
                                                    {tx.journal_entry.display_id || tx.journal_entry.number}
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
                    </Table>
                </CardContent>
            </IndustrialCard>

            {/* Balances Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {partners.filter(p => filterPartner === "all" || p.id.toString() === filterPartner).map(p => (
                    <IndustrialCard key={p.id} variant="industrial" className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2 h-auto">
                            <CardTitle className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-widest">
                                Saldo: {p.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-xl font-black font-mono ${p.partner_balance > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {formatCurrency(p.partner_balance)}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-[9px] font-bold uppercase opacity-60">Suscrito: {formatCurrency(p.partner_total_contributions)}</span>
                                <span className="text-[9px] font-bold uppercase text-rose-500 bg-rose-50 px-1 rounded">Pendiente: {formatCurrency(p.partner_pending_capital)}</span>
                            </div>
                        </CardContent>
                    </IndustrialCard>
                ))}
            </div>

            {/* Movement Wizard Modal */}
            <CashMovementModal
                open={isMovementOpen}
                onOpenChange={setIsMovementOpen}
                onSuccess={fetchData}
            />
        </div>
    )
}
