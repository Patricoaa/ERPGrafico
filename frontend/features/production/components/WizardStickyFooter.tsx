"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Loader2, Check, ArrowRight, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { ActionConfirmModal } from "@/components/shared"

import type { WorkOrder, WorkOrderTask, WorkOrderStage } from "../types"

interface WizardStickyFooterProps {
  isViewingCurrentStage: boolean
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
    isBasicInfoStep = false,
    isCreating = false,
    isBasicInfoEditable = false,
    chosenOtType = null,
    onStepChange,
}: WizardStickyFooterProps) {
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

    // Determine if we are implicitly approving tasks by advancing
    const isImplicitlyApproving = pendingTasks.length > 0 && canApproveAll;

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
            const warningMsg = !hasMaterials && stages[viewingStepIndex].id === 'MATERIAL_ASSIGNMENT'
                ? "⚠️ No has asignado materiales a esta Orden de Trabajo.\n\n"
                : ""

            // For intermediate stages, skip alert if it's an implicit approval
            if (!warningMsg && isImplicitlyApproving) {
                 onTransition(nextStage.id)
            } else {
                setAlertConfig({
                    title: `Avanzar a "${nextStage.label}"`,
                    description: `${warningMsg}Una vez que avances a la siguiente etapa, no podrás volver atrás para modificar la etapa actual. Asegúrate de haber completado todos los pasos necesarios.`,
                    onConfirm: () => {
                        onTransition(nextStage.id)
                        setShowAlert(false)
                    }
                })
                setShowAlert(true)
            }
        }
    }

  return (
    <>
      <div className="sticky bottom-0 border-t py-3 px-6 flex items-center justify-between z-10">
        {/* ── Origen de Fabricación ──────────────────────────────── */}
        {isOriginSelectionStep ? (
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              disabled={!chosenOtType}
              onClick={() => onStepChange?.(1)}
              className="gap-2"
            >
              Siguiente
              <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        ) : isSaleOrderProductStep ? (
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <div className="flex items-center gap-2">
              {isCreating ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onStepChange?.(0)}
                    className="text-muted-foreground hover:text-foreground mr-2"
                  >
                    Anterior
                  </Button>
                  <Button
                    disabled={!chosenOtType}
                    type="submit"
                    form="wizard-basic-form"
                    disabled={transitioning}
                    aria-label="Seleccionar producto"
                  >
                    {transitioning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        Selecionar Producto
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              ) : isBasicInfoEditable ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onBackToCurrent}
                    className="gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    Ir a etapa actual
                  </Button>
                  <Button
                    type="submit"
                    form="wizard-basic-form"
                    disabled={transitioning}
                    aria-label="Guardar cambios de información básica"
                  >
                    {transitioning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        Guardar cambios<Check className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBackToCurrent}
                  className="gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  Ir a etapa actual
                </Button>
              )}
            </div>
          </>
        ) : isProductSelectionStep ? (
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <div className="flex items-center gap-2">
              {isCreating ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onStepChange?.(0)}
                    className="text-muted-foreground hover:text-foreground mr-2"
                  >
                    Anterior
                  </Button>
                  <Button
                    disabled={!chosenOtType}
                    type="submit"
                    form="wizard-basic-form"
                    disabled={transitioning}
                    aria-label="Seleccionar producto"
                  >
                    {transitioning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        Selecionar Producto
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              ) : isBasicInfoEditable ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onBackToCurrent}
                    className="gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    Ir a etapa actual
                  </Button>
                  <Button
                    type="submit"
                    form="wizard-basic-form"
                    disabled={transitioning}
                    aria-label="Guardar cambios de información básica"
                  >
                    {transitioning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        Guardar cambios<Check className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBackToCurrent}
                  className="gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  Ir a etapa actual
                </Button>
              )}
            </div>
          </>
        ) : isMfgConfigStep ? (
          <>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <div className="flex items-center gap-2">
              {isCreating ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onStepChange?.(0)}
                    className="text-muted-foreground hover:text-foreground mr-2"
                  >
                    Anterior
                  </Button>
                  <Button
                    type="submit"
                    form="wizard-basic-form"
                    disabled={transitioning}
                    aria-label="Crear orden de trabajo"
                  >
                    {transitioning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        Crear orden<ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              ) : isBasicInfoEditable ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onBackToCurrent}
                    className="gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    Ir a etapa actual
                  </Button>
                  <Button
                    type="submit"
                    form="wizard-basic-form"
                    disabled={transitioning}
                    aria-label="Guardar cambios de información básica"
                  >
                    {transitioning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        Guardar cambios<Check className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBackToCurrent}
                  className="gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  Ir a etapa actual
                </Button>
              )}
            </div>
          </>
        ) : isBasicInfoStep ? (
                    <>
                        <Button variant="outline" size="sm" onClick={onClose}>
                            Cerrar
                        </Button>
                        <div className="flex items-center gap-2">
                            {isCreating ? (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onStepChange?.(0)}
                                        className="text-muted-foreground hover:text-foreground mr-2"
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        type="submit"
                                        form="wizard-basic-form"
                                        disabled={transitioning}
                                        aria-label="Crear orden de trabajo"
                                    >
                                        {transitioning ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" />Creando...</>
                                        ) : (
                                            <>Crear orden<ArrowRight className="ml-2 h-4 w-4" /></>
                                        )}
                                    </Button>
                                </>
                            ) : isBasicInfoEditable ? (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onBackToCurrent}
                                        className="gap-1.5"
                                    >
                                        <Eye className="h-4 w-4" />
                                        Ir a etapa actual
                                    </Button>
                                    <Button
                                        type="submit"
                                        form="wizard-basic-form"
                                        disabled={transitioning}
                                        aria-label="Guardar cambios de información básica"
                                    >
                                        {transitioning ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</>
                                        ) : (
                                            <>Guardar cambios<Check className="ml-2 h-4 w-4" /></>
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onBackToCurrent}
                                    className="gap-1.5"
                                >
                                    <Eye className="h-4 w-4" />
                                    Ir a etapa actual
                                </Button>
                            )}
                        </div>
                    </>
                ) : isViewingCurrentStage ? (
                    <>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onClose}
                            >
                                Cerrar
                            </Button>

                            {actualStepIndex > 0 && order?.status !== 'FINISHED' && (
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

                        <div className="flex items-center gap-2">
                            {pendingTasks.length > 0 && !canApproveAll && (
                                <span className="text-xs text-warning flex items-center gap-1.5 font-medium">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Tareas pendientes de otros
                                </span>
                            )}

                            {order?.status !== 'FINISHED' && stages[viewingStepIndex]?.id !== 'FINISHED' && (
                                isRectificationStep ? (
                                    <Button
                                        disabled={isNextDisabled}
                                        onClick={() => {
                                            setAlertConfig({
                                                title: "¿Rectificar y Finalizar Producción?",
                                                description: "Se ajustarán las cantidades de materiales consumidos (y producción en OTs de stock) y la OT pasará a estado Finalizado. Los movimientos de inventario y costos serán calculados con las cantidades reales declaradas. Esta acción no se puede deshacer.",
                                                onConfirm: () => {
                                                    onRectifyAndFinish?.()
                                                    setShowAlert(false)
                                                }
                                            })
                                            setShowAlert(true)
                                        }}
                                        className="gap-2 bg-success hover:bg-success/90 text-white shadow-lg shadow-success/20"
                                        aria-label="Rectificar y Finalizar Producción"
                                    >
                                        {transitioning ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Procesando...
                                            </>
                                        ) : (
                                            <>
                                                Rectificar y Finalizar
                                                <Check className="ml-2 h-4 w-4" aria-hidden="true" />
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <Button
                                        disabled={isNextDisabled}
                                        onClick={handleNextClick}
                                        className={cn("gap-2", isImplicitlyApproving && "bg-primary hover:bg-primary")}
                                        aria-label={viewingStepIndex === stages.length - 2 ? "Finalizar Producción" : "Siguiente Etapa"}
                                    >
                                        {transitioning ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Procesando...
                                            </>
                                        ) : viewingStepIndex === stages.length - 2 ? (
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
                                    </Button>
                                )
                            )}
                        </div>
                    </>
                ) : (
                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={onBackToCurrent}
                    >
                        <Eye className="h-4 w-4" />
                        Volver a la Etapa Actual
                    </Button>
                )}
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
