"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"
import { useStatementQuery } from "@/features/finance/bank-reconciliation/hooks/useReconciliationQueries"
import { ReconciliationPanel } from "@/features/treasury"
import { DataCell } from "@/components/ui/data-table-cells"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import api from "@/lib/api"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { TableSkeleton } from "@/components/shared"
import { PageHeader } from "@/components/shared/PageHeader"

export default function WorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    
    const statementId = parseInt(id)
    const { data: statement, isLoading, refetch } = useStatementQuery(statementId)

    const confirmAction = useConfirmAction(async () => {
        try {
            await api.post(`/treasury/statements/${statementId}/confirm/`)
            toast.success('Cartola confirmada exitosamente')
            router.push('/treasury/reconciliation')
        } catch (error: unknown) {
            console.error('Error confirming statement:', error)
            showApiError(error, 'Error al confirmar cartola')
        }
    })

    if (isLoading) {
        return (
            <div className="flex-1 p-8 pt-6">
                <TableSkeleton rows={12} columns={5} />
            </div>
        )
    }

    if (!statement) {
        return (
            <div className="flex-1 p-8 flex items-center justify-center">
                <p className="text-muted-foreground">No se encontró la cartola.</p>
            </div>
        )
    }

    const navigation = {
        tabs: [
            { value: "movements", label: "Movimientos", iconName: "banknote", href: "/treasury?view=movements" },
            { 
                value: "accounts", 
                label: "Cuentas y Caja", 
                iconName: "landmark", 
                href: "/treasury?view=accounts",
                subTabs: [
                    { value: "accounts", label: "Cuentas", href: "/treasury?view=accounts&sub=accounts" },
                    { value: "banks", label: "Bancos", href: "/treasury?view=accounts&sub=banks" },
                    { value: "methods", label: "Métodos", href: "/treasury?view=accounts&sub=methods" },
                ]
            },
            { 
                value: "reconciliation", 
                label: "Conciliación", 
                iconName: "history", 
                href: "/treasury?view=reconciliation",
                subTabs: [
                    { value: "statements", label: "Cartolas", iconName: "file-text", href: "/treasury?view=reconciliation&sub=statements" },
                    { value: "dashboard", label: "Dashboard", iconName: "bar-chart-3", href: "/treasury?view=reconciliation&sub=dashboard" },
                    { value: "intelligence", label: "Inteligencia", iconName: "brain", href: "/treasury?view=reconciliation&sub=intelligence" },
                ]
            },
            { 
                value: "config", 
                label: "Config", 
                iconName: "settings", 
                href: "/treasury?view=config",
                subTabs: [
                    { value: "conciliation", label: "Conciliación", href: "/treasury?view=config&tab=conciliation", iconName: "arrow-left-right" },
                    { value: "audit", label: "Arqueo", href: "/treasury?view=config&tab=audit", iconName: "banknote" },
                    { value: "movements", label: "Movimientos", href: "/treasury?view=config&tab=movements", iconName: "settings-2" }
                ]
            },
        ],
        activeValue: "reconciliation",
        subActiveValue: "statements",
        breadcrumbs: [
            { label: statement.display_id, href: `/treasury/reconciliation/${statement.id}` },
            { label: "Mesa de Conciliación" }
        ]
    }

    return (
        <div className="flex-1 space-y-4 pt-2 h-full flex flex-col">
            <PageHeader
                title="Mesa de Conciliación"
                description={`${statement.display_id} — ${statement.treasury_account_name}`}
                variant="minimal"
                navigation={navigation}
                status={{
                    label: statement.state_display || statement.state,
                    type: statement.state === 'CONFIRMED' ? 'synced' : 'info'
                }}
                titleActions={
                    statement.reconciliation_progress === 100 && statement.state !== 'CONFIRMED' && (
                        <Button
                            onClick={confirmAction.requestConfirm}
                            disabled={confirmAction.isConfirming}
                            className="bg-success hover:bg-success/90 shadow-sm px-5 font-bold text-sm"
                        >
                            {confirmAction.isConfirming ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Finalizando...</>
                            ) : (
                                <><CheckCircle2 className="mr-2 h-4 w-4" />Confirmar Cartola</>
                            )}
                        </Button>
                    )
                }
            />

            <ReconciliationPanel
                statementId={statement.id}
                treasuryAccountId={statement.treasury_account}
                onComplete={() => refetch()}
            />

            <ActionConfirmModal
                open={confirmAction.isOpen}
                onOpenChange={(open) => { if (!open) confirmAction.cancel() }}
                onConfirm={confirmAction.confirm}
                title="Confirmar Cartola"
                description="¿Está seguro de confirmar esta cartola? Esto validará todas las conciliaciones, actualizará los saldos de la cuenta y bloqueará la cartola para futuras modificaciones."
                confirmText="Confirmar"
            />
        </div>
    )
}
