"use client"

import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { WizardStepsSidebar, type WizardSidebarStep } from "@/components/shared"

interface ProductionStepsSidebarProps {
    steps: WizardSidebarStep[]
    /** 1-based index of the step being shown. */
    currentStep: number
    onStepClick?: (index: number) => void
    collapsed?: boolean
    onToggleCollapsed?: () => void
    /** 0-100, the order's progress bar (omitted when there is no real progress, e.g. a draft). */
    progressPercent?: number
    headerNote?: ReactNode
}

/**
 * The left stage rail of a production flow: one look for the work-order wizard and the
 * POS manufacturing drawer (same width, folding, density and connector).
 */
export function ProductionStepsSidebar({
    steps, currentStep, onStepClick, collapsed, onToggleCollapsed, progressPercent, headerNote,
}: ProductionStepsSidebarProps) {
    return (
        <TooltipProvider delayDuration={300}>
            <WizardStepsSidebar
                title="Etapas"
                currentStep={currentStep}
                steps={steps}
                width="w-64"
                className="bg-transparent"
                onStepClick={onStepClick}
                showNumbers={true}
                detailVisibility="both"
                progressPercent={progressPercent}
                showCounter={false}
                showConnector={false}
                listClassName="px-2 pt-1 space-y-1.5"
                collapsed={collapsed}
                onToggleCollapsed={onToggleCollapsed}
                headerNote={headerNote}
            />
        </TooltipProvider>
    )
}
