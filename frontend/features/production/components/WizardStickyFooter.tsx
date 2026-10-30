"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Check, ArrowRight } from "lucide-react"
import { ActionConfirmModal, SubmitButton, FormFooter } from "@/components/shared"

import type { WorkOrder, WorkOrderTask, WorkOrderStage } from "../types"

interface WizardFooterProps {
    isViewingCurrentStage: boolean
    pendingTasks: WorkOrderTask[]
    /** A requirement of the stage's approval still missing (shown as the reason "Siguiente" is off). */
    approvalBlockedReason?: string
    /** Specific stock shortfall, shown beside the disabled transition action. */
    materialApprovalBlockedReason?: string
    canApproveAll: boolean
    transitioning: boolean
    order: WorkOrder | null
    stages: WorkOrderStage[]
    viewingStepIndex: number
    actualStepIndex: number
    onTransition: (stageId: string) => void | Promise<void>
    onBack?: () => void
    isMaterialApprovalIncomplete: boolean
    hasMaterials: boolean
    isRectificationStep?: boolean
    onRectifyAndFinish?: () => void | Promise<void>
    isBasicInfoStep?: boolean
    isCreating?: boolean
    isBasicInfoEditable?: boolean
    chosenOtType?: 'LINKED' | 'NONE' | null
    onStepChange?: (index: number) => void
    tabDisabled?: boolean
}

