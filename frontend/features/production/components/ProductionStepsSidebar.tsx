"use client"

import type { ReactNode } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DrawerResizableRail, WizardStepsSidebar, type WizardSidebarStep } from "@/components/shared"

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
 * Uses DrawerResizableRail for fluid dragging, hover UI feedback, and double-click toggle.
 */
export function ProductionStepsSidebar({
    steps,
    currentStep,
    onStepClick,
    collapsed,
    onToggleCollapsed,
    progressPercent,
    headerNote,
}: ProductionStepsSidebarProps) {
    return (
        <TooltipProvider delayDuration={300}>
            <DrawerResizableRail
                side="left"
                collapsed={collapsed}
                onToggleCollapsed={onToggleCollapsed}
                storageKey="erpgrafico.production.railCollapsed"
                defaultWidth={256}
                minWidth={200}
                maxWidth={420}
                compactWidth={56}
                ariaLabel="Redimensionar panel de etapas"
                className="hidden md:flex"
            >
                <WizardStepsSidebar
                    title="Etapas"
                    currentStep={currentStep}
                    steps={steps}
                    width="w-full"
                    className="bg-transparent flex-1 min-h-0"
                    onStepClick={onStepClick}
                    showNumbers={true}
                    detailVisibility="both"
                    progressPercent={progressPercent}
                    showCounter={false}
                    showConnector={false}
                    listClassName="px-2 pt-1 space-y-1.5"
                    collapsed={collapsed}
                    headerNote={headerNote}
                />
            </DrawerResizableRail>
        </TooltipProvider>
    )
}
