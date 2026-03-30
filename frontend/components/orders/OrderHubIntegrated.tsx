"use client"

import { useRef, useMemo, useState, useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { OriginPhase } from "./phases/OriginPhase"
import { ProductionPhase } from "./phases/ProductionPhase"
import { LogisticsPhase } from "./phases/LogisticsPhase"
import { BillingPhase } from "./phases/BillingPhase"
import { TreasuryPhase } from "./phases/TreasuryPhase"
import { saleOrderActions } from "@/lib/actions/sale-actions"
import { purchaseOrderActions } from "@/lib/actions/purchase-actions"
import { ActionCategory } from "./ActionCategory"
import { cn } from "@/lib/utils"

interface OrderHubIntegratedProps {
    data: any
    type?: 'purchase' | 'sale' | 'obligation'
    onActionSuccess?: () => void
    openDetails: (docType: string, id: number | string) => void
    onEdit?: (orderId: number) => void
    posSessionId?: number | null
    showAnimations?: boolean
    compact?: boolean
}

export function OrderHubIntegrated({
    data,
    type,
    onActionSuccess,
    openDetails,
    onEdit,
    posSessionId = null,
    showAnimations = true,
    compact = false
}: OrderHubIntegratedProps) {
    const {
        order,
        activeInvoice,
        activeDoc,
        userPermissions,
        isNoteMode,
        noteStatuses,
        showProduction,
        showLogistics,
        invoices,
        billingIsComplete,
        payments
    } = data

    const registry = (type === 'purchase' || type === 'obligation') ? purchaseOrderActions : saleOrderActions
    


    // Determine which phases are visible to draw the connectors correctly
    const visiblePhases = useMemo(() => {
        const phases = []
        phases.push('origin')
        phases.push('billing')
        phases.push('treasury')
        if (showProduction) phases.push('production')
        if (showLogistics) phases.push('logistics')
        return phases
    }, [showProduction, showLogistics])

    // Memoize the engine category only if NOT headless (meaning we are the engine)
    // Actually, in the new architecture, the engine is in the parent, so we don't need this locally anymore.
    // We'll keep the registry for visibility logic in phases.

    if (!activeDoc) return null

    const PhaseWrapper = ({ children, index }: { children: React.ReactNode, index: number }) => (
        <div className="w-full relative z-10 flex flex-col">
            {children}
        </div>
    )

    return (
        <TooltipProvider delayDuration={150}>
            <div className="flex flex-col w-full">
                <div className="w-full">
                    <div className="flex flex-col gap-4 py-4">
                        {/* 1. Origen */}
                        <PhaseWrapper index={visiblePhases.indexOf('origin')}>
                            <OriginPhase
                                isNoteMode={!!isNoteMode}
                                activeInvoice={activeInvoice}
                                noteStatuses={noteStatuses}
                                order={order}
                                activeDoc={activeDoc}
                                type={type || 'sale'}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                onEdit={onEdit}
                            />
                        </PhaseWrapper>

                        {/* 2. Facturación */}
                        <PhaseWrapper index={visiblePhases.indexOf('billing')}>
                            <BillingPhase
                                isNoteMode={!!isNoteMode}
                                noteStatuses={noteStatuses}
                                activeDoc={activeDoc}
                                invoices={invoices}
                                billingIsComplete={billingIsComplete}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                posSessionId={posSessionId}
                            />
                        </PhaseWrapper>

                        {/* 3. Tesorería */}
                        <PhaseWrapper index={visiblePhases.indexOf('treasury')}>
                            <TreasuryPhase
                                isNoteMode={!!isNoteMode}
                                noteStatuses={noteStatuses}
                                activeDoc={activeDoc}
                                payments={payments}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                posSessionId={posSessionId}
                            />
                        </PhaseWrapper>

                        {/* 4. Producción */}
                        {showProduction && (
                            <PhaseWrapper index={visiblePhases.indexOf('production')}>
                                <ProductionPhase
                                    order={order}
                                    activeDoc={activeDoc}
                                    userPermissions={userPermissions}
                                    onActionSuccess={onActionSuccess}
                                    openDetails={openDetails}
                                    showAnimations={showAnimations}
                                />
                            </PhaseWrapper>
                        )}

                        {/* 5. Logística / Cumplimiento */}
                        {showLogistics && (
                            <PhaseWrapper index={visiblePhases.indexOf('logistics')}>
                                <LogisticsPhase
                                    activeDoc={activeDoc}
                                    isNoteMode={!!isNoteMode}
                                    noteStatuses={noteStatuses}
                                    isSale={type === 'sale'}
                                    invoices={invoices}
                                    userPermissions={userPermissions}
                                    onActionSuccess={onActionSuccess}
                                    openDetails={openDetails}
                                    showAnimations={showAnimations}
                                    logisticsProgress={data.logisticsProgress}
                                />
                            </PhaseWrapper>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}
