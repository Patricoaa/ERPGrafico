"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Activity, CheckCircle2, Download, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useConfirmStatement } from "@/features/treasury"
import { ActionConfirmModal, DocumentActionsMenu, Drawer, SkeletonShell, SubmitButton, type DocumentActionItem } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { showApiError } from "@/lib/errors"
import { formatCurrency } from "@/lib/money"
import { cn, parseDateOnly } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useStatementQuery } from "../hooks/useReconciliationQueries"
import { reconciliationKeys } from "../hooks/queryKeys"
import { useDeleteStatementMutation, useDownloadStatementFile } from "../hooks/useReconciliationMutations"
import { canDeleteStatement, deleteBlockedReason } from "../lib/statementRules"
import type { BankStatement } from "../types"
import { ReconciliationPanel } from "./ReconciliationPanel"

interface ReconciliationWorkbenchTabProps {
    statementId: number
    /** Cierra la pestaña de la mesa (sin guarda: no hay formulario que proteger). */
    onClose: () => void
    /** La cartola quedó confirmada: la pestaña ya cumplió su función. */
    onConfirmed: () => void
}

/**
 * Mesa de conciliación como pestaña del espacio de trabajo (`openWorkbench`).
 * Anatomía de la ficha documental (`DocumentDrawerShell`): título y subtítulo en el encabezado,
 * acciones secundarias en el menú del encabezado, franja de avance y pie con la acción principal.
 * El trabajo lo hace `ReconciliationPanel`.
 */
export function ReconciliationWorkbenchTab({ statementId, onClose, onConfirmed }: ReconciliationWorkbenchTabProps) {
    const queryClient = useQueryClient()
    const statementQuery = useStatementQuery(statementId)
    const statement = statementQuery.data as BankStatement | undefined
    const confirmMutation = useConfirmStatement()
    const deleteMutation = useDeleteStatementMutation()
    const { mutate: downloadFile } = useDownloadStatementFile()
    const [deleteOpen, setDeleteOpen] = useState(false)

    const confirmAction = useConfirmAction(async () => {
        try {
            await confirmMutation.mutateAsync(statementId)
            toast.success("Cartola confirmada exitosamente")
            await queryClient.invalidateQueries({ queryKey: reconciliationKeys.statements() })
            onConfirmed()
        } catch (error: unknown) {
            showApiError(error, "Error al confirmar cartola")
        }
    })

    const handleDelete = async () => {
        try {
            await deleteMutation.mutateAsync(statementId)
            setDeleteOpen(false)
            onClose()
        } catch {
            // El hook de eliminación ya muestra el error.
        }
    }

    // Pendiente = sin conciliar o con match sin confirmar. Las excluidas ya están resueltas.
    // Mismo criterio que el backend (confirm) más MATCHED, que debe confirmarse antes.
    const pending = statement?.lines
        ? statement.lines.filter((line) => line.reconciliation_status === "UNRECONCILED" || line.reconciliation_status === "MATCHED").length
        : null
    const canConfirm = !!statement && statement.state === "DRAFT" && pending === 0
    const canDelete = !!statement && canDeleteStatement(statement)
    const deniedDelete = statement ? deleteBlockedReason(statement) : null

    const headerActions: DocumentActionItem[] = statement ? [
        {
            id: "download",
            label: "Descargar original",
            icon: Download,
            onClick: () => downloadFile({ statementId: statement.id, fileName: statement.file_name ?? statement.display_id }),
            disabled: !statement.has_file,
            disabledReason: statement.has_file ? undefined : "La cartola no tiene archivo original.",
        },
    ] : []

    return (
        <>
        {/* Como las fichas documentales: la pestaña ocupa el área de trabajo mediante `Drawer` (en modo
            persistente se expande al 100 %). Un `div` suelto en la página quedaba fuera de la vista. */}
        <Drawer
            open
            onOpenChange={(open) => { if (!open) onClose() }}
            side="bottom"
            boundary="embedded"
            defaultSize="100%"
            resizable={false}
            title={statementTitle(statement)}
            subtitle={statement?.treasury_account_name}
            icon={Activity}
            headerActions={statement && <DocumentActionsMenu primary={null} actions={headerActions} />}
            footer={statement && (
                <WorkbenchFooter
                    statement={statement}
                    pending={pending}
                    canConfirm={canConfirm}
                    confirming={confirmAction.isConfirming}
                    onConfirm={() => confirmAction.requestConfirm()}
                    canDelete={canDelete}
                    deniedDelete={deniedDelete}
                    onDelete={() => setDeleteOpen(true)}
                />
            )}
            fillContent
            contentClassName="p-0"
        >
            <div className="flex h-full min-h-0 flex-col">
                <WorkbenchHeader statement={statement} loading={statementQuery.isLoading} />

                <div className="min-h-0 flex-1 overflow-hidden p-4">
                    <SkeletonShell isLoading={statementQuery.isLoading} ariaLabel="Cargando mesa de conciliación">
                        {statement && (
                            <ReconciliationPanel
                                statementId={statementId}
                                treasuryAccountId={statement.treasury_account}
                                onComplete={() => { void statementQuery.refetch() }}
                            />
                        )}
                    </SkeletonShell>
                </div>
            </div>
        </Drawer>

        <ActionConfirmModal
            open={confirmAction.isOpen}
            onOpenChange={(open) => { if (!open) confirmAction.cancel() }}
            onConfirm={confirmAction.confirm}
            title="Confirmar Cartola"
            description="¿Está seguro de confirmar esta cartola? Esto validará todas las conciliaciones, actualizará los saldos de la cuenta y bloqueará la cartola para futuras modificaciones."
            confirmText="Confirmar"
        />

        <ActionConfirmModal
            open={deleteOpen}
            onOpenChange={(open) => { if (!open) setDeleteOpen(false) }}
            onConfirm={handleDelete}
            title={`Eliminar ${statement?.display_id ?? "cartola"}`}
            description="Se eliminará el borrador, sus líneas y el archivo original importado. No se puede deshacer."
            variant="destructive"
            confirmText="Eliminar"
        />
        </>
    )
}

