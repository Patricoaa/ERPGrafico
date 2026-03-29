"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, ArrowRight, Receipt, FileBadge, Package, GitBranch, ChevronDown } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { InvoiceHubStatus } from "@/components/billing/InvoiceHubStatus"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { motion, AnimatePresence } from "framer-motion"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { OrderHubIntegrated } from "@/components/orders/OrderHubIntegrated"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

type InvoiceType = 'sale_invoice' | 'purchase_invoice'

interface InvoiceCardProps {
    item: any
    type: InvoiceType
    onClick?: () => void
    className?: string
}

const dteTypeLabel: Record<string, string> = {
    FACTURA: 'FAC',
    FACTURA_EXENTA: 'FE',
    BOLETA: 'BOL',
    BOLETA_EXENTA: 'BE',
    NOTA_CREDITO: 'NC',
    NOTA_DEBITO: 'ND',
    PURCHASE_INV: 'FAC',
}

export function InvoiceCard({ item, type, onClick, className }: InvoiceCardProps) {
    const { openCommandCenter } = useGlobalModals()
    const isSale = type === 'sale_invoice'
    const isPurchase = type === 'purchase_invoice'
    const isNote = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(item.dte_type)

    const [isExpanded, setIsExpanded] = useState(false)
    const [detailsModal, setDetailsModal] = useState<{ open: boolean, type: any, id: number | string }>({ open: false, type: 'sale_order', id: 0 })
    
    const hubData = useOrderHubData({ 
        invoiceId: item.id, 
        type: isSale ? 'sale' : 'purchase', 
        enabled: isExpanded 
    })

    const openDetails = (docType: string, docId: number | string) => {
        setDetailsModal({ open: true, type: docType, id: docId })
    }

    // Icon and color scheme
    let Icon = Receipt
    let iconBg = "bg-primary/5"
    let iconColor = "text-primary/60"
    let iconBorder = "border-primary/10"

    if (isPurchase) {
        Icon = Package
        iconBg = "bg-indigo-500/5"
        iconColor = "text-indigo-500/60"
        iconBorder = "border-indigo-500/10"
    } else if (isNote) {
        Icon = FileBadge
        iconBg = "bg-amber-500/5"
        iconColor = "text-amber-500/60"
        iconBorder = "border-amber-500/10"
    }

    const typeCode = dteTypeLabel[item.dte_type] ?? 'DOC'
    const docNumber = item.number ? `${typeCode}-${item.number}` : '---'
    const partnerName = item.partner_name || item.customer_name || item.supplier_name || '---'

    const total = parseFloat(item.total ?? '0')

    return (
        <div className={cn("flex flex-col gap-0 w-full min-w-0 max-w-full", className)}>
            <div
                className={cn(
                    "group flex items-center justify-between p-4 bg-card border border-border/50 transition-all cursor-pointer relative z-10",
                    isExpanded ? "rounded-t-2xl border-b-0 shadow-sm" : "rounded-2xl hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                )}
                onClick={() => {
                    setIsExpanded(!isExpanded)
                    // We REMOVED onClick?.() here to prevent expanding and opening the sheet AT THE SAME TIME
                    // This allows the card to JUST expand, like in OrderCard.
                }}
            >
                {/* Left: icon + info */}
                <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                        "w-12 h-12 shrink-0 rounded-xl flex flex-col items-center justify-center border transition-transform duration-300",
                        isExpanded ? "scale-90 opacity-80" : "group-hover:scale-105",
                        iconBg, iconColor, iconBorder
                    )}>
                        <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                {docNumber}
                            </span>
                            <h4 className="font-bold text-foreground truncate">
                                {partnerName}
                            </h4>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatPlainDate(item.date)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right: status + total + arrow */}
                <div className="flex items-center gap-4 shrink-0 ml-4">
                    {/* Status badge */}
                    <div className="hidden sm:flex items-center gap-3">
                        {/* Parent/Corrected Invoice Link (only for Notes) */}
                        {isNote && (item.corrected_invoice || item.sale_order || item.purchase_order) && (
                            <Badge 
                                variant="outline" 
                                className="h-6 px-2 gap-1.5 text-[10px] font-bold border-purple-500/30 text-purple-600 bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (item.corrected_invoice) {
                                        openCommandCenter(null, 'sale', item.corrected_invoice.id)
                                    } else if (item.sale_order || item.purchase_order) {
                                        openCommandCenter(item.sale_order || item.purchase_order, item.sale_order ? 'sale' : 'purchase', null)
                                    }
                                }}
                            >
                                <GitBranch className="size-3" />
                                {item.corrected_invoice?.display_id || item.sale_order_number || item.purchase_order_number || 'Ver Origen'}
                            </Badge>
                        )}

                        {/* Associated Adjustments Links (for regular invoices) */}
                        {!isNote && item.adjustments?.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                {item.adjustments.map((adj: any) => (
                                    <Badge 
                                        key={adj.id}
                                        variant="outline" 
                                        className="h-6 px-2 gap-1.5 text-[10px] font-bold border-purple-500/30 text-purple-600 bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            openCommandCenter(null, isSale ? 'sale' : 'purchase', adj.id)
                                        }}
                                    >
                                        <GitBranch className="size-3" />
                                        {adj.display_id || adj.number}
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <InvoiceHubStatus invoice={item} />
                    </div>

                    <div className="text-right min-w-[100px]">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</div>
                        <MoneyDisplay amount={total} showColor={false} className="text-sm" />
                    </div>

                    <div className={cn("transition-transform duration-500 ml-2", isExpanded ? "rotate-90" : "rotate-0")}>
                        <ArrowRight className="h-5 w-5 text-primary opacity-50 group-hover:opacity-100" />
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden border border-t-0 border-border/50 rounded-b-2xl bg-muted/5"
                    >
                        <div className="p-4 pt-0">
                            <OrderHubIntegrated 
                                data={hubData}
                                type={isSale ? 'sale' : 'purchase'}
                                compact={true}
                                openDetails={openDetails}
                                onActionSuccess={() => hubData.fetchOrderDetails()}
                            />
                            
                            <div className="flex justify-end pt-4 mt-2 border-t border-border/40">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="rounded-full gap-2 px-4 shadow-sm hover:bg-primary hover:text-white transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        openCommandCenter(null, isSale ? 'sale' : 'purchase', item.id)
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
