"use client"

import { CheckCircle2 } from "lucide-react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { type ReactNode } from "react"

export interface WizardSidebarStep {
    id: string | number
    label: string
    icon: LucideIcon
    /** Optional content shown below the step row when the step is completed (past) */
    detail?: ReactNode
}

export interface WizardStepsSidebarProps {
    title: string
    currentStep: number
    steps: WizardSidebarStep[]
    className?: string
}

export function WizardStepsSidebar({ title, currentStep, steps, className }: WizardStepsSidebarProps) {
    return (
        <div className={cn("w-64 border-r bg-transparent p-4 space-y-2 hidden md:block overflow-y-auto", className)}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 mb-4 px-2">
                {title}
            </h3>

            {steps.map((step, index) => {
                const stepNumber = index + 1
                const Icon = step.icon
                const isActive = currentStep === stepNumber
                const isPast = currentStep > stepNumber
                const isFuture = currentStep < stepNumber

                return (
                    <div
                        key={step.id}
                        className={cn(
                            "rounded-sm transition-all duration-200",
                            isActive && "bg-primary text-primary-foreground shadow-card",
                            isPast && "bg-success/10 text-success",
                            isFuture && "text-muted-foreground"
                        )}
                    >
                        <div className="flex items-center space-x-3 p-3">
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="text-sm font-medium flex-1">{step.label}</span>
                            {isPast && <CheckCircle2 className="h-4 w-4" />}
                        </div>

                        {isPast && step.detail && (
                            <div className="px-3 pb-3 pt-1 space-y-1 animate-in fade-in duration-300">
                                {step.detail}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
