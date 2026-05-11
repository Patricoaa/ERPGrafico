"use client"

import { usePOS } from "../contexts/POSContext"
import { cn } from "@/lib/utils"
import { Check, ChevronRight, ShoppingCart, User, Factory, FileText, Truck, Wallet as WalletIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function POSCheckoutHeader() {
    const { posMode, setPosMode, wizardState, items } = usePOS()

    const currentStep = posMode === 'SHOPPING' ? 1 : (wizardState?.step ?? 1) + 1
    const hasManufacturing = items.some(line => 
        line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing
    )
    const isOnlyService = items.every(line => line.product_type === 'SERVICE')

    // Define steps
    const steps = [
        { id: 1, label: 'Carrito', icon: ShoppingCart },
        { id: 2, label: 'Cliente & Doc', icon: User },
    ]

    let nextStepId = 3
    if (hasManufacturing) {
        steps.push({ id: nextStepId++, label: 'Fabricación', icon: Factory })
    }
    if (!isOnlyService) {
        steps.push({ id: nextStepId++, label: 'Entrega', icon: Truck })
    }
    steps.push({ id: nextStepId++, label: 'Pago', icon: WalletIcon })

    return (
        <div className="flex items-center justify-center gap-1 sm:gap-4 overflow-x-auto no-scrollbar py-1 animate-in fade-in duration-700">
            {steps.map((step, index) => {
                const Icon = step.icon
                const isCompleted = currentStep > step.id
                const isActive = currentStep === step.id
                
                return (
                    <div key={step.id} className="flex items-center group">
                        <div 
                            className={cn(
                                "flex flex-col items-center gap-1 relative"
                            )}
                        >
                            <div className={cn(
                                "h-10 w-10 rounded-sm flex items-center justify-center transition-all duration-300 border-2",
                                isActive ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20 scale-110" : 
                                isCompleted ? "bg-success/10 border-success text-success" : 
                                "bg-muted border-transparent text-muted-foreground opacity-40"
                            )}>
                                {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                
                                {/* Indicator Pulse for Active */}
                                {isActive && (
                                    <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-primary rounded-full border-2 border-background animate-pulse" />
                                )}
                            </div>
                            <span className={cn(
                                "text-[8px] font-bold uppercase tracking-tight truncate max-w-[50px] sm:max-w-none transition-colors",
                                isActive ? "text-primary" : isCompleted ? "text-success" : "text-muted-foreground"
                            )}>
                                {step.label}
                            </span>
                        </div>
                        
                        {index < steps.length - 1 && (
                            <div className="mx-0.5 sm:mx-1 mb-3">
                                <ChevronRight className={cn(
                                    "h-3 w-3 transition-colors opacity-30",
                                    isCompleted ? "text-success" : "text-muted-foreground"
                                )} />
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
