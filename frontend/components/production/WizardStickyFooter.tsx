"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Loader2, Check, ArrowRight, Eye } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface WizardStickyFooterProps {
    isViewingCurrentStage: boolean
    onClose: () => void
    pendingTasks: any[]
    canApproveAll: boolean
    transitioning: boolean
    order: any
    stages: any[]
    viewingStepIndex: number
    actualStepIndex: number
    onBackToCurrent: () => void
    onTransition: (stageId: string) => void
    isMaterialApprovalIncomplete: boolean
    hasMaterials: boolean
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
    isMaterialApprovalIncomplete,
    hasMaterials
}: WizardStickyFooterProps) {
    const [showAlert, setShowAlert] = useState(false)
    const [alertConfig, setAlertConfig] = useState<{
        title: string
        description: string
        onConfirm: () => void
    } | null>(null)

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

    return (
        <>
            <div className="sticky bottom-0 border-t bg-background py-3 px-6 flex items-center justify-between z-10">
                {isViewingCurrentStage ? (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                        >
                            Cerrar
                        </Button>

                        <div className="flex items-center gap-2">
                            {pendingTasks.length > 0 && !canApproveAll && (
                                <span className="text-xs text-amber-600 flex items-center gap-1.5">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Tareas de aprobación pendientes
                                </span>
                            )}

                            {order?.status !== 'FINISHED' && stages[viewingStepIndex]?.id !== 'FINISHED' && (
                                <Button
                                    disabled={isNextDisabled}
                                    onClick={handleNextClick}
                                    className="gap-2"
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
                                    ) : (
                                        <>
                                            Siguiente Etapa
                                            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                                        </>
                                    )}
                                </Button>
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

            <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            {alertConfig?.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertConfig?.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={alertConfig?.onConfirm}>
                            Continuar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
