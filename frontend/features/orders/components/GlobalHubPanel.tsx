"use client"

import React, { useRef, useEffect } from "react"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { OrderHubPanel } from "@/features/orders/components/OrderHubPanel"
import { ActionCategory } from "@/features/orders/components/ActionCategory"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { cn } from "@/lib/utils"

export function GlobalHubPanel() {
    const { isHubOpen, hubConfig, closeHub, isHubTemporarilyHidden, actionEngineRef, isDocked } = useHubPanel()
    const { isSubModalActive } = useGlobalModals()
    
    const { activeDoc, fetchOrderDetails, userPermissions } = useOrderHubData({ 
        orderId: hubConfig?.orderId, 
        invoiceId: hubConfig?.invoiceId, 
        type: hubConfig?.type || 'sale', 
        enabled: isHubOpen 
    })
<<<<<<< Updated upstream

    const isHubEffectivelyOpen = isHubOpen && !isSubModalActive && !isHubTemporarilyHidden

    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Do not close if hub is not effectively open or we have popups active
            if (!isHubEffectivelyOpen) return
            
            const target = event.target as Element

            // Do not close if clicking inside the Panel itself
            if (panelRef.current && panelRef.current.contains(target)) return
            
            // Do not close if clicking any OrderCard (they handle their own selection logic)
            if (target.closest('[data-order-card="true"]')) return

            // Do not close if clicking inside any Dialog or Sheet that is side-by-side with HUB
            if (target.closest('[role="dialog"]')) return

            // Close otherwise
            closeHub()
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [isHubEffectivelyOpen, closeHub])

=======
 
    const isHubEffectivelyOpen = isHubOpen && !isSubModalActive && !isHubTemporarilyHidden && !isDocked
 
>>>>>>> Stashed changes
    return (
        <>
            {/* Hub Panel (Right) - Fixed position, NO Dialog/Portal */}
            <div 
                ref={panelRef}
                className={cn(
                    "fixed top-0 right-0 h-screen w-[min(380px,100vw)] sm:min-w-[350px] md:min-w-[380px] z-[60] bg-transparent flex flex-col pointer-events-auto",
                    isHubEffectivelyOpen ? "translate-x-0" : "translate-x-[110%]"
                )}
                style={{
                    transition: 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                    willChange: 'transform'
                }}
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
