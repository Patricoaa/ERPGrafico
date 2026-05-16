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
    LogOut,
    Banknote,
    History,
    BarChart3,
    BookOpen,
    Layers,
    Settings2,
    ArrowDownToLine,
    MoveHorizontal
} from "lucide-react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    TableRow,
    TableCell
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { Partner, PartnerSummary } from "@/features/contacts/types/partner"
import { toast } from "sonner"
import { formatCurrency, cn } from "@/lib/utils"
import { CardSkeleton, TableSkeleton } from "@/components/shared"
import {
    SubscriptionMovementModal,
    EquityTransferModal,
    DividendPaymentModal
} from "@/features/settings/components/partners/EquityMovementModals"
import { PartnerContributionWizard } from "@/features/settings/components/partners/PartnerContributionWizard"
import { PartnerWithdrawalWizard } from "@/features/settings/components/partners/PartnerWithdrawalWizard"
import { AddPartnerModal } from "@/features/settings/components/partners/AddPartnerModal"
import { InitialCapitalModal } from "@/features/settings/components/InitialCapitalModal"
import { MobilizeEarningsWizard } from "@/features/settings/components/partners/MobilizeEarningsWizard"
import { PartnerLedgerModal } from "@/features/settings/components/partners/PartnerLedgerModal"
import { EquityStatsSheet } from "@/features/settings/components/partners/EquityStatsSheet"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"

