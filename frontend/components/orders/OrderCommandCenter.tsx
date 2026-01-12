"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    CheckCircle2,
    Circle,
    Package,
    FileText,
    Banknote,
    Settings2,
    Clock,
    ArrowRight
} from "lucide-react"
import { ActionCategory } from "./ActionCategory"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import type { ActionCategory as CategoryType } from "@/types/actions"
import api from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { getStatusVariant } from "@/lib/actions/utils"

interface OrderCommandCenterProps {
    orderId: number | null
    type: 'purchase' | 'sale'
    open: boolean
    onOpenChange: (open: boolean) => void
    onActionSuccess?: () => void
}

export function OrderCommandCenter({
    orderId,
    type,
    open,
    onOpenChange,
    onActionSuccess
}: OrderCommandCenterProps) {
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [userPermissions, setUserPermissions] = useState<string[]>([])

    const fetchOrderDetails = async () => {
        if (!orderId) return
        setLoading(true)
        try {
            const endpoint = type === 'purchase' ? `/purchasing/orders/${orderId}/` : `/sales/orders/${orderId}/`
            const response = await api.get(endpoint)
            setOrder(response.data)
        } catch (error) {
            console.error("Error fetching order details:", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchUserPermissions = async () => {
        try {
            const response = await api.get('/auth/user/')
            setUserPermissions(response.data.permissions || [])
        } catch (error) {
            console.error("Error fetching permissions:", error)
        }
    }

    useEffect(() => {
        if (open && orderId) {
            fetchOrderDetails()
            fetchUserPermissions()
        }
    }, [open, orderId])

    if (!order) return null

    const registry = type === 'purchase' ? purchaseOrderActions : saleOrderActions

    // Timeline logic
    const steps = [
        { id: 'confirmed', label: 'Confirmada', icon: CheckCircle2, completed: true },
        {
            id: 'received',
            label: type === 'purchase' ? 'Recibida' : 'Despachada',
            icon: Package,
            completed: type === 'purchase' ? order.receiving_status === 'RECEIVED' : order.delivery_status === 'DELIVERED',
            active: type === 'purchase' ? order.receiving_status === 'PARTIAL' : order.delivery_status === 'PARTIAL'
        },
        {
            id: 'invoiced',
            label: 'Facturada',
            icon: FileText,
            completed: (order.related_documents?.invoices?.length || 0) > 0 && !order.related_documents?.invoices?.some((i: any) => i.status === 'DRAFT' || i.number === 'Draft')
        },
        {
            id: 'paid',
            label: 'Pagada',
            icon: Banknote,
            completed: order.status === 'PAID' || order.payment_status === 'PAID'
        }
    ]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[95vw] lg:max-w-[1400px] max-h-[95vh] overflow-y-auto bg-background/95 backdrop-blur-sm border-border/50">
                <DialogHeader className="pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <Settings2 className="h-6 w-6 text-primary" />
                                Centro de Comandos: {type === 'purchase' ? 'OC' : 'NV'}-{order.number}
                            </DialogTitle>
                            <DialogDescription className="flex items-center gap-4 mt-1">
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(order.created_at || order.date).toLocaleDateString()}
                                </span>
                                <Badge variant={order.status === 'PAID' ? 'success' : 'outline'} className="capitalize">
                                    {order.status_display || order.status}
                                </Badge>
                                <span className="text-muted-foreground font-medium">
                                    {type === 'purchase' ? order.supplier_name : order.customer_name}
                                </span>
                            </DialogDescription>
                        </div>
                        <div className="text-right bg-primary/5 p-4 rounded-xl border border-primary/10">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1 opacity-70">Total Orden</p>
                            <p className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(order.total)}</p>
                        </div>
                    </div>
                </DialogHeader>

                {/* Timeline Stepper (Independent States) */}
                <div className="py-12 px-12 bg-muted/20 rounded-2xl mt-6 border border-border/50">
                    <div className="relative flex justify-between max-w-5xl mx-auto">
                        {/* Connecting Line (Muted Background) */}
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted/50 -translate-y-1/2 z-0" />

                        {steps.map((step, idx) => (
                            <div key={idx} className="relative z-10 flex flex-col items-center gap-2 bg-background/95 px-4">
                                <div className={`
                                    h-12 w-12 rounded-full flex items-center justify-center border-2 transition-all duration-300
                                    ${step.completed ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20' :
                                        step.active ? 'bg-background border-primary text-primary animate-pulse' :
                                            'bg-background border-muted text-muted-foreground'}
                                `}>
                                    <step.icon className="h-6 w-6" />
                                </div>
                                <span className={`text-[11px] font-bold uppercase tracking-wider ${step.completed || step.active ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {step.label}
                                </span>
                                {step.completed && (
                                    <Badge variant="success" className="h-5 px-2 text-[9px] font-black animate-in fade-in zoom-in duration-500 shadow-sm border-white/20">
                                        LISTO
                                    </Badge>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Phase Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-8 mt-6">
                    {/* Phase 1: Logistics */}
                    <PhaseCard
                        title="1. Logística"
                        icon={Package}
                        status={type === 'purchase' ? order.receiving_status : order.delivery_status}
                        badgeType={type === 'purchase' ? 'pending' : 'pending'}
                    >
                        <div className="space-y-3">
                            <div className="flex justify-between items-end text-sm">
                                <span className="text-muted-foreground">{type === 'purchase' ? 'Recepción física' : 'Despacho de productos'}</span>
                                <span className="font-medium">
                                    {Math.round((steps[1].completed ? 100 : order.receiving_progress || 0))}%
                                </span>
                            </div>
                            <Progress value={steps[1].completed ? 100 : order.receiving_progress || 0} className="h-1.5" />
                            <div className="pt-2">
                                <ActionCategory
                                    category={registry[type === 'purchase' ? 'receptions' : 'deliveries']}
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => {
                                        fetchOrderDetails()
                                        onActionSuccess?.()
                                    }}
                                    layout="grid"
                                />
                            </div>
                        </div>
                    </PhaseCard>

                    {/* Phase 2: Billing */}
                    <PhaseCard
                        title="2. Documentación"
                        icon={FileText}
                        status={(order.related_documents?.invoices?.length || 0) > 0 ? "ASIGNADO" : "PENDIENTE"}
                    >
                        <div className="space-y-3">
                            <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-sm">
                                {order.related_documents?.invoices?.length > 0 ? (
                                    <div className="space-y-1">
                                        <p className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Documento Principal</p>
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium">
                                                {order.related_documents.invoices[0].type_display}: {order.related_documents.invoices[0].number}
                                            </span>
                                            <Badge variant={getStatusVariant(order.related_documents.invoices[0].status)}>
                                                {order.related_documents.invoices[0].status}
                                            </Badge>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground italic py-2">Sin documentos legales emitidos</p>
                                )}
                            </div>
                            <div className="pt-2">
                                <ActionCategory
                                    category={registry.documents}
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => {
                                        fetchOrderDetails()
                                        onActionSuccess?.()
                                    }}
                                    layout="grid"
                                />
                            </div>
                        </div>
                    </PhaseCard>

                    {/* Phase 3: Treasury */}
                    <PhaseCard
                        title="3. Tesorería"
                        icon={Banknote}
                        status={order.payment_status}
                    >
                        <div className="space-y-3">
                            <div className="flex justify-between items-end text-sm">
                                <span className="text-muted-foreground">Cobertura de pago</span>
                                <span className="font-medium">{Math.round((1 - (order.pending_amount / order.total)) * 100)}%</span>
                            </div>
                            <Progress value={(1 - (order.pending_amount / order.total)) * 100} className="h-1.5" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Pagado: {formatCurrency(order.total - order.pending_amount)}</span>
                                <span>Saldo: {formatCurrency(order.pending_amount)}</span>
                            </div>
                            <div className="pt-2">
                                <ActionCategory
                                    category={registry.payments}
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => {
                                        fetchOrderDetails()
                                        onActionSuccess?.()
                                    }}
                                    layout="grid"
                                />
                            </div>
                        </div>
                    </PhaseCard>

                    {/* Phase 4: Management */}
                    <PhaseCard
                        title="4. Administración"
                        icon={Settings2}
                    >
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                                Gestione notas de crédito, ajustes internos o anulaciones totales del documento.
                            </p>
                            <div className="grid grid-cols-1 gap-4 pt-2">
                                <ActionCategory
                                    category={registry.notes}
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => {
                                        fetchOrderDetails()
                                        onActionSuccess?.()
                                    }}
                                    layout="grid"
                                />
                                <ActionCategory
                                    category={registry.management}
                                    order={order}
                                    userPermissions={userPermissions}
                                    onActionSuccess={() => {
                                        fetchOrderDetails()
                                        onActionSuccess?.()
                                    }}
                                    layout="grid"
                                />
                            </div>
                        </div>
                    </PhaseCard>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function PhaseCard({ title, icon: Icon, children, status, badgeType }: any) {
    return (
        <div className="p-8 rounded-2xl border border-border/50 bg-card hover:bg-accent/5 transition-all group shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-lg tracking-tight">{title}</h3>
                </div>
                {status && (
                    <Badge variant={status === 'PAID' || status === 'RECEIVED' || status === 'DELIVERED' ? 'success' : 'outline'} className="text-[10px] uppercase tracking-tighter">
                        {status}
                    </Badge>
                )}
            </div>
            {children}
        </div>
    )
}
