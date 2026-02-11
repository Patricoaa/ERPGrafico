"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Plus,
    FileText,
    Calendar,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Search,
    Filter,
    ClipboardCheck,
    DollarSign
} from "lucide-react"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { DeclarationWizard } from "@/components/tax/DeclarationWizard"
import { PeriodChecklist } from "@/components/tax/PeriodChecklist"
import { PaymentWizard } from "@/components/tax/PaymentWizard"

export default function TaxDeclarationsPage() {
    const [periods, setPeriods] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isWizardOpen, setIsWizardOpen] = useState(false)
    const [isChecklistOpen, setIsChecklistOpen] = useState(false)
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)
    const [selectedPeriod, setSelectedPeriod] = useState<any>(null)
    const [selectedDeclaration, setSelectedDeclaration] = useState<any>(null)

    const fetchPeriods = async () => {
        setIsLoading(true)
        try {
            const response = await api.get("/tax/periods/")
            const fetchedPeriods = response.data.results || response.data
            setPeriods(fetchedPeriods)

            // Try to fetch declaration detail for the most recent period to get tax_to_pay
            if (fetchedPeriods.length > 0) {
                const latest = fetchedPeriods[0]
                const declResp = await api.get(`/tax/declarations/?tax_period__year=${latest.year}&tax_period__month=${latest.month}`)
                const declarations = declResp.data.results || declResp.data
                if (declarations.length > 0) {
                    setSelectedDeclaration(declarations[0])
                }
            }
        } catch (error) {
            console.error("Error fetching tax periods:", error)
            toast.error("Error al cargar los períodos tributarios")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchPeriods()
    }, [])

    const handleOpenWizard = () => {
        setIsWizardOpen(true)
    }

    const handleOpenChecklist = (period: any) => {
        setSelectedPeriod(period)
        setIsChecklistOpen(true)
    }

    const handleOpenPayment = async (period: any) => {
        try {
            const resp = await api.get(`/tax/declarations/?tax_period__year=${period.year}&tax_period__month=${period.month}`)
            const declarations = resp.data.results || resp.data
            if (declarations.length > 0) {
                setSelectedDeclaration(declarations[0])
                setIsPaymentOpen(true)
            } else {
                toast.error("No se encontró una declaración para este período")
            }
        } catch (error) {
            toast.error("Error al buscar la declaración")
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "OPEN":
                return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Abierto</Badge>
            case "UNDER_REVIEW":
                return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">En Revisión</Badge>
            case "CLOSED":
                return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Cerrado</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    // Determine current logical period to show in dashboard
    const latestPeriod = periods.length > 0 ? periods[0] : null
    const currentPeriodDisplay = latestPeriod
        ? `${latestPeriod.month_display} ${latestPeriod.year}`.toUpperCase()
        : format(new Date(), "MMMM yyyy", { locale: es }).toUpperCase()

    const isLatestClosed = latestPeriod?.status === "CLOSED"

    return (
        <div className="space-y-6">
            <PageHeader
                title="Declaraciones F29"
                description="Gestión mensual de IVA, PPM y retenciones"
                icon={FileText}
            >
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Filtros
                    </Button>
                    <Button size="sm" onClick={handleOpenWizard} disabled={isLatestClosed && latestPeriod?.month === new Date().getMonth() + 1}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva Declaración
                    </Button>
                </div>
            </PageHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Período Actual</CardTitle>
                        <CardDescription className="text-2xl font-bold text-foreground">
                            {currentPeriodDisplay}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLatestClosed ? (
                            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                                <CheckCircle2 className="h-4 w-4" />
                                Período Cerrado
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                                <AlertCircle className="h-4 w-4" />
                                Pendiente de declaración
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">IVA por Pagar (Estimado)</CardTitle>
                        <CardDescription className="text-2xl font-bold text-foreground">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(selectedDeclaration?.vat_to_pay || 0)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground italic">
                            Basado en {selectedDeclaration ? 'declaración registrada' : 'documentos del mes'}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Último Remanente</CardTitle>
                        <CardDescription className="text-2xl font-bold text-foreground">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(selectedDeclaration?.vat_credit_balance || 0)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-emerald-600 font-medium">
                            Período Anterior: $0
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Historial de Períodos
                    </h3>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar período..."
                            className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border-transparent focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-24 w-full rounded-xl" />
                        ))}
                    </div>
                ) : periods.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-3xl border-2 border-dashed">
                        <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                        <p className="text-muted-foreground font-medium">No hay períodos registrados</p>
                        <Button variant="link" className="mt-2" onClick={handleOpenWizard}>Iniciar primer período</Button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {periods.map((period) => (
                            <div
                                key={period.id}
                                className="group flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
                            >
                                <div className="flex items-center gap-4" onClick={() => handleOpenChecklist(period)}>
                                    <div className="w-12 h-12 rounded-xl bg-primary/5 flex flex-col items-center justify-center border border-primary/10">
                                        <span className="text-[10px] font-bold text-primary/60">{period.year}</span>
                                        <span className="text-sm font-bold text-primary">{period.month_display.substring(0, 3)}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground flex items-center gap-2">
                                            {period.month_display} {period.year}
                                            {getStatusBadge(period.status)}
                                        </h4>
                                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <FileText className="h-3 w-3" />
                                                F29 Presentado
                                            </span>
                                            {period.closed_at && (
                                                <span className="flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                    Cerrado el {format(new Date(period.closed_at), "dd/MM/yyyy")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-bold">Impuesto Determinado</div>
                                        <div className="text-sm font-bold">$0</div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {period.status !== 'CLOSED' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="rounded-xl border-emerald-500/50 text-emerald-600 hover:bg-emerald-50"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenPayment(period);
                                                }}
                                            >
                                                <DollarSign className="h-4 w-4 mr-1" />
                                                Pagar
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform" onClick={() => handleOpenChecklist(period)}>
                                            <ArrowRight className="h-5 w-5 text-primary" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <DeclarationWizard
                isOpen={isWizardOpen}
                onOpenChange={setIsWizardOpen}
                onSuccess={fetchPeriods}
            />

            <PeriodChecklist
                isOpen={isChecklistOpen}
                onOpenChange={setIsChecklistOpen}
                period={selectedPeriod}
                onSuccess={fetchPeriods}
            />

            <PaymentWizard
                isOpen={isPaymentOpen}
                onOpenChange={setIsPaymentOpen}
                declaration={selectedDeclaration}
                onSuccess={fetchPeriods}
            />
        </div>
    )
}
