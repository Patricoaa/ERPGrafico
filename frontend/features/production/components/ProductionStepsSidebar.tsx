"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
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
            <div className="relative hidden md:flex flex-col h-full">
                {onToggleCollapsed && (
                    <button
                        type="button"
                        onClick={onToggleCollapsed}
                        className="absolute right-0 top-1/2 translate-x-full -translate-y-1/2 z-10 flex h-6 w-4 items-center justify-center rounded-r border border-l-0 border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        title={collapsed ? "Expandir etapas" : "Colapsar etapas"}
                        aria-label={collapsed ? "Expandir etapas" : "Colapsar etapas"}
                        aria-expanded={!collapsed}
                    >
                        {collapsed
                            ? <ChevronRight className="h-3 w-3" aria-hidden />
                            : <ChevronLeft className="h-3 w-3" aria-hidden />
                        }
                    </button>
                )}
                <WizardStepsSidebar
                    title="Etapas"
                    currentStep={currentStep}
                    steps={steps}
                    width="w-64"
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
            </div>
        </TooltipProvider>
    )
}
