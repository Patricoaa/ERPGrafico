"use client"

import React, { useEffect, useState } from "react"
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
import { formatCurrency, formatPlainDate } from "@/lib/utils"
import {
    PieChart,
    Plus,
    Calendar,
    ChevronRight,
    Loader2
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

export function ProfitDistributionsTab() {
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'bg-amber-100 text-amber-800 border-amber-300'
            case 'APPROVED': return 'bg-blue-100 text-blue-800 border-blue-300'
            case 'EXECUTED': return 'bg-emerald-100 text-emerald-800 border-emerald-300'
            case 'CANCELLED': return 'bg-gray-100 text-gray-800 border-gray-300'
            default: return 'bg-gray-100 text-gray-800'
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

    return (
        <div className="space-y-6">
            <IndustrialCard variant="industrial" className="border-t-primary">
                <CardHeader className="flex flex-row items-center justify-between pb-6">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-primary" />
                            Distribución de Utilidades Societarias
                        </CardTitle>
                        <CardDescription>Gestión formal de actas de repartición de utilidades del ejercicio</CardDescription>
                    </div>
                    <div>
                        <Button 
                            onClick={() => {
                                setSelectedResolution(null)
                                setIsFlowOpen(true)
                            }}
                            className="bg-primary hover:bg-primary/90 shadow-md"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Distribución
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="text-[10px] font-bold uppercase pl-6">Año Fiscal</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Estado</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Distribución por Destino</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Acta / Fecha</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right pr-6">Resultado Neto</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : distributions.length > 0 ? (
                                distributions.map((dist) => {
                                    // Calculate breakdown
                                    const totals = (dist.lines || []).reduce((acc: any, line: any) => {
                                        const amount = parseFloat(line.net_amount) || 0;
                                        const dest = line.destination;
                                        if (dest === 'DIVIDEND') acc.dividends += amount;
                                        else if (dest === 'REINVEST') acc.reinvest += amount;
                                        else if (dest === 'RETAINED') acc.retained += amount;
                                        else if (dest === 'LOSS') acc.loss += amount;
                                        return acc;
                                    }, { dividends: 0, reinvest: 0, retained: 0, loss: 0 });

                                    return (
                                        <TableRow key={dist.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="font-bold pl-6 text-sm">
                                                <div className="flex flex-col">
                                                    <span>{dist.fiscal_year}</span>
                                                    <span className="text-[9px] text-muted-foreground font-mono">ID: {dist.display_id}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`text-[9px] font-bold uppercase border-2 ${getStatusColor(dist.status)}`} variant="outline">
                                                    {getStatusText(dist.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1.5 py-1">
                                                    {totals.dividends > 0 && (
                                                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px]">
                                                            DIV: {formatCurrency(totals.dividends)}
                                                        </Badge>
                                                    )}
                                                    {totals.reinvest > 0 && (
                                                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 text-[10px]">
                                                            REINV: {formatCurrency(totals.reinvest)}
                                                        </Badge>
                                                    )}
                                                    {totals.retained > 0 && (
                                                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 text-[10px]">
                                                            RET: {formatCurrency(totals.retained)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{dist.acta_number || 'Sin Acta'}</span>
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                        <Calendar className="h-3 w-3" />
                                                        {formatPlainDate(dist.resolution_date)}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold pr-6">
                                                <div className="flex flex-col items-end">
                                                    <span className={dist.net_result < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                                        {formatCurrency(Math.abs(dist.net_result))}
                                                    </span>
                                                    {dist.status === 'EXECUTED' && (
                                                        <span className="text-[9px] text-muted-foreground uppercase font-bold italic">Asentado</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56 font-mono text-xs">
                                                        <DropdownMenuLabel>Acciones de Resolución</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {(dist.status === 'DRAFT' || dist.status === 'APPROVED') && (
                                                            <DropdownMenuItem 
                                                                className="text-emerald-600 font-bold"
                                                                onClick={() => {
                                                                    setSelectedResolution(dist)
                                                                    setIsFlowOpen(true)
                                                                }}
                                                            >
                                                                <Plus className="h-4 w-4 mr-2" />
                                                                Retomar Proceso
                                                            </DropdownMenuItem>
                                                        )}
                                                        {dist.status === 'EXECUTED' && totals.dividends > 0 && (
                                                            <DropdownMenuItem 
                                                                className="text-blue-600 font-bold"
                                                                onClick={() => {
                                                                    setSelectedResolution(dist)
                                                                    setIsMassPaymentOpen(true)
                                                                }}
                                                            >
                                                                <Wallet className="h-4 w-4 mr-2" />
                                                                Pagar Dividendos
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem>
                                                            <Calendar className="h-4 w-4 mr-2" />
                                                            Ver Asiento Contable
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground uppercase text-[10px] italic">
                                        No se han registrado resoluciones de distribución.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </IndustrialCard>

            {/* Modal Flows */}
            {isFlowOpen && (
                <CreateDistributionFlow 
                    open={isFlowOpen}
                    onOpenChange={(open) => {
                        setIsFlowOpen(open)
                        if (!open) fetchDistributions()
                    }}
                    initialResolution={selectedResolution}
                />
            )}

            {isMassPaymentOpen && (
                <MassPaymentModal
                    open={isMassPaymentOpen}
                    onOpenChange={(open) => {
                        setIsMassPaymentOpen(open)
                        if (!open) fetchDistributions()
                    }}
                    resolutionId={selectedResolution?.id}
                />
            )}
        </div>
    )
}
