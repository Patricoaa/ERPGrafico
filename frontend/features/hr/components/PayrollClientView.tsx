"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import React, { useState, useMemo, useCallback } from "react"
import { toast } from "sonner"
import { CreatePayrollDrawer, deletePayroll, paySalary, payPrevired, triggerDraftPayrolls, usePayrollAnalyticsData } from '@/features/hr'
import type { Payroll } from "@/types/hr"
import { AnalyticsPanelContent, ToolbarCreateButton, type Granularity } from '@/components/shared'
import { Collection, useCollectionAnalytics, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import { payrollActions, type PayrollActionsCtx } from '@/features/hr/payrollActions'
import { PaymentModal } from "@/features/treasury"
import { usePayrolls } from "@/features/hr"
import { useServerDate } from "@/hooks/useServerDate"
import { payrollEntity, payrollViews } from "../entity-view/payroll.entity"
import { buildPayrollAnalyticsScreen } from "./payrollAnalyticsScreen"


interface PayrollClientViewProps {
    initialPayrolls?: Payroll[]
}

export function PayrollClientView({ initialPayrolls }: PayrollClientViewProps) {
    const { dateString } = useServerDate()

    const createAction = <ToolbarCreateButton label="Generar Liquidaciones" href="/hr/payrolls?modal=new" />

    const query = useCollectionQuery(payrollEntity, { sorting: "client" })
    const { search, groupBy } = query
    const { payrolls, isLoading: loading, isRefetching, isError, refetch: fetchPayrolls } = usePayrolls(query.params, initialPayrolls)
    const { view, onViewChange } = useCollectionViewMode("hr.payroll")

    const [granularity, setGranularity] = useState<Granularity>("month")
    const analyticsUi = useCollectionAnalytics("resumen")
    const analyticsData = usePayrollAnalyticsData(payrolls, granularity)
    const analyticsScreen = useMemo(
        () => buildPayrollAnalyticsScreen(analyticsData, { activeTab: analyticsUi.tab, onTabChange: analyticsUi.onTabChange, granularity, onGranularityChange: setGranularity }),
        [analyticsData, analyticsUi.tab, analyticsUi.onTabChange, granularity],
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

    // `?modal=new` crea una nómina; `?selected` abre el detalle (dos paneles sobre la misma ruta).
    const createPanel = useCreatePanelRoute({ actions: [] })
    const { openEntity } = useGlobalModals()
    // ADR-0152: cada nómina abre su propia pestaña; `?selected` solo es enlace profundo.
    useDeepLinkEntity("hr.payroll")

    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null)
    const [paymentMode, setPaymentMode] = useState<'SALARY' | 'PREVIRED' | null>(null)

    const openDetail = (id: number) => openEntity("hr.payroll", id)

    const handleConfirmPayment = async (data: Record<string, unknown>) => {
        if (!selectedPayroll || !paymentMode) return

        try {
            if (paymentMode === 'SALARY') {
                await paySalary(selectedPayroll.id, data)
                toast.success("Pago de remuneración registrado")
            } else if (paymentMode === 'PREVIRED') {
                await payPrevired(selectedPayroll.id, data)
                toast.success("Pago Previred registrado")
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
        onAssignDeductions: (p) => openDetail(p.id),
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
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy, sorting: query.sorting },
    )

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <EntityPanelTab label="hr.payroll" {...createPanel.tab}>
                {(open) => (
                    <CreatePayrollDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) createPanel.close() }}
                        onSaved={(id) => { createPanel.close(); openDetail(id) }}
                    />
                )}
            </EntityPanelTab>

            <Collection.Root
                analytics={analyticsUi}
                query={query}
                collection={collection}
                view={view}
                onViewChange={onViewChange}
                actions={payrollActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={toolbarActions} />
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


            <PaymentModal
                open={!!paymentMode}
                onOpenChange={(o) => !o && setPaymentMode(null)}
                isPurchase={true}
                title={
                    paymentMode === 'SALARY' ? `Pagar Remuneración: ${selectedPayroll?.employee_name}` :
                        `Pagar Previred: ${selectedPayroll?.employee_name}`
                }
                total={
                    paymentMode === 'SALARY' ? (selectedPayroll ? (Number(selectedPayroll.net_salary) - Number(selectedPayroll.advances_total || 0)) : 0) :
                        Number(selectedPayroll?.total_previred || 0)
                }
                pendingAmount={
                    paymentMode === 'SALARY' ? (selectedPayroll ? (Number(selectedPayroll.net_salary) - Number(selectedPayroll.advances_total || 0)) : 0) :
                        Number(selectedPayroll?.total_previred || 0)
                }
                onConfirm={handleConfirmPayment}
            />
        </div>
    )
}
