"use client"
import { formatCurrency } from "@/lib/money"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    CheckCircle2,
    AlertCircle,
    Package,
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { DeclarationWizard } from "@/features/tax/components/DeclarationWizard"
import { F29PaymentModal } from "@/features/tax/components/F29PaymentModal"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useServerDate } from "@/hooks/useServerDate"
import { DataTableView, EntityCard } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { taxDeclarationActions, type TaxDeclarationActionsCtx } from './taxDeclarationActions'
import { cn } from "@/lib/utils"
import { taxPeriodFields } from '../taxPeriodFields'
import { AutoEntityCard } from '@/components/shared'

import { type TaxPeriod, type TaxDeclaration, type TaxPaymentData } from "../types"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { type Row, type Table } from "@tanstack/react-table"
import { SkeletonShell, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import type { UnifiedSearchConfig } from '@/types/unified-search'
import { useTaxPeriods, useLazyTaxDeclarations } from "../hooks/useTaxQueries"
import { useCreateTaxPayment } from "../hooks/useTaxMutations"

interface TaxDeclarationsClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function TaxDeclarationsClientView({ externalOpen, onExternalOpenChange, createAction }: TaxDeclarationsClientViewProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const [selectedDeclaration, setSelectedDeclaration] = useState<TaxDeclaration | null>(null)
    const { entity: selectedFromUrl } = useSelectedEntity<TaxPeriod>({
        endpoint: '/tax/periods'
    })

    const { taxPeriods: periodsData, isLoading: isLoadingPeriods, refetch: refetchPeriods } = useTaxPeriods()
    const { fetchDeclarations } = useLazyTaxDeclarations()
    const { createTaxPayment } = useCreateTaxPayment()

    const periods = ((periodsData as { results?: TaxPeriod[] })?.results ?? []) as TaxPeriod[]
    const isLoading = isLoadingPeriods

    const action = searchParams.get('action')
    const isWizardOpen = !!selectedFromUrl && (!action || action !== 'pay')
    const isPaymentOpen = !!selectedFromUrl && action === 'pay'

    const handleCloseModal = () => {
        setSelectedDeclaration(null)
        onExternalOpenChange?.(false)

        const params = new URLSearchParams(searchParams.toString())
        params.delete("selected")
        params.delete("action")
        params.delete("modal")
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const openPaymentModal = async (period: TaxPeriod) => {
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
        } else {
            try {
                const declarations = await fetchDeclarations({ tax_period__year: period.year, tax_period__month: period.month })
                if (declarations.length > 0) {
                    setSelectedDeclaration({
                        ...declarations[0],
                        tax_period_display: `${period.month_display} ${period.year}`
                    })
                } else {
                    toast.error("No se encontró una declaración válida para pagar")
                }
            } catch {
                toast.error("Error al buscar la declaración")
            }
        }
    }

    // Trigger payment data fetch when URL has action=pay
    useEffect(() => {
        if (selectedFromUrl && action === 'pay') {
            requestAnimationFrame(() => {
                openPaymentModal(selectedFromUrl)
            })
        }
    }, [selectedFromUrl, action])

    const handleOpenWizard = (period: TaxPeriod) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(period.id))
        params.delete('action')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleOpenPayment = (period: TaxPeriod) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(period.id))
        params.set('action', 'pay')
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const { serverDate, dateString } = useServerDate()

    const handlePaymentConfirm = async (data: TaxPaymentData) => {
        if (!selectedDeclaration) return
        try {
            await createTaxPayment({
                declaration: selectedDeclaration.id,
                payment_date: data.documentDate || dateString || "",
                amount: data.amount,
                payment_method: data.paymentMethod,
                reference: data.reference || '',
                treasury_account: data.treasury_account_id,
                notes: `Pago F29 - ${selectedDeclaration.tax_period_display}`
            })

            toast.success("Pago de impuestos registrado correctamente")
            handleCloseModal()
        } catch {
            // Error handled by mutation's onError
        }
    }

    const config: UnifiedSearchConfig = useMemo(() => ({
        searchFields: [
            { key: 'month_display', label: 'Período', serverParam: 'month_display', clientKey: ['month_display', 'year'] },
        ],
    }), [])
    const search = useUnifiedSearch(config)
    const filteredPeriods = useMemo(() => search.filterFn(periods), [search.filterFn, periods])

    const latestPeriod = periods.length > 0 ? periods[0] : null
    const currentPeriodDisplay = latestPeriod
        ? `${latestPeriod.month_display} ${latestPeriod.year}`.toUpperCase()
        : (serverDate
            ? format(serverDate, "MMMM yyyy", { locale: es }).toUpperCase()
            : format(new Date(), "MMMM yyyy", { locale: es }).toUpperCase())
    const isLatestClosed = latestPeriod?.status === 'CLOSED'
    const currentVatToPay = latestPeriod?.declaration_summary?.vat_to_pay || 0

    const taxDeclarationActionsCtx: TaxDeclarationActionsCtx = {
        onPayment: (period) => handleOpenPayment(period as TaxPeriod),
        onWizard: (period) => handleOpenWizard(period as TaxPeriod),
    }

    const columns: ColumnDef<TaxPeriod>[] = useMemo(() => [
        ...taxPeriodFields.toColumns(),
        taxDeclarationActions.auto(taxDeclarationActionsCtx) as ColumnDef<TaxPeriod>,
    ], [])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 shrink-0">
                <SkeletonShell isLoading={isLoading} ariaLabel="Cargando períodos tributarios">
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
                                {formatCurrency(currentVatToPay)}
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
                </SkeletonShell>
            </div>

            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={filteredPeriods}
                    isLoading={isLoading}
                    entityLabel="tax.taxperiod"
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={config}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar período..."
                    />}
                    createAction={createAction}
                    renderLoadingView={useCallback(() => (
                        <div className="grid gap-3 pt-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <EntityCard.Skeleton key={i} variant="compact" />
                            ))}
                        </div>
                    ), [])}
                    renderCustomView={useCallback((table: Table<TaxPeriod>) => {
                        const rows = table.getRowModel().rows

                        if (rows.length === 0) {
                            return (
                                <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-md border-2 border-dashed">
                                    <Package className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                                    <p className="text-muted-foreground font-medium">No se encontraron períodos</p>
                                </div>
                            )
                        }
                        return (
                            <div className="grid gap-3 pt-2">
                                {rows.map((row: Row<TaxPeriod>) => {
                                    const period = row.original
                                    const canOpenChecklist = period.status === 'OPEN'

                                        return (
                                        <AutoEntityCard
                                            key={period.id}

                                            data={period}
                                            fields={taxPeriodFields}
                                            className={cn(
                                                "flex flex-col justify-between",
                                                canOpenChecklist ? "cursor-pointer" : "cursor-default"
                                            )}
                                            onClick={() => canOpenChecklist ? handleOpenWizard(period) : null}
                                            actions={taxDeclarationActions.render(period, taxDeclarationActionsCtx)}
                                        />
                                    )
                                })}
                            </div>
                        )
                    }, [handleOpenWizard, handleOpenPayment])}
                />
            </div>
            <DeclarationWizard
                isOpen={isWizardOpen || !!externalOpen}
                onOpenChange={(open) => !open && handleCloseModal()}
                periodId={selectedFromUrl?.id}
                onSuccess={() => {
                    refetchPeriods()
                    handleCloseModal()
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
