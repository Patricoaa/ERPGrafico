"use client"

import React, { useEffect, useState, useMemo, useRef } from "react"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { formatCurrency, formatPlainDate, cn } from "@/lib/utils"
import {
    Calendar,
    ChevronRight,
    Plus,
    Wallet
} from "lucide-react"
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

interface ProfitDistributionsTabProps {
    /** Whether the new-distribution flow should open on mount (driven by URL ?modal=new-distribution) */
    initialFlowOpen?: boolean
    /** Callback to clear the modal query param in the URL when the flow closes */
    onModalClose?: () => void
}

export function ProfitDistributionsTab({ initialFlowOpen = false, onModalClose }: ProfitDistributionsTabProps) {
    // Unified state to prevent fragmented updates
    const [state, setState] = useState({
        distributions: [] as any[],
        loading: true,
        isFlowOpen: false,
        isMassPaymentOpen: false,
        selectedResolution: null as any
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
        
        // Open the flow if requested via URL param (prop from parent)
        if (initialFlowOpen) {
            setState(prev => ({ 
                ...prev, 
                selectedResolution: null, 
                isFlowOpen: true 
            }))
        }

        return () => { isMounted.current = false }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const closeFlow = () => {
        setState(prev => ({ ...prev, isFlowOpen: false }))
        // Notify parent to clear the URL modal param
        onModalClose?.()
        fetchDistributions()
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

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "fiscal_year",
            header: "Año Fiscal",
            cell: ({ row }) => {
                const dist = row.original
                return (
                    <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-tight">{dist.fiscal_year}</span>
                        <span className="text-[9px] text-muted-foreground font-mono uppercase">ID: {dist.display_id}</span>
                    </div>
                )
            }
        },
        {
            accessorKey: "status",
            header: "Estado",
            cell: ({ row }) => {
                const status = row.getValue("status") as string
                return (
                    <Badge className={`text-[9px] font-black uppercase border-2 ${getStatusColor(status)}`} variant="outline">
                        {getStatusText(status)}
                    </Badge>
                )
            }
        },
        {
            id: "breakdown",
            header: "Distribución por Destino",
            cell: ({ row }) => {
                const dist = row.original
                const totals = (dist.lines || []).reduce((acc: any, line: any) => {
                    const amount = parseFloat(line.net_amount) || 0;
                    const dest = line.destination;
                    if (dest === 'DIVIDEND') acc.dividends += amount;
                    else if (dest === 'REINVEST') acc.reinvest += amount;
                    else if (dest === 'RETAINED') acc.retained += amount;
                    return acc;
                }, { dividends: 0, reinvest: 0, retained: 0 });

                return (
                    <div className="flex flex-wrap gap-1.5">
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
            header: "Acta / Fecha",
            cell: ({ row }) => {
                const dist = row.original
                return (
                    <div className="flex flex-col gap-1">
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
            header: () => <div className="text-right">Resultado Neto</div>,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("net_result"))
                const status = row.original.status
                return (
                    <div className="flex flex-col items-end gap-0.5">
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
        {
            id: "actions",
            cell: ({ row }) => {
                const dist = row.original
                return (
                    <div className="text-right pr-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/80">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 font-heading font-bold text-[10px] uppercase tracking-widest">
                                <DropdownMenuLabel>Acciones de Resolución</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {(dist.status === 'DRAFT' || dist.status === 'APPROVED') && (
                                    <DropdownMenuItem 
                                        className="text-success font-black"
                                        onClick={() => {
                                            setState(prev => ({ 
                                                ...prev, 
                                                selectedResolution: dist, 
                                                isFlowOpen: true 
                                            }))
                                        }}
                                    >
                                        <Plus className="h-3 w-3 mr-2 bg-success text-success-foreground rounded-full p-0.5" />
                                        Retomar Proceso
                                    </DropdownMenuItem>
                                )}
                                {dist.status === 'EXECUTED' && (dist.lines?.some((l: any) => l.destination === 'DIVIDEND')) && (
                                    <DropdownMenuItem 
                                        className="text-primary font-black"
                                        onClick={() => {
                                            setState(prev => ({ 
                                                ...prev, 
                                                selectedResolution: dist, 
                                                isMassPaymentOpen: true 
                                            }))
                                        }}
                                    >
                                        <Wallet className="h-3 w-3 mr-2" />
                                        Pagar Dividendos
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem>
                                    <Calendar className="h-3 w-3 mr-2" />
                                    Ver Asiento Contable
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            }
        }
    ], [])

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={state.distributions}
                isLoading={state.loading}
                cardMode={true}
                searchPlaceholder="Buscar por año o resolución..."
                filterColumn="fiscal_year"
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
                    resolution={state.selectedResolution}
                    onSuccess={fetchDistributions}
                />
            )}
        </div>
    )
}
