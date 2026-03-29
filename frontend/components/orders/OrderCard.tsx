"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ArrowRight, ShoppingCart, Package, Monitor, FileBadge, Wand2, Truck, GitBranch } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { OrderHubStatus } from "./OrderHubStatus"
import { NoteHubStatus } from "./NoteHubStatus"
import { PurchaseOrderHubStatus } from "./PurchaseOrderHubStatus"
import { cn } from "@/lib/utils"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { OrderHubIntegrated } from "./OrderHubIntegrated"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

interface OrderCardProps {
    item: any
    type: 'sale' | 'purchase' | 'work_order' | 'note' | 'ledger'
    onClick?: () => void
    onActionClick?: () => void
    hideStatus?: boolean
    className?: string
}

export function OrderCard({ item, type, onClick, onActionClick, hideStatus = false, className }: OrderCardProps) {
    const { openCommandCenter, openWorkOrder } = useGlobalModals()
    const [isExpanded, setIsExpanded] = useState(false)
    const [detailsModal, setDetailsModal] = useState<{ open: boolean, type: any, id: number | string }>({ open: false, type: 'sale_order', id: 0 })

    const isSale = type === 'sale'
    const isNote = type === 'note'
    const isPurchase = type === 'purchase' || (isNote && (item.purchase_order || item.purchase_order_id || item.supplier_name))
    const isWorkOrder = type === 'work_order'
    const isLedger = type === 'ledger'

    const hubData = useOrderHubData({ 
        orderId: isNote ? null : item.id, 
        invoiceId: isNote ? item.id : null, 
        type: isPurchase ? 'purchase' : 'sale', 
        enabled: isExpanded 
    })

    const openDetails = (docType: string, docId: number | string) => {
        if (docType === 'work_order') {
            openWorkOrder(Number(docId))
            return
        }
        setDetailsModal({ open: true, type: docType, id: docId })
    }

    // Determine Icon and Colors
    let Icon = ShoppingCart
    let iconBg = "bg-primary/5"
    let iconColor = "text-primary/60"
    let iconBorder = "border-primary/10"
    let prefix = "NV"

    if (isPurchase) {
        Icon = Package
        iconBg = "bg-indigo-500/5"
        iconColor = "text-indigo-500/60"
        iconBorder = "border-indigo-500/10"
        prefix = "OCS"
    } else if (isWorkOrder) {
        Icon = Wand2
        iconBg = "bg-purple-500/5"
        iconColor = "text-purple-500/60"
        iconBorder = "border-purple-500/10"
        prefix = "OT"
    } else if (isNote) {
        Icon = FileBadge
        iconBg = "bg-amber-500/5"
        iconColor = "text-amber-500/60"
        iconBorder = "border-amber-500/10"
        prefix = item.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND'
    } else if (isLedger) {
        Icon = ShoppingCart
        iconBg = "bg-primary/5"
        iconColor = "text-primary/60"
        iconBorder = "border-primary/10"
        prefix = "NV"
    }

    if ((isSale || isLedger) && item.pos_session) {
        Icon = Monitor
    }

    const itemNumber = item.display_id || (item.number ? (item.number.toString().includes(prefix) ? item.number : `${prefix}-${item.number}`) : '---')
    const itemName = item.customer_name || item.supplier_name || item.partner_name || item.name || '---'
    const displayTotal = isLedger ? (item.balance || item.pending_amount || 0) : (item.total || item.effective_total || 0)
    const originalTotal = item.total || item.effective_total || displayTotal

    return (
        <div className={cn("flex flex-col gap-0 overflow-hidden bg-card border border-border/50 rounded-2xl hover:border-primary/30 transition-all", isExpanded && "ring-2 ring-primary/20 bg-background shadow-2xl z-10", className)}>
            <div
                className={cn(
                    "group flex items-center justify-between p-4 cursor-pointer hover:bg-primary/[0.02] transition-colors",
                    isExpanded && "border-b border-border/40"
                )}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4 min-w-[30%]">
                    <div className={cn("w-12 h-12 rounded-xl flex flex-col items-center justify-center border transition-all duration-500", iconBg, iconColor, iconBorder, isExpanded && "scale-90 rotate-3")}>
                        <Icon className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {itemNumber}
                            </span>
                            <h4 className="font-bold text-foreground line-clamp-1 max-w-[150px]">
                                {itemName}
                            </h4>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatPlainDate(item.date)}
                            </span>
                            {isSale && item.pos_session && (
                                <Badge variant="secondary" className="text-[10px] h-3.5 bg-primary/10 text-primary border-primary/20 px-1 py-0 leading-none">
                                    POS #{item.pos_session}
                                </Badge>
                            )}
                            {item.warehouse_name && (
                                <span className="flex items-center gap-1">
                                    <Package className="h-3 w-3" />
                                    {item.warehouse_name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* CENTERED MINI STATES */}
                {!hideStatus && (
                    <div className="flex-1 flex justify-center px-4">
                        <div className={cn("transition-all duration-700", isExpanded ? "opacity-0 scale-90 translate-y-2 pointer-events-none" : "opacity-100 scale-100 translate-y-0")}>
                            {isNote ? (
                                <NoteHubStatus note={item} />
                            ) : isPurchase ? (
                                <PurchaseOrderHubStatus order={item} />
                            ) : (
                                <OrderHubStatus order={item} />
                            )}
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-6">
                    <div className="text-right min-w-[100px]">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                            Total
                        </div>
                        <MoneyDisplay 
                            amount={displayTotal} 
                            showColor={!isLedger} 
                            className={cn("text-sm", isLedger && "text-red-600 dark:text-red-400")}
                        />
                    </div>

                    <div className={cn("transition-transform duration-500", isExpanded ? "rotate-90" : "rotate-0")}>
                        <ArrowRight className="h-5 w-5 text-primary" />
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ 
                            type: 'spring', 
                            damping: 25, 
                            stiffness: 120,
                            opacity: { duration: 0.2 }
                        }}
                    >
                        <div className="p-4 bg-muted/20 border-t border-border/10">
                            <OrderHubIntegrated 
                                data={hubData}
                                type={isPurchase ? 'purchase' : 'sale'}
                                onActionSuccess={hubData.fetchOrderDetails}
                                openDetails={openDetails}
                                compact={true}
                                showAnimations={true}
                            />
                            
                            <div className="flex justify-end pt-4 mt-2 border-t border-border/40">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="rounded-full gap-2 px-4 shadow-sm hover:bg-primary hover:text-white transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onClick?.()
                                    }}
                                >
                                    Abrir Panel Completo
                                    <ArrowRight className="size-3" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <TransactionViewModal
                open={detailsModal.open}
                onOpenChange={(open) => setDetailsModal(prev => ({ ...prev, open }))}
                type={detailsModal.type}
                id={Number(detailsModal.id)}
            />
        </div>
    )
}
