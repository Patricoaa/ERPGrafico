"use client"

import React, { useRef } from "react"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { OrderHubPanel } from "@/features/orders/components/OrderHubPanel"
import { ActionCategory } from "@/features/orders/components/ActionCategory"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { motion, AnimatePresence } from "framer-motion"

export function GlobalHubPanel() {
    const { isHubOpen, hubConfig, closeHub, actionEngineRef, isHubEffectivelyOpen } = useHubPanel()
    const { isSubModalActive } = useGlobalModals()
    
    const { activeDoc, fetchOrderDetails, userPermissions } = useOrderHubData({ 
        orderId: hubConfig?.orderId, 
        invoiceId: hubConfig?.invoiceId, 
        type: hubConfig?.type || 'sale', 
        enabled: isHubOpen 
    })

    // Derived: check modal as well to hide UI (but keep engine alive)
    const showFixedPanel = isHubEffectivelyOpen && !isSubModalActive
    const panelRef = useRef<HTMLDivElement>(null)

    return (
        <AnimatePresence mode="wait">
            {/* STABLE ACTION ENGINE (Headless) - ALWAYS RENDERED IF OPEN */}
            {isHubOpen && (
                <div className="sr-only" aria-hidden="true" id="global-action-engine">
                    <ActionCategory
                        key={hubConfig?.orderId || hubConfig?.invoiceId || 'engine'}
                        ref={actionEngineRef}
                        category={{ 
                            id: 'hub-engine', 
                            label: 'Global Engine', 
                            icon: null as any, 
                            actions: Object.values(hubConfig?.type === 'purchase' || hubConfig?.type === 'obligation' ? purchaseOrderActions : saleOrderActions).flatMap(c => c.actions) 
                        }}
                        order={activeDoc}
                        userPermissions={userPermissions || []}
                        onActionSuccess={() => { fetchOrderDetails(); hubConfig?.onActionSuccess?.() }}
                        posSessionId={hubConfig?.posSessionId}
                        headless={true}
                    />
                </div>
            )}

            {/* Hub Panel (Right/Fixed) - STRICTLY MUTUALLY EXCLUSIVE WITH DOCK */}
            {showFixedPanel && (
                <motion.div 
                    ref={panelRef}
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="fixed top-0 right-0 h-screen w-[420px] max-w-[100vw] z-[60] border-l shadow-2xl bg-background flex flex-col pointer-events-auto"
                >
                    {hubConfig && (
                        <OrderHubPanel
                            orderId={hubConfig.orderId}
                            invoiceId={hubConfig.invoiceId}
                            type={hubConfig.type}
                            onClose={closeHub}
                            onActionSuccess={hubConfig.onActionSuccess}
                            posSessionId={hubConfig.posSessionId}
                        />
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
