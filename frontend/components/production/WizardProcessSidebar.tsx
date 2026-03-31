"use client"

import { cn } from "@/lib/utils"
import { CheckCircle2, Circle } from "lucide-react"

interface WizardProcessSidebarProps {
    stages: any[]
    viewingStepIndex: number
    actualStepIndex: number
    onStepClick: (index: number) => void
    order: any
}

export function WizardProcessSidebar({
    stages,
    viewingStepIndex,
    actualStepIndex,
    onStepClick,
    order
}: WizardProcessSidebarProps) {
    return (
        <div className="w-64 border-r bg-muted/10 p-4 space-y-2 hidden md:block overflow-y-auto">
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 px-2">
                Etapas de Producción
            </h3>

            {stages.map((stage, index) => {
                const Icon = stage.icon
                const isActive = viewingStepIndex === index
                const isPast = actualStepIndex > index
                const isCurrent = actualStepIndex === index
                const isFuture = actualStepIndex < index

                return (
                    <div
                        key={stage.id}
                        onClick={() => onStepClick(index)}
                        className={cn(
                            "rounded-lg transition-all duration-200 cursor-pointer group",
                            isActive && "bg-primary text-primary-foreground shadow-sm",
                            isPast && !isActive && "bg-green-50 text-emerald-700 hover:bg-emerald-100",
                            isCurrent && !isActive && "bg-white border border-primary/20 text-foreground hover:border-primary/50",
                            isFuture && !isActive && "text-muted-foreground hover:bg-black/5"
                        )}
                    >
                        <div className="flex items-center space-x-3 p-3">
                            <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary-foreground" : (isPast ? "text-emerald-700" : "text-muted-foreground"))} />
                            <span className="text-sm font-medium flex-1">{stage.label}</span>
                            {isPast && <CheckCircle2 className={cn("h-4 w-4", isActive ? "text-primary-foreground" : "text-emerald-700")} />}
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
