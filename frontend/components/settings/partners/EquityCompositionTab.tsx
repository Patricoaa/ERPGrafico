"use client"

import React, { useEffect, useState } from "react"
import { 
    Users, 
    TrendingUp, 
    Plus, 
    ArrowRightLeft, 
    AlertCircle,
    Loader2,
    PieChart,
    Building2,
    Info,
    UserPlus
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
import { SubscriptionMovementModal, EquityTransferModal } from "@/components/settings/partners/EquityMovementModals"
import { AddPartnerModal } from "@/components/settings/partners/AddPartnerModal"
import { InitialCapitalModal } from "@/components/settings/InitialCapitalModal"

export function EquityCompositionTab() {
    const [loading, setLoading] = useState(true)
    const [partners, setPartners] = useState<any[]>([])
    const [summary, setSummary] = useState<any>(null)
    const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false)
    const [isTransferOpen, setIsTransferOpen] = useState(false)
    const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(false)
    const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false)

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            Representa el compromiso total de los socios
                        </p>
                    </CardContent>
                </IndustrialCard>

                <IndustrialCard variant="industrial">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
                            Número de Socios
                            <Users className="h-4 w-4 text-blue-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {partners.length}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Personas o entidades con participación
                        </p>
                    </CardContent>
                </IndustrialCard>

                <IndustrialCard variant="industrial">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center justify-between">
                            Estado del Capital
                            <PieChart className="h-4 w-4 text-amber-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">
                            100%
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Participación totalmente distribuida
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
                        <CardDescription>Distribución de acciones y participación societaria</CardDescription>
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
                                    className="border-blue-200 hover:bg-blue-50 text-blue-600"
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
                                <TableHead className="text-[10px] font-bold uppercase">RUT</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right">Participación (%)</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase text-right pr-6">Acciones / Capital</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {hasPartners ? (
                                partners.map((partner) => (
                                    <TableRow key={partner.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-medium pl-6 py-4">
                                            <div>
                                                {partner.name}
                                                <div className="text-[10px] text-muted-foreground font-normal">
                                                    Socio desde {partner.partner_since || 'No registrado'}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{partner.tax_id}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="font-bold">{partner.partner_equity_percentage}%</span>
                                                <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-primary" 
                                                        style={{ width: `${partner.partner_equity_percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6 font-mono font-bold">
                                            {formatCurrency(partner.partner_total_contributions || 0)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground uppercase text-[10px] italic">
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
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="text-xs text-blue-700 leading-relaxed">
                    <p className="font-bold mb-1">Nota sobre la Composición Societaria:</p>
                    Esta tabla muestra la <strong>participación formal</strong> según los libros de capital. 
                    Los aumentos o transferencias aquí registrados generan asientos contables automáticos contra la cuenta de Capital Social. 
                    Para ver los aportes de capital pendientes (efectivo/bienes), consulte la pestaña <strong>Libro Auxiliar</strong>.
                </div>
            </div>

            {/* Modals */}
            <SubscriptionMovementModal 
                open={isSubscriptionOpen} 
                onOpenChange={setIsSubscriptionOpen}
                onSuccess={fetchData}
            />
            <EquityTransferModal 
                open={isTransferOpen} 
                onOpenChange={setIsTransferOpen}
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
