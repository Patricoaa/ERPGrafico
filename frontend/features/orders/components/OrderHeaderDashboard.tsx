"use client"

import { formatCurrency } from "@/lib/money"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { TrendingUp, Package, FileText, Banknote, ClipboardList } from "lucide-react"
import { StatCard } from "@/components/shared"

import { type Order } from "../types"
import { type LucideIcon } from "lucide-react"

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

    const getStepIconColor = (status: string) => {
        switch (status) {
            case 'success': return 'text-success'
            case 'active': return 'text-primary'
            case 'destructive': return 'text-destructive'
            default: return 'text-muted-foreground/50'
        }
    }

    const getStepProgress = (status: string) => {
        switch (status) {
            case 'success': return 100
            case 'active': return 50
            default: return 0
        }
    }

    const getStepRingColor = (status: string) => {
        switch (status) {
            case 'success': return 'text-success'
            case 'active': return 'text-primary'
            case 'destructive': return 'text-destructive'
            default: return 'text-muted-foreground/30'
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            {/* KPI Cards */}
            <StatCard
                label="Total Orden"
                value={formatCurrency(totalAmount)}
                icon={TrendingUp}
                accent="primary"
            />
            <StatCard
                label="Estado Financiero"
                value={
                    <span className={cn(pendingAmount <= 0 ? "text-success" : "text-warning")}>
                        {pendingAmount <= 0 ? "PAGADO" : "PENDIENTE"}
                    </span>
                }
                accent="primary"
            >
                <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-foreground/80">
                        <span>Pagado: {formatCurrency(paidAmount)}</span>
                        <span className="text-muted-foreground/50">{Math.round(paymentProgress)}%</span>
                    </div>
                    <Progress value={paymentProgress} className={cn("h-1.5 bg-muted", pendingAmount <= 0 && "bg-success/20 [&>*]:bg-success")} />
                </div>
            </StatCard>

            {/* Visual Stepper / Timeline */}
            <Card className="lg:col-span-2 bg-card/50 border-border backdrop-blur-sm flex flex-col justify-center">
                <CardContent className="p-4 py-3">
                    <div className="flex items-center justify-between relative">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border -z-0 -translate-y-1/2 rounded-full hidden sm:block" />

                        {steps.map((step) => {
                            const isActive = step.status === 'active'

                            return (
                                <div key={step.id} className={cn("relative z-10 flex flex-col items-center gap-2 group", step.status === 'not_applicable' && "hidden sm:flex")}>
                                    <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
                                        <step.icon className={cn("h-4 w-4", getStepIconColor(step.status))} />
                                        {getStepProgress(step.status) > 0 && (
                                            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 24 24">
                                                <circle
                                                    cx="12" cy="12" r="10.5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeDasharray={`${2 * Math.PI * 10.5}`}
                                                    strokeDashoffset={2 * Math.PI * 10.5 * (1 - getStepProgress(step.status) / 100)}
                                                    className={getStepRingColor(step.status)}
                                                />
                                            </svg>
                                        )}
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
