"use client"

import { showApiError } from "@/lib/errors"
import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    DollarSign,
    Package,
    History as HistoryIcon
} from "lucide-react"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { DeclarationWizard } from "@/features/tax/components/DeclarationWizard"
import { F29PaymentModal } from "@/features/tax/components/F29PaymentModal"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useServerDate } from "@/hooks/useServerDate"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { TaxPeriod, TaxDeclaration, TaxPaymentData } from "../types"
import { Row } from "@tanstack/react-table"
import { CardSkeleton, TableSkeleton } from "@/components/shared"

interface TaxDeclarationsViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function TaxDeclarationsView({ externalOpen, onExternalOpenChange, createAction }: TaxDeclarationsViewProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const [periods, setPeriods] = useState<TaxPeriod[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isWizardOpen, setIsWizardOpen] = useState(false)
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)
    const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>(undefined)
    const [selectedDeclaration, setSelectedDeclaration] = useState<TaxDeclaration | null>(null)

    const handleCloseModal = () => {
        setIsWizardOpen(false)
        setIsPaymentOpen(false)
        onExternalOpenChange?.(false)
        
        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            params.delete("year")
            params.delete("month")
            params.delete("action")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleWizardOpenChange = (open: boolean) => {
        if (!open) {
            handleCloseModal()
        } else {
            setIsWizardOpen(true)
        }
    }

    const fetchPeriods = async () => {
        setIsLoading(true)
        try {
            const response = await api.get<{ results?: TaxPeriod[] } | TaxPeriod[]>("/tax/periods/?page_size=100")
            const fetchedPeriods = (response.data as { results?: TaxPeriod[] }).results || (response.data as TaxPeriod[])
            setPeriods(fetchedPeriods)
            
            const year = searchParams.get('year')
            const month = searchParams.get('month')
            const action = searchParams.get('action')

            if (year && month && fetchedPeriods.length > 0) {
                const target = fetchedPeriods.find((p: TaxPeriod) => 
                    p.year.toString() === year && p.month.toString() === month
                )
                if (target) {
                    if (action === 'pay') {
                        handleOpenPayment(target)
                    } else {
                        handleOpenWizard(target)
                    }
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

    useEffect(() => {
        if (externalOpen) {
            setIsWizardOpen(true)
        }
    }, [externalOpen])

    const handleOpenWizard = (period: TaxPeriod) => {
        setSelectedPeriodId(period.id)
        setIsWizardOpen(true)
    }

    const handleOpenPayment = async (period: TaxPeriod) => {
        if (period.declaration_summary) {
            setSelectedDeclaration({
                id: period.declaration_summary.id,
                vat_to_pay: period.declaration_summary.vat_to_pay,
                total_paid: period.declaration_summary.total_paid,
                is_fully_paid: period.declaration_summary.is_fully_paid,
                payments: period.declaration_summary.payments || [],
                folio_number: period.declaration_summary.folio_number,
                tax_period_display: `${period.month_display} ${period.year}`,
                tax_period_year: period.year,
                tax_period_month: period.month,
                ppm_amount: 0,
                withholding_tax: 0,
                vat_credit_carryforward: 0,
                vat_correction_amount: 0,
                second_category_tax: 0,
                loan_retention: 0,
                ila_tax: 0,
                vat_withholding: 0,
                tax_rate: 0
            })
            setIsPaymentOpen(true)
        } else {
            try {
                const resp = await api.get<{ results?: TaxDeclaration[] } | TaxDeclaration[]>(`/tax/declarations/?tax_period__year=${period.year}&tax_period__month=${period.month}`)
                const declarations = (resp.data as { results?: TaxDeclaration[] }).results || (resp.data as TaxDeclaration[])
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

    const { serverDate, dateString } = useServerDate()

    const handlePaymentConfirm = async (data: TaxPaymentData) => {
        if (!selectedDeclaration) return
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
        } catch (error: unknown) {
            console.error("Error saving payment:", error)
            showApiError(error, "Error al registrar el pago")
        }
    }

    const latestPeriod = periods.length > 0 ? periods[0] : null
    const currentPeriodDisplay = latestPeriod
        ? `${latestPeriod.month_display} ${latestPeriod.year}`.toUpperCase()
        : (serverDate
            ? format(serverDate, "MMMM yyyy", { locale: es }).toUpperCase()
            : format(new Date(), "MMMM yyyy", { locale: es }).toUpperCase())

    const isLatestClosed = latestPeriod?.status === "CLOSED"
    const currentVatToPay = latestPeriod?.declaration_summary?.vat_to_pay || 0

    const columns: ColumnDef<TaxPeriod>[] = [
        {
            accessorKey: "period_display",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Período" className="justify-center" />,
            cell: ({ row }) => (
                <div className="flex items-center justify-center gap-3 w-full">
                    <div className="w-10 h-10 rounded-lg bg-primary/5 flex flex-col items-center justify-center border border-primary/10">
                        <span className="text-[9px] font-bold text-primary/60">{row.original.year}</span>
                        <span className="text-xs font-bold text-primary">{row.original.month_display?.substring(0, 3)}</span>
                    </div>
                    <div>
                        <span className="font-medium">{row.original.month_display || ''} {row.original.year}</span>
                    </div>
                </div>
            ),
            sortingFn: (rowA, rowB, columnId) => {
                if (rowA.original.year !== rowB.original.year) {
                    return rowA.original.year - rowB.original.year
                }
                return rowA.original.month - rowB.original.month
            }
        },
        {
            accessorKey: "status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
            cell: ({ row }) => <div className="flex justify-center w-full"><StatusBadge status={row.original.status} /></div>,
            filterFn: (row, id, value) => value.includes(row.getValue(id))
        },
        {
            id: "vat_to_pay",
            accessorFn: (row) => row.declaration_summary?.vat_to_pay || 0,
            header: ({ column }) => <DataTableColumnHeader column={column} title="Impuesto Determinado" className="justify-center" />,
            cell: ({ row }) => {
                const amount = row.getValue("vat_to_pay") as number
                return (
                    <div className="flex justify-center w-full font-mono">
                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount)}
                    </div>
                )
            }
        },
        {
            accessorKey: "payment_status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado Pago" className="justify-center" />,
            cell: ({ row }) => {
                const summary = row.original.declaration_summary
                return (
                    <div className="flex justify-center w-full">
                        {!summary ? (
                            <span className="text-muted-foreground">-</span>
                        ) : summary.is_fully_paid ? (
                            <StatusBadge status="PAID" label="Pagado" size="sm" />
                        ) : summary.vat_to_pay > 0 && row.original.status === 'CLOSED' ? (
                            <StatusBadge status="VOIDED" label="Pendiente" size="sm" />
                        ) : (
                            <span className="text-muted-foreground">-</span>
                        )}
                    </div>
                )
            }
        },
        createActionsColumn<TaxPeriod>({
            renderActions: (period) => {
                const summary = period.declaration_summary
                const isFullyPaid = summary?.is_fully_paid
                const showPaymentButton = !!summary || period.status === 'CLOSED'
                const canOpenChecklist = period.status === 'OPEN'

                return (
                    <>
                        {showPaymentButton && (
                            <DataCell.Action 
                                icon={isFullyPaid ? HistoryIcon : DollarSign} 
                                title={isFullyPaid ? "Ver Pagos" : "Pagar"} 
                                onClick={(e) => { e.stopPropagation(); handleOpenPayment(period); }}
                                className={isFullyPaid ? "text-success" : "text-success"}
                            />
                        )}
                        {canOpenChecklist && (
                            <DataCell.Action 
                                icon={ArrowRight} 
                                title="Iniciar declaración/cierre F29" 
                                onClick={(e) => { e.stopPropagation(); handleOpenWizard(period); }} 
                            />
                        )}
                    </>
                )
            }
        })
    ]

    return (
        <div className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {isLoading ? (
                    <CardSkeleton count={3} variant="grid" />
                ) : (
                    <>
                        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Período Actual</CardTitle>
                                <CardDescription className="text-2xl font-bold text-foreground">
                                    {currentPeriodDisplay}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLatestClosed ? (
                                    <div className="flex items-center gap-2 text-sm text-success font-medium">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Período Cerrado
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm text-warning font-medium">
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

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Último Remanente</CardTitle>
                                <CardDescription className="text-2xl font-bold text-foreground">
                                    -
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground font-medium">
                                    Información no disponible
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            <DataTable
                columns={columns}
                data={periods}
                isLoading={isLoading}
                cardMode
                filterColumn="period_display"
                searchPlaceholder="Buscar período..."
                useAdvancedFilter={true}
                showToolbarSort={true}
                createAction={createAction}
                facetedFilters={[
                    {
                        column: "status",
                        title: "Estado",
                        options: [
                            { label: "Abierto", value: "OPEN" },
                            { label: "Cerrado", value: "CLOSED" },
                            { label: "En Revisión", value: "UNDER_REVIEW" },
                        ]
                    }
                ]}
                renderCustomView={(table) => {
                    const rows = table.getRowModel().rows
                    
                    if (isLoading) {
                        return (
                            <div className="pt-2">
                                <TableSkeleton rows={5} columns={4} />
                            </div>
                        )
                    }

                    if (rows.length === 0) {
                        return (
                            <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-lg border-2 border-dashed">
                                <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                <p className="text-muted-foreground font-medium">No se encontraron períodos</p>
                            </div>
                        )
                    }
                    return (
                        <div className="grid gap-3 pt-2">
                            {rows.map((row: Row<TaxPeriod>) => {
                                const period = row.original
                                const summary = period.declaration_summary
                                const isFullyPaid = summary?.is_fully_paid
                                const showPaymentButton = !!summary || period.status === 'CLOSED'
                                const canOpenChecklist = period.status === 'OPEN'

                                return (
                                    <div
                                        key={period.id}
                                        className={cn(
                                            "group flex items-center justify-between p-4 bg-card border border-border/50 rounded-lg transition-all",
                                            canOpenChecklist ? "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 cursor-pointer" : "cursor-default"
                                        )}
                                        onClick={() => canOpenChecklist ? handleOpenWizard(period) : null}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-primary/5 flex flex-col items-center justify-center border border-primary/10">
                                                <span className="text-[10px] font-bold text-primary/60">{period.year}</span>
                                                <span className="text-sm font-bold text-primary">{period.month_display?.substring(0, 3).toUpperCase() || ''}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-lg text-foreground">
                                                        {period.month_display} {period.year}
                                                    </h4>
                                                    <StatusBadge status={period.status} />
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {summary ? (
                                                        <>
                                                            {summary.is_fully_paid ? (
                                                                <StatusBadge status="PAID" label="Pagado" size="sm" />
                                                            ) : (
                                                                summary.vat_to_pay > 0 && period.status === 'CLOSED' && (
                                                                    <StatusBadge status="VOIDED" label="Pago Pendiente" size="sm" />
                                                                )
                                                            )}
                                                            <div className="sm:hidden flex items-center gap-1 text-xs text-muted-foreground font-mono">
                                                                <DollarSign className="h-3 w-3" />
                                                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(summary.vat_to_pay)}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Sin declaración registrada</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            {summary && (
                                                <div className="text-right min-w-[120px] hidden sm:block">
                                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Impuesto Det.</div>
                                                    <div className="text-sm font-bold text-primary">
                                                        {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(summary.vat_to_pay)}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {showPaymentButton && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className={cn(
                                                            "h-9 rounded-lg border-success/30 text-success hover:bg-success/5",
                                                            isFullyPaid
                                                                ? "border-success/20 text-success"
                                                                : "border-success/30 text-success"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenPayment(period);
                                                        }}
                                                    >
                                                        {isFullyPaid ? (
                                                            <>
                                                                <HistoryIcon className="h-4 w-4 mr-2" />
                                                                Ver Pagos
                                                            </>
                                                        ) : (
                                                            <>
                                                                <DollarSign className="h-4 w-4 mr-2" />
                                                                Pagar
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                                {canOpenChecklist && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-10 w-10 rounded-lg group-hover:translate-x-1 transition-transform"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenWizard(period);
                                                        }}
                                                        title="Iniciar declaración/cierre F29"
                                                    >
                                                        <ArrowRight className="h-5 w-5 text-primary" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                }}
            />
            <DeclarationWizard
                isOpen={isWizardOpen || !!externalOpen}
                onOpenChange={handleWizardOpenChange}
                periodId={selectedPeriodId}
                onSuccess={() => {
                    fetchPeriods()
                    setIsWizardOpen(false)
                    setSelectedPeriodId(undefined)
                }}
                existingPeriods={periods}
            />

            {selectedDeclaration && (
                <F29PaymentModal
                    isOpen={isPaymentOpen}
                    onOpenChange={(open) => !open && handleCloseModal()}
                    declaration={selectedDeclaration}
                    onConfirmPayment={handlePaymentConfirm}
                />
            )}
        </div>
    )
}
