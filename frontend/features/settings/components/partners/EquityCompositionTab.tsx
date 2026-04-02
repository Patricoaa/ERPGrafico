"use client"

import React, { useEffect, useState } from "react"
import { 
    TrendingUp, 
    Plus, 
    ArrowRightLeft, 
    AlertCircle,
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
import { IndustrialCard } from "@/components/shared/IndustrialCard"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
    TableRow, 
    TableCell 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { toast } from "sonner"
import { formatCurrency, cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { 
    SubscriptionMovementModal, 
    EquityTransferModal, 
    CapitalContributionModal, 
    ProvisionalWithdrawalModal 
} from "@/features/settings/components/partners/EquityMovementModals"
import { AddPartnerModal } from "@/features/settings/components/partners/AddPartnerModal"
import { InitialCapitalModal } from "@/features/settings/components/InitialCapitalModal"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"

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

    // Modal pre-filling state
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full rounded-[0.25rem]" />)}
                </div>
                <Skeleton className="h-[400px] w-full rounded-[0.25rem]" />
            </div>
        )
    }

    const hasPartners = partners.length > 0

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "name",
            header: "Socio",
            cell: ({ row }) => (
                <div className="flex flex-col gap-1 py-1 max-w-[220px]">
                    <span className="font-black text-[12px] tracking-tight uppercase leading-none">{row.original.name}</span>
                    <span className="text-[9px] font-mono opacity-50">{row.original.tax_id}</span>
                    
                    {row.original.partner_excess_capital > 0 && (
                        <div className="mt-1.5 p-1.5 bg-amber-100/50 border border-amber-200/50 rounded-[0.125rem] flex items-center justify-between gap-2 overflow-hidden ring-1 ring-amber-500/10">
                            <div className="flex items-center gap-1.5 text-[8px] text-amber-800 font-black uppercase tracking-tighter">
                                <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                                Exceso: +{formatCurrency(row.original.partner_excess_capital)}
                            </div>
                            <Button 
                                variant="link" 
                                size="sm" 
                                className="h-3 p-0 text-[8px] font-black text-amber-900 hover:text-amber-600 underline uppercase tracking-widest leading-none"
                                onClick={() => {
                                    setSubModalParams({
                                        partnerId: row.original.id.toString(),
                                        amount: row.original.partner_excess_capital.toString()
                                    })
                                    setIsSubscriptionOpen(true)
                                }}
                            >
                                Formalizar
                            </Button>
                        </div>
                    )}
                </div>
            )
        },
        {
            accessorKey: "partner_equity_percentage",
            header: () => <div className="text-right">Part. %</div>,
            cell: ({ row }) => (
                <div className="text-right">
                    <Badge variant="outline" className="font-mono text-[10px] h-5 rounded-[0.125rem] border-primary/20 bg-primary/5 text-primary font-black">
                        {row.getValue("partner_equity_percentage")}%
                    </Badge>
                </div>
            )
        },
        {
            accessorKey: "partner_total_contributions",
            header: () => <div className="text-right whitespace-nowrap">C. Suscrito</div>,
            cell: ({ row }) => (
                <div className="text-right font-mono text-[11px] font-bold opacity-80">
                    {formatCurrency(row.getValue("partner_total_contributions"))}
                </div>
            )
        },
        {
            accessorKey: "partner_total_paid_in",
            header: () => <div className="text-right whitespace-nowrap">C. Enterado</div>,
            cell: ({ row }) => (
                <div className="text-right font-mono text-[11px] font-black text-emerald-600">
                    {formatCurrency(row.getValue("partner_total_paid_in"))}
                </div>
            )
        },
        {
            accessorKey: "partner_pending_capital",
            header: () => <div className="text-right">Pendiente</div>,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("partner_pending_capital"))
                return (
                    <div className={cn(
                        "text-right font-mono text-[11px] font-bold",
                        val > 0 ? 'text-amber-600' : 'text-muted-foreground/30'
                    )}>
                        {formatCurrency(val)}
                    </div>
                )
            }
        },
        {
            accessorKey: "partner_provisional_withdrawals_balance",
            header: () => <div className="text-right whitespace-nowrap">R. Provisorios</div>,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("partner_provisional_withdrawals_balance"))
                return (
                    <div className={cn(
                        "text-right font-mono text-[11px] font-bold",
                        val > 0 ? 'text-rose-600' : 'text-muted-foreground/30'
                    )}>
                        {val > 0 ? `(${formatCurrency(val)})` : '-'}
                    </div>
                )
            }
        },
        {
            accessorKey: "partner_earnings_balance",
            header: () => <div className="text-right whitespace-nowrap text-emerald-600">Utilidades</div>,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("partner_earnings_balance"))
                return (
                    <div className={cn(
                        "text-right font-mono text-[11px] font-bold",
                        val > 0 ? 'text-emerald-600' : 'text-muted-foreground/30'
                    )}>
                        {val > 0 ? formatCurrency(val) : '-'}
                    </div>
                )
            }
        },
        {
            accessorKey: "partner_net_equity",
            header: () => <div className="text-right whitespace-nowrap text-primary">Patrimonio</div>,
            cell: ({ row }) => (
                <div className="text-right font-mono text-[12px] font-black text-primary bg-primary/5 px-2 py-1 relative ring-1 ring-primary/10">
                    {formatCurrency(row.getValue("partner_net_equity"))}
                </div>
            )
        },
        {
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/5 rounded-[0.125rem]">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 font-mono text-[10px] border-2">
                            <DropdownMenuLabel className="text-[9px] tracking-widest text-muted-foreground/60 py-1">GESTIÓN PATRIMONIAL</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                                className="text-emerald-600 font-black p-3 hover:bg-emerald-50 focus:bg-emerald-50"
                                onClick={() => setIsContributionOpen(true)}
                            >
                                <Wallet className="h-3.5 w-3.5 mr-2 bg-emerald-100 rounded-full p-0.5" />
                                <span>Registrar Aporte</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                                className="text-rose-600 font-black p-3 hover:bg-rose-50 focus:bg-rose-50"
                                onClick={() => setIsWithdrawalOpen(true)}
                            >
                                <LogOut className="h-3.5 w-3.5 mr-2 bg-rose-100 rounded-full p-0.5" />
                                <span>Registrar Retiro</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-6">
            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <IndustrialCard variant="industrial">
                    <CardHeader className="pb-1 p-4">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center justify-between">
                            Suscrito Total
                            <TrendingUp className="h-3.5 w-3.5 text-blue-500 opacity-50" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black font-heading tracking-tighter">
                            {formatCurrency(summary?.total_capital || 0)}
                        </div>
                        <p className="text-[9px] font-medium text-muted-foreground mt-1 uppercase tracking-tighter opacity-60">
                            Compromiso legal total
                        </p>
                    </CardContent>
                </IndustrialCard>

                <IndustrialCard variant="industrial">
                    <CardHeader className="pb-1 p-4">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center justify-between">
                            Enterado (Pagado)
                            <PieChart className="h-3.5 w-3.5 text-emerald-500 opacity-50" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black text-emerald-600 font-heading tracking-tighter">
                            {formatCurrency(summary?.total_paid_in || 0)}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-tighter opacity-60">Efectivamente pagado</span>
                            <span className="text-[9px] font-mono font-black text-emerald-600 bg-emerald-50 px-1 rounded">
                                {summary?.total_capital > 0 ? Math.round((summary.total_paid_in / summary.total_capital) * 100) : 0}%
                            </span>
                        </div>
                        {summary?.total_capital > 0 && (
                            <div className="mt-2 w-full h-1 bg-muted rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                                    style={{ width: `${Math.min(100, Math.round((summary.total_paid_in / summary.total_capital) * 100))}%` }}
                                />
                            </div>
                        )}
                    </CardContent>
                </IndustrialCard>

                <IndustrialCard variant="industrial">
                    <CardHeader className="pb-1 p-4">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center justify-between">
                            Capital por Cobrar
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 opacity-50" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black font-heading tracking-tighter text-amber-600">
                            {formatCurrency(summary?.total_pending || 0)}
                        </div>
                        <p className="text-[9px] font-medium text-muted-foreground mt-1 uppercase tracking-tighter opacity-60">
                            Suscrito no pagado
                        </p>
                    </CardContent>
                </IndustrialCard>

                <IndustrialCard variant="industrial" className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-1 p-4">
                        <CardTitle className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center justify-between">
                            Patrimonio Neto
                            <Building2 className="h-3.5 w-3.5 text-primary opacity-50" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-black font-heading tracking-tighter text-primary">
                            {formatCurrency(summary?.total_net_equity || 0)}
                        </div>
                        <p className="text-[9px] font-black text-primary mt-1 uppercase tracking-tighter opacity-60">
                            Valor Libro Compañía
                        </p>
                    </CardContent>
                </IndustrialCard>
            </div>

            {/* Main Content with DataTable */}
            <DataTable 
                columns={columns}
                data={partners}
                isLoading={loading}
                cardMode={true}
                toolbarAction={
                    <div className="flex gap-2">
                        {!hasPartners ? (
                            <Button 
                                onClick={() => setIsInitialSetupOpen(true)}
                                className="h-9 px-4 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-[0.25rem] shadow-sm"
                            >
                                <Plus className="h-3.5 w-3.5 mr-2" />
                                Configuración Inicial
                            </Button>
                        ) : (
                            <>
                                <Button 
                                    variant="outline"
                                    onClick={() => setIsAddPartnerOpen(true)}
                                    className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-2 border-primary/20 hover:bg-primary/5 text-primary transition-all rounded-[0.25rem]"
                                >
                                    <UserPlus className="h-3.5 w-3.5 mr-2" />
                                    Añadir Socio
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setIsSubscriptionOpen(true)}
                                    className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-2 border-muted-foreground/10 hover:bg-muted/5 transition-all rounded-[0.25rem]"
                                >
                                    <Plus className="h-3.5 w-3.5 mr-2" />
                                    Aumento / Reducción
                                </Button>
                                <Button 
                                    variant="outline"
                                    onClick={() => setIsTransferOpen(true)}
                                    className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-2 border-blue-200/50 hover:bg-blue-50 text-blue-700 transition-all rounded-[0.25rem]"
                                >
                                    <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
                                    Transferencia
                                </Button>
                            </>
                        )}
                    </div>
                }
            />

            {/* Info Message */}
            <div className="bg-primary/5 border-2 border-primary/10 rounded-[0.25rem] p-4 flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-500">
                <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-[11px] text-primary/80 leading-relaxed font-medium">
                    <p className="font-black text-[12px] mb-1 text-primary">Nota sobre la Composición Societaria:</p>
                    <p>Esta tabla muestra la <strong>participación formal</strong> según los libros de capital. Los aumentos o transferencias aquí registrados generan asientos contables automáticos contra la cuenta de Capital Social. Para ver el flujo detallado de aportes (efectivo/bienes), consulte la pestaña <strong>Libro Auxiliar</strong>.</p>
                </div>
            </div>

            {/* Modals remain the same */}
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
