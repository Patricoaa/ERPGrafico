"use client"

import React from "react"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { OrderHubPanel } from "@/features/orders/components/OrderHubPanel"
import { ActionCategory } from "@/features/orders/components/ActionCategory"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { cn } from "@/lib/utils"

export function GlobalHubPanel() {
    const { isHubOpen, hubConfig, closeHub, isHubTemporarilyHidden, actionEngineRef } = useHubPanel()
    const { isSubModalActive } = useGlobalModals()
    
    const { activeDoc, fetchOrderDetails, userPermissions } = useOrderHubData({ 
        orderId: hubConfig?.orderId, 
        invoiceId: hubConfig?.invoiceId, 
        type: hubConfig?.type || 'sale', 
        enabled: isHubOpen 
    })

    const isHubEffectivelyOpen = isHubOpen && !isSubModalActive && !isHubTemporarilyHidden

    return (
        <>
            {/* Hub Panel (Right) - Fixed position, NO Dialog/Portal */}
            <div 
                className={cn(
                    "fixed top-0 right-0 h-screen w-[500px] z-[60] border-l shadow-2xl transition-transform duration-500 ease-in-out bg-background flex flex-col pointer-events-auto",
                    isHubEffectivelyOpen ? "translate-x-0" : "translate-x-[110%]"
                )}
            >
                {isHubOpen && hubConfig && (
                    <OrderHubPanel
                        orderId={hubConfig.orderId}
                        invoiceId={hubConfig.invoiceId}
                        type={hubConfig.type}
                        onClose={closeHub}
                        onActionSuccess={hubConfig.onActionSuccess}
                        posSessionId={hubConfig.posSessionId}
                    />
                )}
            </div>

            {/* STABLE ACTION ENGINE (Headless) */}
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
        </>
    )
}
