
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn, formatCurrency } from "@/lib/utils"
import { TrendingUp, Package, FileText, Banknote, ClipboardList } from "lucide-react"

import { Order } from "../types"
import { LucideIcon } from "lucide-react"

interface OrderHeaderDashboardProps {
    order: Partial<Order> | null
    activeInvoice: Partial<Order> | null
    isNoteMode: boolean
    type: 'purchase' | 'sale' | 'obligation'
    globalStatus: { label: string, variant: string, icon: LucideIcon | React.ElementType }
    phasesStatus: {
        production: string
        logistics: string
        billing: string
        treasury: string
        origin: string
    }
}

export function OrderHeaderDashboard({
    order,
    activeInvoice,
    isNoteMode,
    type,
    globalStatus,
    phasesStatus
}: OrderHeaderDashboardProps) {
    const activeDoc = activeInvoice || order
    if (!activeDoc) return null

    // KPIs
    const totalAmount = parseFloat(String(activeDoc.total || '0'))
    const pendingAmount = parseFloat(String(activeDoc.pending_amount || '0'))
    const paidAmount = totalAmount - pendingAmount
    const paymentProgress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0

    // Stepper Configuration
    const steps = [
        { id: 'origin', label: 'Origen', icon: TrendingUp, status: phasesStatus.origin },
        ...(type === 'sale' && !isNoteMode ? [{ id: 'production', label: 'Producción', icon: ClipboardList, status: phasesStatus.production }] : []),
        { id: 'logistics', label: 'Logística', icon: Package, status: phasesStatus.logistics },
        { id: 'billing', label: 'Facturación', icon: FileText, status: phasesStatus.billing },
        { id: 'treasury', label: 'Tesorería', icon: Banknote, status: phasesStatus.treasury },
    ]

    const getStepStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'text-success bg-success/10 border-success/20'
            case 'active': return 'text-primary bg-primary/10 border-primary/20 animate-pulse'
            case 'neutral': return 'text-muted-foreground bg-muted/10 border-white/5'
            case 'destructive': return 'text-destructive bg-destructive/10 border-destructive/20'
            case 'not_applicable': return 'text-muted-foreground/30 bg-muted/5 border-transparent opacity-50'
            default: return 'text-muted-foreground'
        }
    }

    const getStepIconColor = (status: string) => {
        switch (status) {
            case 'success': return 'text-success'
            case 'active': return 'text-primary'
            case 'destructive': return 'text-destructive'
            default: return 'text-muted-foreground/50'
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            {/* KPI Cards */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <CardContent className="p-4 flex flex-col justify-between h-full relative z-10">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Orden</span>
                    <div className="flex items-end justify-between mt-1">
                        <span className="text-2xl font-black text-foreground tracking-tight">{formatCurrency(totalAmount)}</span>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10 backdrop-blur-sm relative overflow-hidden">
                <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Estado Financiero</span>
                        <span className={cn("text-[10px] font-bold", pendingAmount <= 0 ? "text-success" : "text-warning")}>
                            {pendingAmount <= 0 ? "PAGADO" : "PENDIENTE"}
                        </span>
                    </div>

                    <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[11px] font-medium text-foreground/80">
                            <span>Pagado: {formatCurrency(paidAmount)}</span>
                            <span className="text-muted-foreground/50">{Math.round(paymentProgress)}%</span>
                        </div>
                        <Progress value={paymentProgress} className={cn("h-1.5 bg-white/5", pendingAmount <= 0 && "bg-success/20 [&>*]:bg-success")} />
                    </div>
                </CardContent>
            </Card>

            {/* Visual Stepper / Timeline */}
            <Card className="lg:col-span-2 bg-white/5 border-white/10 backdrop-blur-sm flex flex-col justify-center">
                <CardContent className="p-4 py-3">
                    <div className="flex items-center justify-between relative">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -z-0 -translate-y-1/2 rounded-full hidden sm:block" />

                        {steps.map((step, index) => {
                            const isLast = index === steps.length - 1
                            const isActive = step.status === 'active'
                            const isSuccess = step.status === 'success'

                            return (
                                <div key={step.id} className={cn("relative z-10 flex flex-col items-center gap-2 group", step.status === 'not_applicable' && "hidden sm:flex")}>
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm bg-background",
                                        getStepStatusColor(step.status),
                                        isActive && "scale-110 shadow-lg shadow-primary/20",
                                        step.status === 'not_applicable' && "bg-transparent border-dashed",
                                    )}>
                                        <step.icon className={cn("h-3.5 w-3.5", getStepIconColor(step.status))} />
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 hidden sm:block",
                                        isActive ? "text-primary" : "text-muted-foreground/70",
                                        step.status === 'success' && "text-success/80"
                                    )}>
                                        {step.label}
                                    </span>

                                    {/* Mobile Label (only for active step) */}
                                    <span className={cn("sm:hidden text-[9px] font-bold absolute -bottom-5 whitespace-nowrap", isActive ? "text-primary block" : "hidden")}>
                                        {step.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
