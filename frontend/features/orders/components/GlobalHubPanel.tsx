"use client"

import React from "react"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { OrderHubPanel } from "@/features/orders/components/OrderHubPanel"
import { ActionCategory } from "@/features/orders/components/ActionCategory"
import { saleOrderActions } from '@/features/sales'
import { purchaseOrderActions } from '@/features/purchasing'
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { type LucideIcon, LayoutGrid } from "lucide-react"
import { CollapsibleSheet } from "@/components/shared"

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
    const showPanel = isHubEffectivelyOpen && !isSubModalActive

    return (
        <>
            {/* STABLE ACTION ENGINE (Headless) - ALWAYS RENDERED IF OPEN */}
            {isHubOpen && (
                <div className="sr-only" aria-hidden="true" id="global-action-engine">
                    <ActionCategory
                        key={hubConfig?.orderId || hubConfig?.invoiceId || 'engine'}
                        ref={actionEngineRef}
                        category={{ 
                            id: 'hub-engine', 
                            label: 'Global Engine', 
                            icon: undefined as unknown as LucideIcon, 
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

            <CollapsibleSheet
                sheetId="global-hub-panel"
                open={showPanel}
                onOpenChange={(open) => !open && closeHub()}
                tabLabel="HUB"
                tabIcon={LayoutGrid}
                variant="global"
                fullWidth={320}
                priority={10}
            >
                {hubConfig && (
                    <OrderHubPanel
                        orderId={hubConfig.orderId}
                        invoiceId={hubConfig.invoiceId}
                        type={hubConfig.type}
                        onClose={closeHub}
                        onActionSuccess={hubConfig.onActionSuccess}
                        posSessionId={hubConfig.posSessionId}
                        showHeader={true}
                    />
                )}
            </CollapsibleSheet>
        </>
    )
}