export function WizardStickyFooter({
    isViewingCurrentStage,
    pendingTasks,
    approvalBlockedReason,
    materialApprovalBlockedReason,
    canApproveAll,
    transitioning,
    order,
    stages,
    viewingStepIndex,
    actualStepIndex,
    onTransition,
    onBack,
    isMaterialApprovalIncomplete,
    hasMaterials,
    isRectificationStep = false,
    onRectifyAndFinish,
    isCreating = false,
    isBasicInfoEditable = false,
    chosenOtType = null,
    onStepChange,
    tabDisabled = false,
}: WizardFooterProps) {
    const currentStageId = stages[viewingStepIndex]?.id
    const isOriginSelectionStep = currentStageId === 'ORIGIN_SELECTION'
    const isSaleOrderProductStep = currentStageId === 'SALE_ORDER_PRODUCT'
    const isProductSelectionStep = currentStageId === 'PRODUCT_SELECTION'
    const isMfgConfigStep = currentStageId === 'MFG_CONFIG'
    const [showAlert, setShowAlert] = useState(false)
    const [alertConfig, setAlertConfig] = useState<{
        title: string
        description: string
        confirmText?: string
        onConfirm: () => void | Promise<void>
    } | null>(null)

    const isImplicitlyApproving = pendingTasks.length > 0 && canApproveAll
    const isTerminal = order?.status === 'FINISHED' || order?.status === 'CANCELLED'

    const isNextDisabled = transitioning ||
        isMaterialApprovalIncomplete ||
        (pendingTasks.length > 0 && !canApproveAll) ||
        !!approvalBlockedReason

    // The one place that says why "Siguiente" is off (the rail only marks the stage).
    const blockedReason = transitioning ? null
        : isMaterialApprovalIncomplete ? materialApprovalBlockedReason ?? 'Hay materiales sin stock suficiente'
        : pendingTasks.length > 0 && !canApproveAll ? 'Hay aprobaciones pendientes que tu usuario no puede completar. Solicita que las apruebe la persona o grupo responsable.'
        : approvalBlockedReason ?? null

    const handleNextClick = useCallback(() => {
        const nextStage = stages[viewingStepIndex + 1]
        if (!nextStage) return

        if (nextStage.id === 'FINISHED') {
            setAlertConfig({
                title: "Finalizar producción",
                confirmText: "Finalizar producción",
                description: "La OT quedará cerrada y no podrá modificarse. Se registrarán los consumos y costos de producción; si el producto controla inventario, se ingresará lo producido al stock. Las Órdenes de Compra vinculadas deben estar recibidas completamente antes de finalizar. Esta acción no se puede deshacer.",
                onConfirm: () => onTransition(nextStage.id),
            })
            setShowAlert(true)
            return
        }

        if (currentStageId === 'MATERIAL_ASSIGNMENT' && !hasMaterials) {
            setAlertConfig({
                title: "Continuar sin materiales",
                confirmText: "Continuar sin materiales",
                description: "Esta OT no tiene materiales ni servicios asignados. Si es intencional, puedes continuar; de lo contrario, cancela y asígnalos antes de avanzar. No se registrará consumo de componentes al finalizar.",
                onConfirm: () => onTransition(nextStage.id),
            })
            setShowAlert(true)
            return
        }

        if (currentStageId === 'MATERIAL_APPROVAL') {
            setAlertConfig({
                title: "Activar producción",
                confirmText: "Activar producción",
                description: `La OT pasará de Borrador a En Proceso y avanzará a "${nextStage.label}". La edición posterior dependerá de las reglas de cada etapa; no todos los datos tienen el mismo bloqueo.`,
                onConfirm: () => onTransition(nextStage.id),
            })
            setShowAlert(true)
            return
        }

        // Routine stage changes do not need a confirmation; the action label already
        // communicates whether the user is approving the stage or simply advancing.
        void onTransition(nextStage.id)
    }, [stages, viewingStepIndex, currentStageId, hasMaterials, onTransition])

    // ── Left actions: Anterior ──
    const leftActions = useMemo(() => {
        if (isTerminal || !isViewingCurrentStage) {
            return null
        }

        if (actualStepIndex > 0 && order?.status !== 'FINISHED' && onBack) {
            return (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    disabled={transitioning}
                    className="text-muted-foreground hover:text-foreground"
                >
                    Anterior
                </Button>
            )
        }
        return null
    }, [isTerminal, isViewingCurrentStage, onBack, actualStepIndex, order?.status, transitioning])

    // ── Right actions: Siguiente / Rectificar / Guardar / Seleccionar ──
    const rightActions = useMemo(() => {
        // Terminal orders are read-only: only the close action remains.
        if (isTerminal) {
            return null
        }

        // Viewing past stage: nothing in the right
        if (!isViewingCurrentStage) {
            return null
        }

        // Creation steps
        if (isOriginSelectionStep) {
            return (
                <Button
                    disabled={!chosenOtType}
                    onClick={() => onStepChange?.(1)}
                    className="gap-2"
                >
                    Siguiente
                    <ArrowRight className="h-4 w-4" />
                </Button>
            )
        }

        if (isSaleOrderProductStep || isProductSelectionStep || isMfgConfigStep) {
            if (isCreating) {
                return (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onStepChange?.(viewingStepIndex - 1)}
                            className="text-muted-foreground hover:text-foreground mr-2"
                        >
                            Anterior
                        </Button>
                        <SubmitButton
                            type="submit"
                            form="wizard-basic-form"
                            loading={transitioning}
                            disabled={!chosenOtType}
                            aria-label={isMfgConfigStep ? 'Crear OT' : 'Seleccionar producto'}
                            icon={isMfgConfigStep ? Check : ArrowRight}
                        >
                            {transitioning ? 'Procesando...' : isMfgConfigStep ? 'Crear OT' : 'Seleccionar Producto'}
                        </SubmitButton>
                    </div>
                )
            }
            if (isBasicInfoEditable) {
                return (
                    <SubmitButton
                        type="submit"
                        form="wizard-basic-form"
                        loading={transitioning}
                        aria-label="Guardar cambios de información básica"
                        icon={Check}
                    >
                        {transitioning ? 'Guardando...' : 'Guardar cambios'}
                    </SubmitButton>
                )
            }
            return null
        }

        // Workflow steps: Siguiente Etapa / Rectificar y Finalizar / Finalizar Producción
        if (order?.status !== 'FINISHED' && stages[viewingStepIndex]?.id !== 'FINISHED') {
            if (isRectificationStep && onRectifyAndFinish) {
                return (
                    <SubmitButton
                        disabled={isNextDisabled}
                        onClick={() => {
                            setAlertConfig({
                                title: "Rectificar y finalizar producción",
                                confirmText: "Rectificar y finalizar",
                                description: "Se guardarán las cantidades reales declaradas; los datos que no ajustes conservarán la cantidad planificada. Después, la OT quedará cerrada y se registrarán los consumos y costos. Si el producto controla inventario, se ingresará lo producido al stock. Las Órdenes de Compra vinculadas deben estar recibidas completamente. Esta acción no se puede deshacer.",
                                onConfirm: () => onRectifyAndFinish(),
                            })
                            setShowAlert(true)
                        }}
                        loading={transitioning}
                        aria-label="Rectificar y Finalizar Producción"
                        icon={Check}
                        className="bg-success hover:bg-success/90 text-success-foreground"
                    >
                        {transitioning ? 'Procesando...' : 'Rectificar y Finalizar'}
                    </SubmitButton>
                )
            }

            return (
                <div className="flex items-center gap-2">
                    {blockedReason && (
                        <span className="text-xs text-warning flex items-center gap-1.5 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {blockedReason}
                        </span>
                    )}
                    <SubmitButton
                        id="wizard-next"
                        disabled={isNextDisabled}
                        onClick={handleNextClick}
                        loading={transitioning}
                        aria-label={viewingStepIndex === stages.length - 2 ? "Finalizar Producción" : "Siguiente Etapa"}
                        icon={viewingStepIndex === stages.length - 2 || isImplicitlyApproving ? Check : ArrowRight}
                        // Green when moving on also approves the stage: it's a sign-off, not just a step.
                        className={isImplicitlyApproving ? "bg-success hover:bg-success/90 text-success-foreground" : undefined}
                    >
                        {viewingStepIndex === stages.length - 2 ? 'Finalizar Producción'
                            : isImplicitlyApproving ? 'Aprobar y Siguiente'
                            : 'Siguiente Etapa'}
                    </SubmitButton>
                </div>
            )
        }

        return null
    }, [
        isTerminal, isViewingCurrentStage, isOriginSelectionStep, isSaleOrderProductStep,
        isProductSelectionStep, isMfgConfigStep, isRectificationStep, isCreating,
        isBasicInfoEditable, chosenOtType, transitioning, order?.status, stages,
        viewingStepIndex, isImplicitlyApproving,
        isNextDisabled, blockedReason, onStepChange, onRectifyAndFinish,
        handleNextClick,
    ])

    return (
        <>
            <div className={tabDisabled ? "opacity-40 pointer-events-none" : undefined}>
            <FormFooter
                leftActions={leftActions}
                actions={rightActions}
            />
            </div>
            <ActionConfirmModal
                open={showAlert}
                onOpenChange={setShowAlert}
                title={alertConfig?.title ?? ''}
                description={alertConfig?.description ?? " "}
                onConfirm={async () => { await alertConfig?.onConfirm() }}
                confirmText={alertConfig?.confirmText ?? "Continuar"}
            />
        </>
    )
}
