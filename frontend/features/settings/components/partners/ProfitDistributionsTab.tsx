"use client"

import React, { useEffect, useState, useMemo } from "react"
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
import { useSearchParams, useRouter } from "next/navigation"

export function ProfitDistributionsTab() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [distributions, setDistributions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isFlowOpen, setIsFlowOpen] = useState(false)
    const [isMassPaymentOpen, setIsMassPaymentOpen] = useState(false)
    const [selectedResolution, setSelectedResolution] = useState<any>(null)

    const fetchDistributions = async () => {
        setLoading(true)
        try {
            const data = await partnersApi.getProfitDistributions()
            setDistributions(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDistributions()
    }, [])

    // Handle URL-based modal trigger
    useEffect(() => {
        const modal = searchParams.get("modal")
        if (modal === "new-distribution") {
            setSelectedResolution(null)
            setIsFlowOpen(true)
        }
    }, [searchParams])

    const closeFlow = () => {
        setIsFlowOpen(false)
        if (searchParams.get("modal") === "new-distribution") {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.push(`?${params.toString()}`, { scroll: false })
        }
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
                                            setSelectedResolution(dist)
                                            setIsFlowOpen(true)
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
                                            setSelectedResolution(dist)
                                            setIsMassPaymentOpen(true)
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
    ], [searchParams, router])

    return (
        <div className="space-y-6">
            <DataTable
                columns={columns}
                data={distributions}
                isLoading={loading}
                cardMode={true}
                searchPlaceholder="Buscar por año o resolución..."
                filterColumn="fiscal_year"
            />

            {/* Modal Flows */}
            {isFlowOpen && (
                <CreateDistributionFlow 
                    open={isFlowOpen} 
                    onOpenChange={closeFlow}
                    onSuccess={fetchDistributions}
                    initialResolution={selectedResolution}
                />
            )}

            {isMassPaymentOpen && (
                <MassPaymentModal
                    open={isMassPaymentOpen}
                    onOpenChange={setIsMassPaymentOpen}
                    resolution={selectedResolution}
                    onSuccess={fetchDistributions}
                />
            )}
        </div>
    )
}
