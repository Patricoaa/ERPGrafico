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
    onModalChange?: (isOpen: boolean) => void
    actionEngineRef?: React.RefObject<any>
}

export function OrderHubIntegrated({
    data,
    type,
    onActionSuccess,
    openDetails,
    onEdit,
    posSessionId = null,
    showAnimations = true,
    compact = false,
    onModalChange,
    actionEngineRef: externalActionEngineRef
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

    // Use external ref if provided (from sheet parent), otherwise default to null (won't trigger actions)
    const actionEngineRef = externalActionEngineRef
    
    const registry = (type === 'purchase' || type === 'obligation') ? purchaseOrderActions : saleOrderActions
    
    // isTimeline = true (Dashboard/Horizontal), false (Sheet/Vertical)
    const isTimeline = useMemo(() => !compact, [compact])

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

    // Utility to render the timeline connector
    const Connector = ({ index }: { index: number }) => {
        if (index === visiblePhases.length - 1) return null
        return (
            <div className={cn(
                "absolute bg-border/20 z-0",
                isTimeline ? "h-[2px] left-[50%] right-[-50%] top-[30px]" : "w-[2px] left-[19px] top-[32px] bottom-[-8px]"
            )} />
        )
    }

    const PhaseWrapper = ({ children, index }: { children: React.ReactNode, index: number }) => (
        <div className={cn(
            "relative flex flex-col",
            isTimeline ? "flex-shrink-0 w-[300px] text-left" : "pl-12 text-left w-full"
        )}>
            <Connector index={index} />
            <div className="w-full flex-1 relative z-10 flex flex-col">
                {children}
            </div>
        </div>
    )

    return (
        <TooltipProvider delayDuration={150}>
            <div className="flex flex-col w-full h-full">
                {/* 
                  ACTION ENGINE REMOVED FROM HERE 
                  It is now hosted by the parent (OrderCommandCenter or OrderCard) 
                  to ensure its lifecycle is independent of the sheet content's visibility.
                */}

                <div className={cn(
                    "w-full overflow-hidden flex-1",
                    isTimeline && "overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                )}>
                    <div className={cn(
                        isTimeline ? "flex flex-row gap-6 py-6 min-w-max px-4 items-stretch" : "flex flex-col gap-4 py-4"
                    )}>
                        {/* 1. Origen */}
                        <PhaseWrapper index={visiblePhases.indexOf('origin')}>
                            <OriginPhase
                                isNoteMode={!!isNoteMode}
                                activeInvoice={activeInvoice}
                                noteStatuses={noteStatuses}
                                order={order}
                                activeDoc={activeDoc}
                                type={type || 'sale'}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                onEdit={onEdit}
                                userPermissions={userPermissions}
                                actionEngineRef={actionEngineRef}
                                isTimeline={isTimeline}
                                onModalChange={onModalChange}
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
                                registry={registry}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                actionEngineRef={actionEngineRef}
                                posSessionId={posSessionId}
                                isTimeline={isTimeline}
                                onModalChange={onModalChange}
                            />
                        </PhaseWrapper>

                        {/* 3. Tesorería */}
                        <PhaseWrapper index={visiblePhases.indexOf('treasury')}>
                            <TreasuryPhase
                                isNoteMode={!!isNoteMode}
                                noteStatuses={noteStatuses}
                                activeDoc={activeDoc}
                                payments={payments}
                                registry={registry}
                                userPermissions={userPermissions}
                                onActionSuccess={onActionSuccess}
                                openDetails={openDetails}
                                actionEngineRef={actionEngineRef}
                                posSessionId={posSessionId}
                                isTimeline={isTimeline}
                                onModalChange={onModalChange}
                            />
                        </PhaseWrapper>

                        {/* 4. Producción */}
                        {showProduction && (
                            <PhaseWrapper index={visiblePhases.indexOf('production')}>
                                <ProductionPhase
                                    order={order}
                                    activeDoc={activeDoc}
                                    registry={registry}
                                    userPermissions={userPermissions}
                                    onActionSuccess={onActionSuccess}
                                    openDetails={openDetails}
                                    actionEngineRef={actionEngineRef}
                                    showAnimations={showAnimations}
                                    isTimeline={isTimeline}
                                    onModalChange={onModalChange}
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
                                    registry={registry}
                                    userPermissions={userPermissions}
                                    onActionSuccess={onActionSuccess}
                                    openDetails={openDetails}
                                    actionEngineRef={actionEngineRef}
                                    showAnimations={showAnimations}
                                    isTimeline={isTimeline}
                                    onModalChange={onModalChange}
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