function statementTitle(statement: BankStatement | undefined): string {
    return statement ? `Mesa de conciliación · ${statement.display_id}` : "Mesa de conciliación"
}

/** Franja de avance de la cartola: periodo, saldos y progreso de conciliación. */
function WorkbenchHeader({ statement, loading }: { statement: BankStatement | undefined; loading: boolean }) {
    const progress = statement?.reconciliation_progress ?? 0
    const period = statement?.statement_date
        ? format(parseDateOnly(statement.statement_date), "dd MMM yyyy", { locale: es })
        : null

    return (
        <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-card px-4 py-3">
            <p className="font-mono text-3xs tabular-nums text-muted-foreground">
                {loading ? "Cargando cartola…" : period ?? "Cartola no disponible"}
            </p>

            {statement && (
                <dl className="flex items-center gap-5 text-xs">
                    <div>
                        <dt className="text-3xs uppercase tracking-wider text-muted-foreground">Saldo inicial</dt>
                        <dd className="font-mono tabular-nums text-foreground">{formatCurrency(Number(statement.opening_balance))}</dd>
                    </div>
                    <div>
                        <dt className="text-3xs uppercase tracking-wider text-muted-foreground">Saldo final</dt>
                        <dd className="font-mono tabular-nums text-foreground">{formatCurrency(Number(statement.closing_balance))}</dd>
                    </div>
                </dl>
            )}

            {statement && (
                <div className="ml-auto flex w-56 flex-col gap-1.5" aria-label="Avance de la conciliación">
                    <div className="flex items-baseline justify-between text-3xs">
                        <span className="text-muted-foreground">
                            {statement.reconciled_lines} de {statement.total_lines} líneas
                        </span>
                        <span className="font-mono font-semibold tabular-nums text-foreground">{Math.round(progress)}%</span>
                    </div>
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress)}
                        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    >
                        <div
                            className={cn("h-full rounded-full transition-[width] duration-300", progress >= 100 ? "bg-success" : "bg-primary")}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </header>
    )
}

/**
 * Pie de la mesa (`footer` del Drawer): lo que falta para confirmar, el borrado y la confirmación.
 * "Eliminar" siempre está presente; cuando no aplica queda deshabilitado con el motivo al pasar el cursor.
 */
function WorkbenchFooter({
    statement,
    pending,
    canConfirm,
    confirming,
    onConfirm,
    canDelete,
    deniedDelete,
    onDelete,
}: {
    statement: BankStatement
    pending: number | null
    canConfirm: boolean
    confirming: boolean
    onConfirm: () => void
    canDelete: boolean
    deniedDelete: string | null
    onDelete: () => void
}) {
    const isDraft = statement.state === "DRAFT"
    const deleteButton = (
        <Button
            type="button"
            variant="outline"
            disabled={!canDelete}
            onClick={onDelete}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:text-muted-foreground disabled:border-border"
        >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
        </Button>
    )

    return (
        <div className="flex w-full items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
                {!isDraft
                    ? "Cartola confirmada"
                    : canConfirm
                        ? "Todas las líneas están conciliadas o excluidas"
                        : pending === null ? "Cargando líneas…" : `Faltan ${pending} líneas por conciliar o excluir`}
            </p>
            <div className="flex items-center gap-2">
                {canDelete ? deleteButton : (
                    <Tooltip>
                        {/* Envoltorio: un botón deshabilitado no recibe eventos y no mostraría el motivo. */}
                        <TooltipTrigger asChild>
                            <span tabIndex={0} className="inline-flex">{deleteButton}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{deniedDelete ?? "No se puede eliminar esta cartola."}</TooltipContent>
                    </Tooltip>
                )}
                {isDraft && (
                    <SubmitButton
                        onClick={onConfirm}
                        loading={confirming}
                        disabled={!canConfirm}
                        icon={CheckCircle2}
                        className="bg-success px-5 font-bold text-sm hover:bg-success/90"
                    >
                        {confirming ? "Finalizando…" : "Confirmar cartola"}
                    </SubmitButton>
                )}
            </div>
        </div>
    )
}
