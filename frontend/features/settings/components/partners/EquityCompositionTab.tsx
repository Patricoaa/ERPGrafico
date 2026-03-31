"use client"

import React, { useEffect, useState } from "react"
import { 
    Banknote, 
    TrendingUp, 
    Plus, 
    ArrowRightLeft, 
    AlertCircle,
    Loader2,
    PieChart,
    Building2,
    Info,
    UserPlus,
    MoreHorizontal,
    Wallet,
    LogOut
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IndustrialCard } from "@/components/ui/IndustrialCard"
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
import { 
    SubscriptionMovementModal, 
    EquityTransferModal, 
    CapitalContributionModal, 
    ProvisionalWithdrawalModal 
} from "@/features/settings/components/partners/EquityMovementModals"
import { AddPartnerModal } from "@/features/settings/components/partners/AddPartnerModal"
import { InitialCapitalModal } from "@/features/settings/components/InitialCapitalModal"

export function EquityCompositionTab() {
    const [loading, setLoading] = useState(true)
    const [partners, setPartners] = useState<any[]>([])
    const [summary, setSummary] = useState<any>(null)
    const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false)
    const [isTransferOpen, setIsTransferOpen] = useState(false)
    const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(false)
    const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false)
    
    // Custom action modals
    const [isContributionOpen, setIsContributionOpen] = useState(false)
    const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)

    // NEW: Modal pre-filling state
    const [subModalParams, setSubModalParams] = useState({
        partnerId: undefined as string | undefined,
        amount: undefined as string | undefined
    })

    const fetchData = async () => {
        setLoading(true)
        try {
            const [pData, sData] = await Promise.all([
                partnersApi.getPartners(),
                partnersApi.getSummary()
            ])
            setPartners(pData)
            setSummary(sData)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar datos societarios")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
                <Skeleton className="h-[400px] w-full" />
            </div>
        )
    }

    const hasPartners = partners.length > 0

    return (
        <div className="space-y-6">
            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <IndustrialCard variant="industrial">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
                            Capital Suscrito Total
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono">
                            {formatCurrency(summary?.total_capital || 0)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Compromiso legal de aportes
                        </p>
                    </CardContent>
                </IndustrialCard>

                <IndustrialCard variant="industrial">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
                            Capital Enterado (Pagado)
                            <PieChart className="h-4 w-4 text-emerald-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600 font-mono">
                            {formatCurrency(summary?.total_paid_in || 0)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Efectivamente pagado por socios
                        </p>
                        {summary?.total_capital > 0 && (
                            <div className="mt-2 w-full h-1 bg-muted rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 rounded-full" 
                                    style={{ width: `${Math.min(100, Math.round((summary.total_paid_in / summary.total_capital) * 100))}%` }}
                                />
                            </div>
                        )}
                    </CardContent>
                </IndustrialCard>

                <IndustrialCard variant="industrial">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
                            Capital por Cobrar
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-amber-600">
                            {formatCurrency(summary?.total_pending || 0)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Aportes pendientes de ingreso
                        </p>
                    </CardContent>
                </IndustrialCard>

                <IndustrialCard variant="industrial">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
                            Patrimonio Neto Socios
                            <Building2 className="h-4 w-4 text-primary" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold font-mono text-primary">
                            {formatCurrency(summary?.total_net_equity || 0)}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Valor libro total de la propiedad
                        </p>
                    </CardContent>
                </IndustrialCard>
            </div>

            {/* Actions & Table */}
            <IndustrialCard variant="industrial" className="border-t-primary">
                <CardHeader className="flex flex-row items-center justify-between pb-6">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Composición del Capital Social
                        </CardTitle>
                        <CardDescription>Distribución de acciones y componentes patrimoniales</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {!hasPartners ? (
                            <Button 
                                onClick={() => setIsInitialSetupOpen(true)}
                                className="bg-primary hover:bg-primary/90 shadow-md"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Configuración Inicial
                            </Button>
                        ) : (
                            <>
                                <Button 
                                    variant="outline"
                                    onClick={() => setIsAddPartnerOpen(true)}
                                    className="border-primary/20 hover:bg-primary/5 text-primary"
                                >
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Añadir Socio
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setIsSubscriptionOpen(true)}
                                    className="border-muted hover:bg-muted/50"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Aumento / Reducción
                                </Button>
                                <Button 
                                    variant="outline"
                                    onClick={() => setIsTransferOpen(true)}
                                    className="border-blue-200 hover:bg-blue-50 text-primary"
                                >
                                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                                    Transferencia
                                </Button>
                            </>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="text-[10px] font-bold uppercase pl-6">Socio</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right">Part. %</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right">C. Suscrito</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right">C. Enterado</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right">Pendiente</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right text-rose-600">Retiros Prov.</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right text-emerald-600">Utilidades</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right pr-6 text-primary">Patrimonio Neto</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {hasPartners ? (
                                partners.map((partner) => (
                                    <TableRow key={partner.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="pl-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm">{partner.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{partner.tax_id}</span>
                                                
                                                {partner.partner_excess_capital > 0 && (
                                                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded flex items-center justify-between gap-2 animate-pulse hover:animate-none">
                                                        <div className="flex items-center gap-1.5 text-[10px] text-amber-700 font-medium">
                                                            <AlertCircle className="h-3 w-3" />
                                                            Exceso: +{formatCurrency(partner.partner_excess_capital)}
                                                        </div>
                                                        <Button 
                                                            variant="link" 
                                                            size="sm" 
                                                            className="h-auto p-0 text-[10px] font-bold text-amber-800 hover:text-amber-900 underline"
                                                            onClick={() => {
                                                                setSubModalParams({
                                                                    partnerId: partner.id.toString(),
                                                                    amount: partner.partner_excess_capital.toString()
                                                                })
                                                                setIsSubscriptionOpen(true)
                                                            }}
                                                        >
                                                            Formalizar
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                {partner.partner_equity_percentage}%
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs font-semibold">
                                            {formatCurrency(partner.partner_total_contributions)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-emerald-600">
                                            {formatCurrency(partner.partner_total_paid_in)}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono text-xs ${parseFloat(partner.partner_pending_capital) > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                            {formatCurrency(partner.partner_pending_capital)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-rose-600">
                                            ({formatCurrency(partner.partner_provisional_withdrawals_balance)})
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-emerald-600">
                                            {formatCurrency(partner.partner_earnings_balance)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs font-bold pr-6">
                                            {formatCurrency(partner.partner_net_equity)}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuLabel>Operaciones Rápidas</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem 
                                                        className="text-emerald-600 font-medium"
                                                        onClick={() => {
                                                            setIsContributionOpen(true)
                                                        }}
                                                    >
                                                        <Wallet className="h-4 w-4 mr-2" />
                                                        Registrar Aporte
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem 
                                                        className="text-rose-600 font-medium"
                                                        onClick={() => {
                                                            setIsWithdrawalOpen(true)
                                                        }}
                                                    >
                                                        <LogOut className="h-4 w-4 mr-2" />
                                                        Registrar Retiro
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground uppercase text-[10px] italic">
                                        No se han configurado socios todavía.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </IndustrialCard>

            {/* Info Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 items-start">
                <Info className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-xs text-primary leading-relaxed">
                    <p className="font-bold mb-1">Nota sobre la Composición Societaria:</p>
                    Esta tabla muestra la <strong>participación formal</strong> según los libros de capital. 
                    Los aumentos o transferencias aquí registrados generan asientos contables automáticos contra la cuenta de Capital Social. 
                    Para ver los aportes de capital pendientes (efectivo/bienes), consulte la pestaña <strong>Libro Auxiliar</strong>.
                </div>
            </div>

            {/* Modals */}
            <SubscriptionMovementModal 
                open={isSubscriptionOpen} 
                onOpenChange={(open) => {
                    setIsSubscriptionOpen(open)
                    if (!open) setSubModalParams({ partnerId: undefined, amount: undefined })
                }}
                onSuccess={fetchData}
                initialPartnerId={subModalParams.partnerId}
                initialAmount={subModalParams.amount}
            />
            <EquityTransferModal 
                open={isTransferOpen} 
                onOpenChange={setIsTransferOpen}
                onSuccess={fetchData}
            />
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
            <AddPartnerModal 
                open={isAddPartnerOpen}
                onOpenChange={setIsAddPartnerOpen}
                onSuccess={fetchData}
            />
            <InitialCapitalModal 
                open={isInitialSetupOpen}
                onOpenChange={setIsInitialSetupOpen}
                onSuccess={() => {
                    fetchData()
                }}
            />
        </div>
    )
}
