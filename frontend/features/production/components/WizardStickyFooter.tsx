"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Check, ArrowRight, Eye, X } from "lucide-react"
import { ActionConfirmModal, SubmitButton, FormFooter } from "@/components/shared"

import type { WorkOrder, WorkOrderTask, WorkOrderStage, WizardStepMode } from "../types"
import { getDomainConceptTitle } from "@/lib/entity-registry"

interface WizardFooterProps {
    isViewingCurrentStage: boolean
    stepMode: WizardStepMode
    onCancelEdit: () => void
    onClose: () => void
    pendingTasks: WorkOrderTask[]
    /** A requirement of the stage's approval still missing (shown as the reason "Siguiente" is off). */
    approvalBlockedReason?: string
    canApproveAll: boolean
    transitioning: boolean
    order: WorkOrder | null
    stages: WorkOrderStage[]
    viewingStepIndex: number
    actualStepIndex: number
    onBackToCurrent: () => void
    onTransition: (stageId: string) => void
    onBack?: () => void
    isMaterialApprovalIncomplete: boolean
    hasMaterials: boolean
    isRectificationStep?: boolean
    onRectifyAndFinish?: () => void
    isBasicInfoStep?: boolean
    isCreating?: boolean
    isBasicInfoEditable?: boolean
    chosenOtType?: 'LINKED' | 'NONE' | null
    onStepChange?: (index: number) => void
    tabDisabled?: boolean
}

export function WizardStickyFooter({
    isViewingCurrentStage,
    stepMode,
    onCancelEdit,
    onClose,
    pendingTasks,
    approvalBlockedReason,
    canApproveAll,
    transitioning,
    order,
    stages,
    viewingStepIndex,
    actualStepIndex,
    onBackToCurrent,
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
        onConfirm: () => void
    } | null>(null)

    const isImplicitlyApproving = pendingTasks.length > 0 && canApproveAll
    const isTerminal = order?.status === 'FINISHED' || order?.status === 'CANCELLED'

    const isNextDisabled = transitioning ||
        isMaterialApprovalIncomplete ||
        (pendingTasks.length > 0 && !canApproveAll) ||
        !!approvalBlockedReason

    // The one place that says why "Siguiente" is off (the rail only marks the stage).
    const blockedReason = transitioning ? null
        : isMaterialApprovalIncomplete ? 'Hay materiales sin stock suficiente'
        : pendingTasks.length > 0 && !canApproveAll ? 'Hay aprobaciones pendientes de otros usuarios'
        : approvalBlockedReason ?? null

    const handleNextClick = () => {
        const nextStage = stages[viewingStepIndex + 1]
        if (!nextStage) return

        if (nextStage.id === 'FINISHED') {
            setAlertConfig({
                title: "¿Finalizar Producción?",
                description: "Una vez finalizada la OT, no se puede modificar y el producto se encuentra disponible para despacho de inmediato. Esta acción no se puede deshacer.",
                onConfirm: () => {
                    onTransition(nextStage.id)
                    setShowAlert(false)
                }
            })
            setShowAlert(true)
        } else {
            const warningMsg = !hasMaterials && currentStageId === 'MATERIAL_ASSIGNMENT'
                ? `⚠️ No has asignado materiales a esta ${getDomainConceptTitle('ot')}.\n\n`
                : ""

            const isMaterialApprovalAdvance = currentStageId === 'MATERIAL_APPROVAL'
            const advanceDescription = isMaterialApprovalAdvance
                ? `${warningMsg}Esta acción activa la producción y cambia el estado de Borrador a En Proceso. A partir de aquí todas las modificaciones quedarán auditadas y no podrás editar los datos de configuración inicial.`
                : `${warningMsg}Podrás reabrir esta etapa más adelante mientras no existan órdenes de compra ni movimientos de stock.`

            if (!warningMsg && isImplicitlyApproving && !isMaterialApprovalAdvance) {
                onTransition(nextStage.id)
            } else {
                setAlertConfig({
                    title: isMaterialApprovalAdvance
                        ? `Activar producción · Avanzar a "${nextStage.label}"`
                        : `Avanzar a "${nextStage.label}"`,
                    description: advanceDescription,
                    onConfirm: () => {
                        onTransition(nextStage.id)
                        setShowAlert(false)
                    }
                })
                setShowAlert(true)
            }
        }
    }

    // ── Left actions: Cerrar, Anterior, Ir a etapa actual ──
    const leftActions = useMemo(() => {
        if (isTerminal) {
            return (
                <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
                    <X className="h-4 w-4" />
                    Cerrar
                </Button>
            )
        }

        if (stepMode === 'edit-in-place') {
            return (
                <Button variant="outline" size="sm" onClick={onCancelEdit} className="gap-1.5">
                    <X className="h-4 w-4" />
                    Cancelar
                </Button>
            )
        }

        if (!isViewingCurrentStage) {
            return (
                <Button
                    variant="outline"
                    className="gap-2"
                    onClick={onBackToCurrent}
                >
                    <Eye className="h-4 w-4" />
                    Volver a la Etapa Actual
                </Button>
            )
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
    }, [isTerminal, stepMode, isViewingCurrentStage, onCancelEdit, onBackToCurrent, onClose, onBack, actualStepIndex, order?.status, transitioning])

    // ── Right actions: Siguiente / Rectificar / Guardar / Seleccionar ──
    const rightActions = useMemo(() => {
        // Terminal orders are read-only: only the close action remains.
        if (isTerminal) {
            return null
        }

        // Edit-in-place: Guardar cambios
        if (stepMode === 'edit-in-place') {
            return (
                <SubmitButton
                    type="submit"
                    form="wizard-edit-form"
                    loading={transitioning}
                    icon={Check}
                >
                    {transitioning ? 'Guardando...' : 'Guardar cambios'}
                </SubmitButton>
            )
        }

        // Viewing past stage: just back to current (handled in left)
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
                                title: "¿Rectificar y Finalizar Producción?",
                                description: "Se ajustarán las cantidades de materiales consumidos (y producción en OTs de stock) y la OT pasará a estado Finalizado. Los movimientos de inventario y costos serán calculados con las cantidades reales declaradas. Esta acción no se puede deshacer.",
                                onConfirm: () => {
                                    onRectifyAndFinish()
                                    setShowAlert(false)
                                }
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
        isTerminal, stepMode, isViewingCurrentStage, isOriginSelectionStep, isSaleOrderProductStep,
        isProductSelectionStep, isMfgConfigStep, isRectificationStep, isCreating,
        isBasicInfoEditable, chosenOtType, transitioning, order?.status, stages,
        viewingStepIndex, pendingTasks, canApproveAll, isImplicitlyApproving,
        isNextDisabled, blockedReason, onCancelEdit, onBackToCurrent, onStepChange, onRectifyAndFinish,
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
                description={alertConfig?.description}
                onConfirm={alertConfig?.onConfirm || (() => {})}
                confirmText="Continuar"
            />
        </>
    )
}
