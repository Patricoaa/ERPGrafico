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
    DollarSign,
    Package
} from "lucide-react"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { DeclarationWizard } from "@/components/tax/DeclarationWizard"
import { PeriodChecklist } from "@/components/tax/PeriodChecklist"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import { useServerDate } from "@/hooks/useServerDate"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef, Row } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

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
            // Fetch all periods (pagination handled by DataTable client-side for now as dataset is small)
            const response = await api.get("/tax/periods/?page_size=100")
            const fetchedPeriods = response.data.results || response.data
            setPeriods(fetchedPeriods)
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
        // Use summary data if available, or fetch details if needed
        if (period.declaration_summary) {
            setSelectedDeclaration({
                id: period.declaration_summary.id,
                vat_to_pay: period.declaration_summary.vat_to_pay,
                folio_number: period.declaration_summary.folio_number,
                tax_period_display: `${period.month_display} ${period.year}`
            })
            setIsPaymentOpen(true)
        } else {
            try {
                const resp = await api.get(`/tax/declarations/?tax_period__year=${period.year}&tax_period__month=${period.month}`)
                const declarations = resp.data.results || resp.data
                if (declarations.length > 0) {
                    setSelectedDeclaration({
                        ...declarations[0],
                        tax_period_display: `${period.month_display} ${period.year}`
                    })
                    setIsPaymentOpen(true)
                } else {
                    toast.error("No se encontró una declaración válida para pagar")
                }
            } catch (error) {
                toast.error("Error al buscar la declaración")
            }
        }
    }

    const handlePaymentConfirm = async (data: any) => {
        try {
            await api.post("/tax/payments/", {
                declaration: selectedDeclaration.id,
                payment_date: data.documentDate || dateString || "",
                amount: data.amount,
                payment_method: data.paymentMethod,
                reference: data.reference || data.transaction_number || '',
                treasury_account: data.treasury_account_id,
                notes: `Pago F29 - ${selectedDeclaration.tax_period_display}`
            })

            toast.success("Pago de impuestos registrado correctamente")
            fetchPeriods()
            setIsPaymentOpen(false)
        } catch (error: any) {
            console.error("Error saving payment:", error)
            toast.error(error.response?.data?.error || "Error al registrar el pago")
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
    const { serverDate, dateString } = useServerDate()
    const latestPeriod = periods.length > 0 ? periods[0] : null
    const currentPeriodDisplay = latestPeriod
        ? `${latestPeriod.month_display} ${latestPeriod.year}`.toUpperCase()
        : (serverDate
            ? format(serverDate, "MMMM yyyy", { locale: es }).toUpperCase()
            : format(new Date(), "MMMM yyyy", { locale: es }).toUpperCase())

    const isLatestClosed = latestPeriod?.status === "CLOSED"

    // Calculate summaries from the latest period or most recent loaded data
    const currentVatToPay = latestPeriod?.declaration_summary?.vat_to_pay || 0
    // We don't have credit balance in summary yet, would need to add it to serializer or keep it simple
    // For now assuming 0 or fetching separate if critical. User asked to sync "Impuesto Determinado".


    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "period_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Período" />,
            cell: ({ row }) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/5 flex flex-col items-center justify-center border border-primary/10">
                        <span className="text-[9px] font-bold text-primary/60">{row.original.year}</span>
                        <span className="text-xs font-bold text-primary">{row.original.month_display.substring(0, 3)}</span>
                    </div>
                    <div>
                        <span className="font-medium">{row.original.month_display} {row.original.year}</span>
                    </div>
                </div>
            ),
            sortingFn: (rowA, rowB, columnId) => {
                // Custom sort by year and month
                if (rowA.original.year !== rowB.original.year) {
                    return rowA.original.year - rowB.original.year
                }
                return rowA.original.month - rowB.original.month
            }
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => getStatusBadge(row.original.status),
            filterFn: (row, id, value) => value.includes(row.getValue(id))
        },
        {
            accessorKey: "vat_to_pay",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Impuesto Determinado" />,
            cell: ({ row }) => {
                const amount = row.original.declaration_summary?.vat_to_pay || 0
                return <div className="font-mono">{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount)}</div>
            }
        },
        {
            accessorKey: "payment_status",
            header: "Estado Pago",
            cell: ({ row }) => {
                const summary = row.original.declaration_summary
                if (!summary) return <span className="text-muted-foreground">-</span>
                if (summary.is_fully_paid) {
                    return <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-50">Pagado</Badge>
                }
                if (summary.vat_to_pay > 0 && row.original.status === 'CLOSED') {
                    return <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50">Pendiente</Badge>
                }
                return <span className="text-muted-foreground">-</span>
            }
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const period = row.original
                const summary = period.declaration_summary
                const showPayButton = period.status !== 'CLOSED' && summary && !summary.is_fully_paid && summary.vat_to_pay > 0
                // User asked: "El boton de pagar debería dejar visbilizarse si ya se ha pagado completamente"
                // Actually if it IS closed, we might still want to pay if it wasn't paid? 
                // Usually you pay F29 around the same time you declare. 
                // Let's allow payment if there is debt, regardless of closed status (maybe they closed it but haven't paid?)
                // Or user said: "El boton de pagar debería dejar visbilizarse si ya se ha pagado completamente el impuesto."
                // So show if NOT fully paid.

                return (
                    <div className="flex justify-end gap-2">
                        {(!summary?.is_fully_paid && (summary?.vat_to_pay > 0 || !summary)) && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg border-emerald-500/50 text-emerald-600 hover:bg-emerald-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenPayment(period);
                                }}
                            >
                                <DollarSign className="h-3.5 w-3.5 mr-1" />
                                Pagar
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenChecklist(period);
                            }}
                        >
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </div>
                )
            }
        }
    ]

    return (
        <div className="space-y-6">
            <PageHeader
                title="Declaraciones F29"
                description="Gestión mensual de IVA, PPM y retenciones"
                icon={FileText}
            >
                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleOpenWizard}>
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
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(currentVatToPay)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground italic">
                            Basado en {latestPeriod?.declaration_summary ? 'declaración registrada' : 'información disponible'}
                        </div>
                    </CardContent>
                </Card>

                {/* Kept simplistic for now as we don't have this data in summary yet, but keeping structure */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Último Remanente</CardTitle>
                        <CardDescription className="text-2xl font-bold text-foreground">
                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(0)}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-muted-foreground font-medium">
                            Información no disponible
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Historial de Períodos
                    </h3>
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {/* Skeleton loader */}
                        <div className="h-12 w-full bg-muted/20 rounded-lg animate-pulse" />
                        <div className="h-12 w-full bg-muted/20 rounded-lg animate-pulse" />
                        <div className="h-12 w-full bg-muted/20 rounded-lg animate-pulse" />
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={periods}
                        filterColumn="period_display" // This virtual column doesn't exist in data, but we filter by month_display usually. DataTable might need adjusting or we use year.
                        // Actually standard DataTable filters by string accessors. "status" is faceted.
                        searchPlaceholder="Buscar períodos..."
                        facetedFilters={[
                            {
                                column: "status",
                                title: "Estado",
                                options: [
                                    { label: "Abierto", value: "OPEN" },
                                    { label: "En Revisión", value: "UNDER_REVIEW" },
                                    { label: "Cerrado", value: "CLOSED" },
                                ]
                            }
                        ]}
                        renderCustomView={(table) => {
                            // Render same list style but using table model for pagination/filtering
                            const rows = table.getRowModel().rows
                            if (rows.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-3xl border-2 border-dashed">
                                        <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                        <p className="text-muted-foreground font-medium">No hay períodos encontrados</p>
                                    </div>
                                )
                            }

                            return (
                                <div className="grid gap-3">
                                    {rows.map((row: Row<any>) => {
                                        const period = row.original
                                        const summary = period.declaration_summary
                                        // Reconstruct the Card UI here using row data
                                        return (
                                            <div
                                                key={period.id}
                                                className="group flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
                                                onClick={() => handleOpenChecklist(period)}
                                            >
                                                <div className="flex items-center gap-4">
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
                                                                {summary ? `Folio ${summary.folio_number || 'N/A'}` : 'Sin Declaración'}
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
                                                        <div className="text-sm font-bold">
                                                            {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(summary?.vat_to_pay || 0)}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {(!summary?.is_fully_paid && (summary?.vat_to_pay > 0)) && (
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
                                                        <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                                                            <ArrowRight className="h-5 w-5 text-primary" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        }}
                    />
                )}
            </Card>

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

            {selectedDeclaration && (
                <PaymentDialog
                    open={isPaymentOpen}
                    onOpenChange={setIsPaymentOpen}
                    total={Number(selectedDeclaration.vat_to_pay || 0)}
                    pendingAmount={Number(selectedDeclaration.vat_to_pay || 0)}
                    onConfirm={handlePaymentConfirm}
                    title="Pagar Impuestos F29"
                    isPurchase={true}
                    hideDteFields={true}
                />
            )}
        </div>
    )
}
