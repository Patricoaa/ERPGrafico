"use client"

import React, { useEffect, useState, useMemo, useRef } from "react"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { ProfitDistribution, ProfitDistributionLine } from "@/features/contacts/types/partner"
import { formatCurrency, formatPlainDate, cn } from "@/lib/utils"
import {
    Calendar,
    ChevronRight,
    Plus,
    Wallet,
    Eye,
    Wand2,
    Play
} from "lucide-react"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateDistributionFlow } from "./CreateDistributionFlow"
import { MassPaymentModal } from "./MassPaymentModal"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

interface ProfitDistributionsTabProps {
    /** Whether the new-distribution flow should open on mount (driven by URL ?modal=new-distribution) */
    initialFlowOpen?: boolean
    /** Callback to clear the modal query param in the URL when the flow closes */
    onModalClose?: () => void
    createAction?: React.ReactNode
}

export function ProfitDistributionsTab({ initialFlowOpen = false, onModalClose, createAction }: ProfitDistributionsTabProps) {
    // Unified state to prevent fragmented updates
    const [state, setState] = useState({
        distributions: [] as ProfitDistribution[],
        loading: true,
        isFlowOpen: false,
        isMassPaymentOpen: false,
        selectedResolution: undefined as ProfitDistribution | undefined,
        viewingDist: undefined as ProfitDistribution | undefined
    })

    const isMounted = useRef(false)

    const fetchDistributions = React.useCallback(async () => {
        if (!isMounted.current) return
        setState(prev => ({ ...prev, loading: true }))

        try {
            const data = await partnersApi.getProfitDistributions()
            if (isMounted.current) {
                setState(prev => ({
                    ...prev,
                    distributions: data,
                    loading: false
                }))
            }
        } catch (error) {
            console.error(error)
            if (isMounted.current) {
                setState(prev => ({ ...prev, loading: false }))
            }
        }
    }, [])

    useEffect(() => {
        isMounted.current = true
        fetchDistributions()
        return () => { isMounted.current = false }
    }, [fetchDistributions])

    // Effect to handle modal opening from URL/props
    useEffect(() => {
        if (initialFlowOpen) {
            setState(prev => ({
                ...prev,
                selectedResolution: undefined,
                isFlowOpen: initialFlowOpen
            }))
        }
    }, [initialFlowOpen])

    const closeFlow = () => {
        setState(prev => ({ 
            ...prev, 
            isFlowOpen: false
        }))
        // Notify parent to clear the URL modal param
        onModalClose?.()
        fetchDistributions()
    }

    const handleExecute = async (resolution: ProfitDistribution) => {
        if (!confirm(`¿Está seguro de ejecutar la resolución del año ${resolution.fiscal_year}? Esto generará los asientos contables finales y las transacciones de los socios.`)) return

        setState(prev => ({ ...prev, loading: true }))
        try {
            await partnersApi.executeProfitDistribution(resolution.id)
            toast.success("Distribución ejecutada exitosamente.")
            fetchDistributions()
        } catch (error: unknown) {
            console.error(error)
            const detail = (error as any).response?.data?.detail || (error as Error).message || "Error al ejecutar la resolución"
            toast.error(detail)
        } finally {
            setState(prev => ({ ...prev, loading: false }))
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'bg-warning/10 text-warning border-warning/20'
            case 'APPROVED': return 'bg-info/10 text-info border-info/20'
            case 'EXECUTED': return 'bg-success/10 text-success border-success/20'
            case 'CANCELLED': return 'bg-muted text-muted-foreground border-muted-foreground/20'
            default: return 'bg-muted text-muted-foreground'
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'Borrador'
            case 'APPROVED': return 'Aprobado'
            case 'EXECUTED': return 'Ejecutado'
            case 'CANCELLED': return 'Cancelado'
            default: return status
        }
    }

    const columns = useMemo<ColumnDef<ProfitDistribution>[]>(() => [
        {
            accessorKey: "fiscal_year",
            header: () => <div className="text-center">Año Fiscal</div>,
            cell: ({ row }) => {
                const dist = row.original
                return (
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-sm tracking-tight">{dist.fiscal_year}</span>
                        <span className="text-[9px] text-muted-foreground font-mono uppercase">ID: {dist.display_id}</span>
                    </div>
                )
            }
        },
        {
            accessorKey: "status",
            header: () => <div className="text-center">Estado</div>,
            cell: ({ row }) => {
                const status = row.getValue("status") as string
                return (
                    <div className="flex justify-center">
                        <Badge className={`text-[9px] font-black uppercase border-2 ${getStatusColor(status)}`} variant="outline">
                            {getStatusText(status)}
                        </Badge>
                    </div>
                )
            }
        },
        {
            id: "breakdown",
            header: () => <div className="text-center">Distribución por Destino</div>,
            cell: ({ row }) => {
                const dist = row.original
                const totals = (dist.lines || []).reduce((acc, line) => {
                    const amount = parseFloat(line.net_amount) || 0;
                    const dest = line.destination;
                    if (dest === 'DIVIDEND') acc.dividends += amount;
                    else if (dest === 'REINVEST') acc.reinvest += amount;
                    else if (dest === 'RETAINED') acc.retained += amount;
                    return acc;
                }, { dividends: 0, reinvest: 0, retained: 0 });

                return (
                    <div className="flex flex-wrap justify-center gap-1.5">
                        {totals.dividends > 0 && (
                            <Badge variant="secondary" className="bg-success/5 text-success border-success/20 text-[9px] font-bold">
                                DIV: {formatCurrency(totals.dividends)}
                            </Badge>
                        )}
                        {totals.reinvest > 0 && (
                            <Badge variant="secondary" className="bg-info/5 text-info border-info/20 text-[9px] font-bold">
                                REINV: {formatCurrency(totals.reinvest)}
                            </Badge>
                        )}
                        {totals.retained > 0 && (
                            <Badge variant="secondary" className="bg-warning/5 text-warning border-warning/20 text-[9px] font-bold">
                                RET: {formatCurrency(totals.retained)}
                            </Badge>
                        )}
                    </div>
                )
            }
        },
        {
            accessorKey: "resolution_date",
            header: () => <div className="text-center">Acta / Fecha</div>,
            cell: ({ row }) => {
                const dist = row.original
                return (
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{dist.acta_number || 'Sin Acta'}</span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                            <Calendar className="h-3 w-3" />
                            {formatPlainDate(dist.resolution_date)}
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: "net_result",
            header: () => <div className="text-center">Resultado Neto</div>,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("net_result"))
                const status = row.original.status
                return (
                    <div className="flex flex-col items-center gap-0.5">
                        <span className={cn(
                            "font-mono font-black text-sm tracking-tighter",
                            amount < 0 ? "text-destructive" : "text-success"
                        )}>
                            {formatCurrency(Math.abs(amount))}
                        </span>
                        {status === 'EXECUTED' && (
                            <span className="text-[9px] text-muted-foreground uppercase font-black italic tracking-widest leading-none">Asentado</span>
                        )}
                    </div>
                )
            }
        },
        createActionsColumn<ProfitDistribution>({
            renderActions: (dist) => {
                if (dist.status === 'CANCELLED') return (
                    <DataCell.Action icon={Eye} title="Ver Detalle" onClick={() => setState(prev => ({ ...prev, viewingDist: dist }))} />
                )

                return (
                    <>
                        <DataCell.Action icon={Eye} title="Ver Detalle" onClick={() => setState(prev => ({ ...prev, viewingDist: dist }))} />

                        {dist.status === 'DRAFT' && (
                            <DataCell.Action icon={Wand2} title="Retomar Proceso" className="text-success" onClick={() => {
                                setState(prev => ({ ...prev, selectedResolution: dist, isFlowOpen: true }))
                            }} />
                        )}

                        {dist.status === 'APPROVED' && (
                            <DataCell.Action icon={Play} title="Ejecutar Contablemente" className="text-primary" onClick={() => handleExecute(dist)} />
                        )}
                        
                        {dist.status === 'EXECUTED' && (dist.lines?.some((l) => l.destination === 'DIVIDEND')) && (
                            <DataCell.Action icon={Wallet} title="Pagar Dividendos" className="text-primary" onClick={() => {
                                setState(prev => ({ ...prev, selectedResolution: dist, isMassPaymentOpen: true }))
                            }} />
                        )}
                    </>
                )
            }
        })
    ], [])

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={state.distributions}
                isLoading={state.loading}
                variant="embedded"
                searchPlaceholder="Buscar por año o resolución..."
                filterColumn="fiscal_year"
                createAction={createAction}
            />

            {/* Modal Flows */}
            {state.isFlowOpen && (
                <CreateDistributionFlow
                    open={state.isFlowOpen}
                    onOpenChange={closeFlow}
                    onSuccess={fetchDistributions}
                    initialResolution={state.selectedResolution}
                />
            )}

            {state.isMassPaymentOpen && (
                <MassPaymentModal
                    open={state.isMassPaymentOpen}
                    onOpenChange={(v) => setState(prev => ({ ...prev, isMassPaymentOpen: v }))}
                    resolution={state.selectedResolution!}
                    onSuccess={fetchDistributions}
                />
            )}


            {state.viewingDist && (
                <TransactionViewModal
                    open={!!state.viewingDist}
                    onOpenChange={() => setState(prev => ({ ...prev, viewingDist: undefined }))}
                    type="profit_distribution"
                    id={state.viewingDist.id}
                />
            )}
        </div>
    )
}