export function EquityCompositionTab({
    initialAddPartnerOpen = false,
    initialStatsOpen = false,
    onModalClose,
    createAction
}: {
    initialAddPartnerOpen?: boolean,
    initialStatsOpen?: boolean,
    onModalClose?: () => void,
    createAction?: React.ReactNode
}) {
    const [loading, setLoading] = useState(true)
    const [partners, setPartners] = useState<Partner[]>([])
    const [summary, setSummary] = useState<PartnerSummary | null>(null)
    const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false)
    const [isTransferOpen, setIsTransferOpen] = useState(false)
    const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(false)
    const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false)

    // Custom action modals
    const [isContributionOpen, setIsContributionOpen] = useState(false)
    const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false)
    const [isDividendOpen, setIsDividendOpen] = useState(false)
    const [isMobilizeOpen, setIsMobilizeOpen] = useState(false)
    const [isLedgerOpen, setIsLedgerOpen] = useState(false)
    const [isStatsOpen, setIsStatsOpen] = useState(false)

    // Modal pre-filling state
    const [subModalParams, setSubModalParams] = useState({
        partnerId: undefined as string | undefined,
        amount: undefined as string | undefined
    })

    const [selectedPartnerId, setSelectedPartnerId] = useState<number | undefined>(undefined)
    const [selectedPartnerName, setSelectedPartnerName] = useState<string>("")

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

    useEffect(() => {
        if (initialAddPartnerOpen) {
            setIsAddPartnerOpen(true)
        }
    }, [initialAddPartnerOpen])

    useEffect(() => {
        if (initialStatsOpen) {
            setIsStatsOpen(true)
        }
    }, [initialStatsOpen])

    if (loading) {
        return (
            <div className="space-y-6">
                <CardSkeleton count={4} variant="grid" />
                <TableSkeleton rows={10} columns={9} />
            </div>
        )
    }

    const hasPartners = partners.length > 0

    const columns: ColumnDef<Partner>[] = [
        {
            accessorKey: "name",
            header: "Socio",
            cell: ({ row }) => (
                <div className="flex flex-col gap-1 py-1 max-w-[220px]">
                    <span className="font-black text-[12px] tracking-tight uppercase leading-none">{row.original.name}</span>
                    <span className="text-[9px] font-mono opacity-50">{row.original.tax_id}</span>

                    {Number(row.original.partner_excess_capital) > 0 && (
                        <div className="mt-1.5 p-1.5 bg-warning/10 border border-warning/20 rounded-sm flex items-center gap-2 overflow-hidden ring-1 ring-warning/10">
                            <div className="flex items-center gap-1.5 text-[9px] text-warning font-black uppercase tracking-tighter">
                                <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                                Exceso: +{formatCurrency(row.original.partner_excess_capital)}
                            </div>
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
                    <Badge variant="outline" className="font-mono text-[10px] h-5 rounded-sm border-primary/20 bg-primary/5 text-primary font-black">
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
                <div className="text-right font-mono text-[11px] font-black text-success">
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
                        val > 0 ? 'text-warning' : 'text-muted-foreground/30'
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
                        val > 0 ? 'text-destructive' : 'text-muted-foreground/30'
                    )}>
                        {val > 0 ? `(${formatCurrency(val)})` : '-'}
                    </div>
                )
            }
        },
        {
            accessorKey: "partner_earnings_balance",
            header: () => <div className="text-right whitespace-nowrap text-success">Utilidades</div>,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("partner_earnings_balance"))
                return (
                    <div className={cn(
                        "text-right font-mono text-[11px] font-bold",
                        val > 0 ? 'text-success' : 'text-muted-foreground/30'
                    )}>
                        {val > 0 ? formatCurrency(val) : '-'}
                    </div>
                )
            }
        },
        {
            accessorKey: "partner_dividends_payable_balance",
            header: () => <div className="text-right whitespace-nowrap text-warning">D. por Pagar</div>,
            cell: ({ row }) => {
                const val = parseFloat(row.getValue("partner_dividends_payable_balance"))
                return (
                    <div className={cn(
                        "text-right font-mono text-[11px] font-bold",
                        val > 0 ? 'text-warning' : 'text-muted-foreground/30'
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
        createActionsColumn<Partner>({
            renderActions: (partner) => {
                const hasEarnings = parseFloat(partner.partner_earnings_balance) > 0
                const hasDividends = parseFloat(partner.partner_dividends_payable_balance) > 0

                return (
                    <>
                        {parseFloat(partner.partner_excess_capital) > 0 && (
                            <DataCell.Action
                                icon={TrendingUp}
                                title="Formalizar Exceso de Capital"
                                className="text-warning"
                                onClick={() => {
                                    setSubModalParams({
                                        partnerId: partner.id.toString(),
                                        amount: partner.partner_excess_capital.toString()
                                    })
                                    setIsSubscriptionOpen(true)
                                }}
                            />
                        )}
                        <DataCell.Action
                            icon={Banknote}
                            title="Pagar Dividendos"
                            className={hasDividends ? "text-primary" : "text-muted-foreground/30 pointer-events-none"}
                            onClick={() => {
                                setSelectedPartnerId(partner.id)
                                setIsDividendOpen(true)
                            }}
                        />
                        <DataCell.Action
                            icon={ArrowRightLeft}
                            title="Distribuir Utilidades Retenidas"
                            className={hasEarnings ? "text-primary/70" : "text-muted-foreground/30 pointer-events-none"}
                            onClick={() => {
                                setSelectedPartnerId(partner.id)
                                setIsMobilizeOpen(true)
                            }}
                        />
                        <DataCell.Action
                            icon={History}
                            title="Ver Libro Auxiliar"
                            className="text-primary font-black"
                            onClick={() => {
                                setSelectedPartnerId(partner.id)
                                setSelectedPartnerName(partner.name)
                                setIsLedgerOpen(true)
                            }}
                        />
                    </>
                )
            }
        })
    ]

    return (
        <div className="space-y-6">
            {/* Main Content with DataTable */}
            <DataTable
                columns={columns}
                data={partners}
                isLoading={loading}
                variant="embedded"
                createAction={createAction}
                toolbarAction={
                    <>
                        {!hasPartners ? (
                            <DropdownMenuItem
                                onClick={() => setIsInitialSetupOpen(true)}
                                className="flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary focus:bg-primary/10 focus:text-primary cursor-pointer transition-colors"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Configuración Inicial
                            </DropdownMenuItem>
                        ) : (
                            <>
                                <DropdownMenuItem
                                    onClick={() => setIsSubscriptionOpen(true)}
                                    className="flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary focus:bg-primary/10 focus:text-primary cursor-pointer transition-colors"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nueva Suscripción
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => setIsTransferOpen(true)}
                                    className="flex items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary focus:bg-primary/10 focus:text-primary cursor-pointer transition-colors"
                                >
                                    <MoveHorizontal className="h-4 w-4 mr-2" />
                                    Transferencia
                                </DropdownMenuItem>
                            </>
                        )}
                    </>
                }
            />


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
            <PartnerContributionWizard
                open={isContributionOpen}
                onOpenChange={setIsContributionOpen}
                onSuccess={fetchData}
                initialPartnerId={selectedPartnerId?.toString()}
            />
            <PartnerWithdrawalWizard
                open={isWithdrawalOpen}
                onOpenChange={setIsWithdrawalOpen}
                onSuccess={fetchData}
                initialPartnerId={selectedPartnerId?.toString()}
            />
            <MobilizeEarningsWizard
                open={isMobilizeOpen}
                onOpenChange={setIsMobilizeOpen}
                onSuccess={fetchData}
                initialPartnerId={selectedPartnerId}
            />
            <DividendPaymentModal
                open={isDividendOpen}
                onOpenChange={setIsDividendOpen}
                onSuccess={fetchData}
                initialPartnerId={selectedPartnerId?.toString()}
            />
            <PartnerLedgerModal
                open={isLedgerOpen}
                onOpenChange={setIsLedgerOpen}
                partnerId={selectedPartnerId}
                partnerName={selectedPartnerName}
            />
            {summary && (
                <EquityStatsSheet
                    open={isStatsOpen}
                    onOpenChange={(open) => {
                        setIsStatsOpen(open)
                        if (!open) {
                            onModalClose?.()
                        }
                    }}
                    partners={partners}
                    summary={summary}
                />
            )}
            <AddPartnerModal
                open={isAddPartnerOpen}
                onOpenChange={(open) => {
                    setIsAddPartnerOpen(open)
                    if (!open) {
                        onModalClose?.()
                    }
                }}
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
