"use client"

import { cn } from "@/lib/utils"
import { CheckCircle2, Circle } from "lucide-react"

import { WorkOrderStage, WorkOrder } from "../types"

interface WizardProcessSidebarProps {
    stages: WorkOrderStage[]
    viewingStepIndex: number
    actualStepIndex: number
    onStepClick: (index: number) => void
    order: WorkOrder | null
    isCreating?: boolean
    chosenOtType?: 'LINKED' | 'NONE' | null
}

export function WizardProcessSidebar({
    stages,
    viewingStepIndex,
    actualStepIndex,
    onStepClick,
    order,
    isCreating = false,
    chosenOtType = null,
}: WizardProcessSidebarProps) {
    return (
        <div className="w-64 border-r p-4 space-y-2 hidden md:block overflow-y-auto">
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 px-2">
                Etapas de Producción
            </h3>

            {stages.map((stage, index) => {
                const Icon = stage.icon
                const isActive = viewingStepIndex === index
                const isPast = actualStepIndex > index
                const isCurrent = actualStepIndex === index
                const isFuture = actualStepIndex < index
                
  // In create mode:
  // Step 0 (ORIGIN_SELECTION) - always unlocked
  // Step 1 (SALE_ORDER_PRODUCT) - unlocked if origin chosen
  // Step 2 (PRODUCT_SELECTION) - unlocked only for NONE path
  // Step 3 (MFG_CONFIG) - unlocked if origin chosen
  // Step 4+ (MATERIAL_ASSIGNMENT and beyond) - unlocked if origin chosen
  let isLocked = false
  if (isCreating) {
    if (index === 0) {
      // ORIGIN_SELECTION - always unlocked
      isLocked = false
    } else if (index === 1) {
      // SALE_ORDER_PRODUCT - unlocked if origin chosen (for LINKED path) OR if NONE path (we go straight to PRODUCT_SELECTION at index 2)
      isLocked = chosenOtType === null
    } else if (index === 2) {
      // PRODUCT_SELECTION - only for NONE path
      isLocked = chosenOtType !== "NONE"
    } else if (index === 3) {
      // MFG_CONFIG - unlocked if we've chosen an origin type
      isLocked = chosenOtType === null
    } else {
      // Steps 4+ (MATERIAL_ASSIGNMENT and beyond) - locked until we complete the config steps
      isLocked = chosenOtType === null
    }
  }

                return (
                    <div
                        key={stage.id}
                        onClick={() => !isLocked && onStepClick(index)}
                        className={cn(
                            "rounded-lg transition-all duration-200 group",
                            isLocked
                                ? "cursor-not-allowed opacity-40"
                                : "cursor-pointer",
                            !isLocked && isActive && "bg-primary text-primary-foreground shadow-sm",
                            !isLocked && isPast && !isActive && "bg-success/10 text-success hover:bg-success/20",
                            !isLocked && isCurrent && !isActive && "bg-white border border-primary/20 text-foreground hover:border-primary/50",
                            !isLocked && isFuture && !isActive && "text-muted-foreground hover:bg-black/5"
                        )}
                    >
                        <div className="flex items-center space-x-3 p-3">
                            <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : (isPast ? "text-success" : "text-muted-foreground"))} />
                            <span className="text-sm font-medium flex-1">{stage.label}</span>
                            {isPast && <CheckCircle2 className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-success")} />}
                            {isCurrent && !isActive && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                        </div>

                        {/* Optional: Add specific details per stage if needed, similar to SalesCheckoutWizard */}
                        {/* For now, we keep it clean as requested */}
                    </div>
                )
            })}
        </div>
    )
}
