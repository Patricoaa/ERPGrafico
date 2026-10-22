"use client"

import React, { useState, useMemo, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { toast } from "sonner"
import { CreatePayrollDrawer, PayrollDetailDrawer, deletePayroll, paySalary, payPrevired, createAdvance, triggerDraftPayrolls, usePayrollAnalyticsData } from '@/features/hr'
import type { Payroll } from "@/types/hr"
import { AnalyticsPanelContent, ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, type Granularity } from '@/components/shared'
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import { payrollActions, type PayrollActionsCtx } from '@/features/hr/payrollActions'
import { PaymentModal } from "@/features/treasury"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { usePayrolls } from "@/features/hr"
import { useServerDate } from "@/hooks/useServerDate"
import { payrollUnifiedSearchDef } from "@/features/hr/unifiedSearchDef"
import { payrollEntity, payrollViews } from "../entity-view/payroll.entity"
import { buildPayrollAnalyticsScreen } from "./payrollAnalyticsScreen"

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const PAYROLL_GROUPS: Record<string, FieldId<typeof payrollEntity.fields>> = { status: "status" }

interface PayrollClientViewProps {
    initialPayrolls?: Payroll[]
}

export function PayrollClientView({ initialPayrolls }: PayrollClientViewProps) {
    const { dateString } = useServerDate()

    const createAction = <ToolbarCreateButton label="Generar Liquidaciones" href="/hr/payrolls?modal=new" />

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const search = useUnifiedSearch(payrollUnifiedSearchDef)
    const groupBy = search.groupBy ? PAYROLL_GROUPS[search.groupBy] ?? null : null
    const { payrolls, isLoading: loading, isRefetching, isError, refetch: fetchPayrolls } = usePayrolls(search.filters, initialPayrolls)
    const { view, onViewChange } = useCollectionViewMode("hr.payroll")

    const [granularity, setGranularity] = useState<Granularity>("month")
    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("resumen")
    const analyticsData = usePayrollAnalyticsData(payrolls, granularity)
    const analyticsScreen = useMemo(
        () => buildPayrollAnalyticsScreen(analyticsData, { activeTab: analyticsActiveTab, onTabChange: setAnalyticsActiveTab, granularity, onGranularityChange: setGranularity }),
        [analyticsData, analyticsActiveTab, granularity],
    )

    const handleGenerateDrafts = useCallback(async () => {
        if (!confirm("¿Generar automáticamente liquidaciones borrador para todos los empleados activos este mes?")) return
        try {
            const res = await triggerDraftPayrolls()
            toast.success(res.detail)
            fetchPayrolls()
        } catch (err) {
            console.error('[PayrollClientView] Error al generar borradores:', err)
            const apiMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            toast.error(apiMsg || "Error al iniciar tarea")
        }
    }, [fetchPayrolls])

    const toolbarActions = (
        <>
            <Button variant="outline" size="sm" onClick={handleGenerateDrafts}>
                <FileText className="h-4 w-4 mr-1.5" />
                Generar borradores
            </Button>
            {createAction}
        </>
    )

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Payroll>({
        endpoint: '/hr/payrolls'
    })

    const detailSheetOpen = !!selectedFromUrl
    const activePayrollId = selectedFromUrl?.id ?? null

    const isNewModalOpen = searchParams.get("modal") === "new"
    // Derive from URL directly — no useState + useEffect needed
    const dialogOpen = isNewModalOpen

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.push(`?${params.toString()}`, { scroll: false })
        }
    }

    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null)
    const [paymentMode, setPaymentMode] = useState<'SALARY' | 'PREVIRED' | 'ADVANCE' | null>(null)

    const openDetail = (id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleConfirmPayment = async (data: Record<string, unknown>) => {
        if (!selectedPayroll || !paymentMode) return

        try {
            if (paymentMode === 'SALARY') {
                await paySalary(selectedPayroll.id, data)
                toast.success("Pago de remuneración registrado")
            } else if (paymentMode === 'PREVIRED') {
                await payPrevired(selectedPayroll.id, data)
                toast.success("Pago Previred registrado")
            } else if (paymentMode === 'ADVANCE') {
                await createAdvance({
                    employee: selectedPayroll.employee,
                    payroll: selectedPayroll.id,
                    amount: data.amount as string,
                    date: (data.documentDate as string) || dateString,
                    notes: "Anticipo de sueldo",
                    ...data
                })
                toast.success("Anticipo registrado")
            }
            setPaymentMode(null)
            setSelectedPayroll(null)
            fetchPayrolls()
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al procesar")
        }
    }

    const actionsCtx: PayrollActionsCtx = {
        onViewDetail: openDetail,
        onRegisterAdvance: (p) => { setSelectedPayroll(p); setPaymentMode('ADVANCE') },
        onPaySalary: (p) => { setSelectedPayroll(p); setPaymentMode('SALARY') },
        onPayPrevired: (p) => { setSelectedPayroll(p); setPaymentMode('PREVIRED') },
        onDeleteDraft: async (id) => {
            if (confirm("¿Eliminar borrador?")) {
                try {
                    await deletePayroll(id);
                    toast.success("Borrador eliminado");
                    fetchPayrolls();
                } catch {
                    toast.error("Error al eliminar");
                }
            }
        },
    }

    const collection = useEntityCollection(
        payrollEntity,
        { rows: payrolls, isLoading: loading, isRefetching, error: isError, refetch: fetchPayrolls, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <CreatePayrollDrawer
                open={dialogOpen}
                onOpenChange={handleOpenChange}
                onSaved={(id) => { handleOpenChange(false); openDetail(id) }}
            />

            <Collection.Root
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                onOpen={(payroll) => openDetail(payroll.id)}
                actions={payrollActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={toolbarActions}>
                    <UnifiedSearchBar config={payrollUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar por empleado o período..." />
                </Collection.Toolbar>
                <Collection.View
                    table={payrollViews.table}
                    card={payrollViews.card}
                    emptyTitle="Aún no hay nóminas"
                    emptyDescription="Genera una nómina para liquidar los sueldos del período."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
                <Collection.Analytics>
                    <AnalyticsPanelContent {...analyticsScreen} />
                </Collection.Analytics>
            </Collection.Root>

            <PayrollDetailDrawer
                payrollId={activePayrollId}
                open={detailSheetOpen}
                onOpenChange={(open) => {
                    if (!open) clearSelection()
                }}
                onUpdate={fetchPayrolls}
            />

            <PaymentModal
                open={!!paymentMode}
                onOpenChange={(o) => !o && setPaymentMode(null)}
                isPurchase={true}
                title={
                    paymentMode === 'SALARY' ? `Pagar Remuneración: ${selectedPayroll?.employee_name}` :
                        paymentMode === 'PREVIRED' ? `Pagar Previred: ${selectedPayroll?.employee_name}` :
                            `Registrar Anticipo: ${selectedPayroll?.employee_name}`
                }
                total={
                    paymentMode === 'SALARY' ? (selectedPayroll ? (Number(selectedPayroll.net_salary) - Number(selectedPayroll.advances_total || 0)) : 0) :
                        paymentMode === 'PREVIRED' ? Number(selectedPayroll?.total_previred || 0) :
                            Number(selectedPayroll?.net_salary || 0)
                }
                pendingAmount={
                    paymentMode === 'SALARY' ? (selectedPayroll ? (Number(selectedPayroll.net_salary) - Number(selectedPayroll.advances_total || 0)) : 0) :
                        paymentMode === 'PREVIRED' ? Number(selectedPayroll?.total_previred || 0) :
                            Number(selectedPayroll?.net_salary || 0)
                }
                onConfirm={handleConfirmPayment}
            />
        </div>
    )
}
