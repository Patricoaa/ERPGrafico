"use client"

import { FileText, Package, Truck, Wallet, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

interface NoteSummarySidebarProps {
    currentStep: number
    workflow: any
    initializing: boolean
}

const steps = [
    { id: 1, label: 'Seleccionar Items', icon: Package },
    { id: 2, label: 'Logística', icon: Truck },
    { id: 3, label: 'Registro DTE', icon: FileText },
    { id: 4, label: 'Finalización', icon: Wallet }
]

export function NoteSummarySidebar({
    currentStep,
    workflow,
    initializing
}: NoteSummarySidebarProps) {
    if (initializing) {
        return (
            <div className="w-64 border-r bg-muted/10 p-4 space-y-4 hidden md:block">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-10 bg-muted/50 animate-pulse rounded-lg" />
                    ))}
                </div>
            </div>
        )
    }

    const requiresLogistics = workflow?.requires_logistics ?? true
    const visibleSteps = steps.filter(step => step.id !== 2 || requiresLogistics)

    return (
        <div className="w-72 border-r bg-muted/10 p-4 flex flex-col hidden md:flex overflow-hidden">
            <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
                <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 mb-4 px-2">
                    Progreso de la Nota
                </h3>

                {visibleSteps.map((step, index) => {
                    const stepNumber = step.id
                    const Icon = step.icon
                    const isCompleted = workflow?.current_stage === 'COMPLETED' || currentStep > stepNumber
                    const isActive = currentStep === stepNumber
                    const isFuture = currentStep < stepNumber

                    return (
                        <div
                            key={step.id}
                            className={cn(
                                "rounded-xl transition-all duration-300 border",
                                isActive && "bg-primary text-primary-foreground shadow-md border-primary scale-[1.02]",
                                isCompleted && "bg-green-50 text-green-700 border-green-100",
                                isFuture && "text-muted-foreground bg-transparent border-transparent opacity-60"
                            )}
                        >
                            <div className="flex items-center space-x-3 p-3">
                                <div className={cn(
                                    "p-1.5 rounded-lg shrink-0",
                                    isActive ? "bg-white/20" : (isCompleted ? "bg-green-100" : "bg-muted")
                                )}>
                                    <Icon className="h-4 w-4" />
                                </div>
                                <span className="text-xs font-bold flex-1">{step.label}</span>
                                {isCompleted && <CheckCircle2 className="h-4 w-4 animate-in zoom-in duration-300" />}
                            </div>
                        </div>
                    )
                })}

                {workflow && (
                    <div className="mt-8 space-y-6 pt-6 border-t animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-2">
                                <Package className="h-3 w-3" />
                                Resumen de Nota
                            </h3>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground font-medium">Tipo:</span>
                                    <Badge variant="outline" className="text-[10px] font-bold uppercase">
                                        {workflow.invoice?.dte_type_display}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground font-medium">Items:</span>
                                    <span className="font-bold">{workflow.selected_items?.length || 0}</span>
                                </div>
                            </div>
                        </div>

                        {workflow.selected_items?.length > 0 && (
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                {workflow.selected_items.map((item: any, idx: number) => (
                                    <div key={idx} className="bg-background/50 border rounded-lg p-2 text-[11px] flex justify-between gap-2">
                                        <span className="truncate flex-1 font-medium">{item.product_name}</span>
                                        <span className="font-bold shrink-0">{item.quantity} un</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {workflow && workflow.invoice && (
                <div className="mt-auto pt-4 border-t space-y-3">
                    <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
                        <span>Neto</span>
                        <span className="font-mono">${Number(workflow.invoice.total_net).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
                        <span>IVA (19%)</span>
                        <span className="font-mono">${Number(workflow.invoice.total_tax).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Total</span>
                        <span className="text-xl font-black text-primary tracking-tighter font-mono">
                            ${Number(workflow.invoice.total).toLocaleString()}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}
