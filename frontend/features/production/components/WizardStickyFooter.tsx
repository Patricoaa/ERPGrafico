"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Check, ArrowRight, Eye, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ActionConfirmModal, FormFooter, SubmitButton, ActionSlideButton } from "@/components/shared"

import type { WorkOrder, WorkOrderTask, WorkOrderStage, WizardStepMode } from "../types"

interface WizardFooterProps {
    isViewingCurrentStage: boolean
    stepMode: WizardStepMode
    onCancelEdit: () => void
    onClose: () => void
    pendingTasks: WorkOrderTask[]
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
}

export function WizardStickyFooter({
    isViewingCurrentStage,
    stepMode,
    onCancelEdit,
    onClose,
    pendingTasks,
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

    const isNextDisabled = transitioning ||
        isMaterialApprovalIncomplete ||
        (pendingTasks.length > 0 && !canApproveAll)

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
                ? "⚠️ No has asignado materiales a esta Orden de Trabajo.\n\n"
                : ""

            const isMaterialApprovalAdvance = currentStageId === 'MATERIAL_APPROVAL'
            const advanceDescription = isMaterialApprovalAdvance
                ? `${warningMsg}Esta acción activa la producción y cambia el estado de Borrador a En Proceso. A partir de aquí todas las modificaciones quedarán auditadas y no podrás editar los datos de configuración inicial.`
                : `${warningMsg}Una vez que avances a la siguiente etapa, no podrás volver atrás para modificar la etapa actual. Asegúrate de haber completado todos los pasos necesarios.`

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

        return (
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                    Cerrar
                </Button>
                {actualStepIndex > 0 && order?.status !== 'FINISHED' && onBack && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        disabled={transitioning}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        Anterior
                    </Button>
                )}
            </div>
        )
    }, [stepMode, isViewingCurrentStage, onCancelEdit, onBackToCurrent, onClose, onBack, actualStepIndex, order?.status, transitioning])

    // ── Right actions: Siguiente / Rectificar / Guardar / Seleccionar ──
    const rightActions = useMemo(() => {
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
                            aria-label="Seleccionar producto"
                            icon={ArrowRight}
                        >
                            {transitioning ? 'Procesando...' : 'Seleccionar Producto'}
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
                    <ActionSlideButton
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
                        variant="success"
                        className="gap-2 bg-success hover:bg-success/90 text-success-foreground shadow-elevated shadow-success/20"
                        aria-label="Rectificar y Finalizar Producción"
                        icon={Check}
                    >
                        {transitioning ? 'Procesando...' : 'Rectificar y Finalizar'}
                    </ActionSlideButton>
                )
            }

            return (
                <div className="flex items-center gap-2">
                    {pendingTasks.length > 0 && !canApproveAll && (
                        <span className="text-xs text-warning flex items-center gap-1.5 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Tareas pendientes de otros
                        </span>
                    )}
                    <ActionSlideButton
                        disabled={isNextDisabled}
                        onClick={handleNextClick}
                        loading={transitioning}
                        className={cn("gap-2", isImplicitlyApproving && "bg-primary hover:bg-primary")}
                        aria-label={viewingStepIndex === stages.length - 2 ? "Finalizar Producción" : "Siguiente Etapa"}
                    >
                        {viewingStepIndex === stages.length - 2 ? (
                            <>
                                Finalizar Producción
                                <Check className="ml-2 h-4 w-4" aria-hidden="true" />
                            </>
                        ) : isImplicitlyApproving ? (
                            <>
                                Aprobar y Siguiente
                                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                            </>
                        ) : (
                            <>
                                Siguiente Etapa
                                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                            </>
                        )}
                    </ActionSlideButton>
                </div>
            )
        }

        return null
    }, [
        stepMode, isViewingCurrentStage, isOriginSelectionStep, isSaleOrderProductStep,
        isProductSelectionStep, isMfgConfigStep, isRectificationStep, isCreating,
        isBasicInfoEditable, chosenOtType, transitioning, order?.status, stages,
        viewingStepIndex, pendingTasks, canApproveAll, isImplicitlyApproving,
        isNextDisabled, onCancelEdit, onBackToCurrent, onStepChange, onRectifyAndFinish,
    ])

    return (
        <>
            <FormFooter
                leftActions={leftActions}
                actions={rightActions}
            />
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
