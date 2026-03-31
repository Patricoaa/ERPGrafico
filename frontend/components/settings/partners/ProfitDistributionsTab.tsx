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
                            onClick={() => setIsFlowOpen(true)}
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
                                <TableHead className="text-[10px] font-bold uppercase">Acta / Referencia</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Fecha Cierre</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right">Resultado Neto</TableHead>
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
                                distributions.map((dist) => (
                                    <TableRow key={dist.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-bold pl-6 text-sm">
                                            {dist.fiscal_year}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`text-[10px] ${getStatusColor(dist.status)}`} variant="outline">
                                                {getStatusText(dist.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs font-mono">
                                            {dist.acta_number || 'S/N'}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {formatPlainDate(dist.resolution_date)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold">
                                            <span className={dist.net_result < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                                {formatCurrency(Math.abs(dist.net_result))}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem disabled>
                                                        Ver Resolución
                                                    </DropdownMenuItem>
                                                    {dist.status === 'EXECUTED' && (
                                                        <DropdownMenuItem
                                                            onClick={() => {
                                                                setSelectedResolution(dist)
                                                                setIsMassPaymentOpen(true)
                                                            }}
                                                        >
                                                            Pago Masivo Dividendos
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground uppercase text-[10px] italic">
                                        No hay distribuciones registradas.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </IndustrialCard>

            <CreateDistributionFlow 
                open={isFlowOpen}
                onOpenChange={setIsFlowOpen}
                onSuccess={fetchDistributions}
            />

            <MassPaymentModal
                open={isMassPaymentOpen}
                onOpenChange={setIsMassPaymentOpen}
                resolution={selectedResolution}
                onSuccess={fetchDistributions}
            />
        </div>
    )
}
