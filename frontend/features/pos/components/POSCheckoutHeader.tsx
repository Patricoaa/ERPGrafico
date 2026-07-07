"use client"

import { usePOS } from "../contexts/POSProvider"
import { cn, formatPlainDate } from "@/lib/utils"
import { getDteLabel } from "@/lib/entity-registry"
import {Check, ChevronRight, ShoppingCart, User, Factory, Truck, Wallet as WalletIcon, FileWarning} from "lucide-react"
import type { WizardState } from "@/types/pos"
import * as Validation from "../utils/validation"

function getDeliveryLabel(type: string): string {
    switch (type) {
        case 'IMMEDIATE': return 'Inmediata'
        case 'PARTIAL': return 'Parcial'
        case 'LATER': return 'Programada'
        default: return type
    }
}

function getStepMetadata(stepLabel: string, wizardState: WizardState | null): string | null {
    if (!wizardState) return null
    switch (stepLabel) {
        case 'Cliente':
            return wizardState.selectedCustomerName || null
        case 'Documento':
            return wizardState.dteData?.type ? getDteLabel(wizardState.dteData.type) : null
        case 'Entrega': {
            const dd = wizardState.deliveryData
            if (!dd?.type) return null
            const label = getDeliveryLabel(dd.type)
            const date = dd.date ? formatPlainDate(dd.date) : null
            return date ? `${date} (${label})` : label
        }
        default:
            return null
    }
}

export function POSCheckoutHeader() {
    const { posMode, wizardState, items } = usePOS()

    const currentStep = posMode === 'SHOPPING' ? 1 : (wizardState?.step ?? 1) + 1
    const hasManufacturing = Validation.requiresManufacturingStep(items)
    // Define steps — mirrors SalesCheckoutWizardView steps + leading 'Carrito'
    const steps = [
        { id: 1, label: 'Carrito', icon: ShoppingCart },
        { id: 2, label: 'Cliente', icon: User },
        { id: 3, label: 'Documento', icon: FileWarning },
    ]

    let nextStepId = 4
    if (hasManufacturing) {
        steps.push({ id: nextStepId++, label: 'Fabricación', icon: Factory })
    }
    steps.push({ id: nextStepId++, label: 'Entrega', icon: Truck })
    steps.push({ id: nextStepId++, label: 'Pago', icon: WalletIcon })

    return (
        <div className="flex items-center justify-center gap-[clamp(0.25rem,1.5vw,1rem)] overflow-x-auto no-scrollbar py-1 animate-in fade-in duration-700">
            {steps.map((step, index) => {
                const Icon = step.icon
                const isCompleted = currentStep > step.id
                const isActive = currentStep === step.id
                const stepMeta = isCompleted ? getStepMetadata(step.label, wizardState) : null

                return (
                    <div key={step.id} className="flex items-center group">
                        <div
                            className={cn(
                                "flex flex-col items-center gap-[clamp(0.15rem,0.5vw,0.35rem)] relative"
                            )}
                        >
                            <div className={cn(
                                "h-[clamp(1.5rem,3.5vw,2.25rem)] w-[clamp(1.5rem,3.5vw,2.25rem)] rounded-sm flex items-center justify-center transition-all duration-300 border-2",
                                isActive ? "bg-primary border-primary text-primary-foreground scale-110" :
                                    isCompleted ? "bg-success/10 border-success text-success" :
                                        "bg-muted border-transparent text-muted-foreground opacity-40"
                            )}>
                                {isCompleted ? <Check className="h-[clamp(0.65rem,1.6vw,1rem)] w-[clamp(0.65rem,1.6vw,1rem)]" /> : <Icon className="h-[clamp(0.65rem,1.6vw,1rem)] w-[clamp(0.65rem,1.6vw,1rem)]" />}

                                {/* Indicator Pulse for Active */}
                                {isActive && (
                                    <span className="absolute -top-0.5 -right-0.5 h-[clamp(0.5rem,1vw,0.75rem)] w-[clamp(0.5rem,1vw,0.75rem)] bg-primary rounded-full border-2 border-background animate-pulse" />
                                )}
                            </div>
                            <span className={cn(
                                "text-[clamp(0.4rem,1vw,0.65rem)] font-bold uppercase tracking-tight truncate max-w-[clamp(40px,10vw,80px)] transition-colors leading-tight",
                                isActive ? "text-primary" : isCompleted ? "text-success" : "text-muted-foreground"
                            )}>
                                {step.label}
                            </span>
                            {stepMeta && (
                                <span className="text-[clamp(0.3rem,0.65vw,0.5rem)] text-muted-foreground truncate max-w-[clamp(40px,10vw,80px)] leading-tight">
                                    {stepMeta}
                                </span>
                            )}
                        </div>

                        {index < steps.length - 1 && (
                            <div className="mx-[clamp(0.1rem,0.5vw,0.35rem)] mb-[clamp(0.5rem,1.5vw,1rem)]">
                                <ChevronRight className={cn(
                                    "h-[clamp(0.55rem,1.2vw,0.8rem)] w-[clamp(0.55rem,1.2vw,0.8rem)] transition-colors opacity-30",
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
