"use client"

import { useMemo } from "react"
import { Banner } from "@/components/shared"
import { ProductionStepsSidebar } from "./ProductionStepsSidebar"

import type { WorkOrderStage, WorkOrder, WizardStepMode } from "../types"
import { buildWorkOrderRailSteps } from "../lib/railSteps"

interface WizardProcessSidebarProps {
    stages: WorkOrderStage[]
    viewingStepIndex: number
    actualStepIndex: number
    stepMode: WizardStepMode
    onStepClick: (index: number) => void
    order: WorkOrder | null
    collapsed?: boolean
    onToggleCollapsed?: () => void
}

export function WizardProcessSidebar({
    stages,
    viewingStepIndex,
    actualStepIndex,
    stepMode,
    onStepClick,
    order,
    collapsed,
    onToggleCollapsed,
}: WizardProcessSidebarProps) {
    const steps = useMemo(
        () => buildWorkOrderRailSteps({
            stages,
            viewingStepIndex,
            actualStepIndex,
            stepMode,
            order,
        }),
        [stages, viewingStepIndex, actualStepIndex, stepMode, order],
    )

    const progressPercent = actualStepIndex >= 0 && stages.length > 0
        ? ((actualStepIndex + 1) / stages.length) * 100
        : undefined

    const isCancelled = order?.status === "CANCELLED"
    const isFinished = order?.status === "FINISHED"
    const isTerminal = isCancelled || isFinished

    const headerNote = isCancelled ? (
        <Banner tone="destructive" live="none">Orden cancelada · solo lectura</Banner>
    ) : isFinished ? (
        <Banner tone="success" live="none">Producción finalizada</Banner>
    ) : undefined

    return (
        <ProductionStepsSidebar
            steps={steps}
            currentStep={viewingStepIndex + 1}
            onStepClick={onStepClick}
            progressPercent={progressPercent}
            collapsed={collapsed}
            onToggleCollapsed={onToggleCollapsed}
            headerNote={headerNote}
        />
    )
}