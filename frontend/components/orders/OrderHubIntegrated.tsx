"use client"

import { useRef, useMemo } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
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
    onModalChange
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

    const actionEngineRef = useRef<any>(null)
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

    if (!activeDoc) return null

    // Utility to render the timeline connector
    const Connector = ({ index }: { index: number }) => {
        if (index === visiblePhases.length - 1) return null
        return (
            <div className={cn(
                "absolute bg-border/20 z-0",
                compact ? "h-[2px] left-[50%] right-[-50%] top-[30px]" : "w-[2px] left-[19px] top-[32px] bottom-[-8px]"
            )} />
        )
    }

    const PhaseWrapper = ({ children, index }: { children: React.ReactNode, index: number }) => (
        <div className={cn(
            "relative flex flex-col",
            compact ? "flex-shrink-0 w-[300px] text-left" : "pl-12 text-left w-full"
        )}>
            <Connector index={index} />
            <div className="w-full flex-1 relative z-10 flex flex-col">
                {children}
            </div>
        </div>
    )

    return (
        <TooltipProvider delayDuration={0}>
            <div className={cn(
                "w-full overflow-hidden",
                compact && "overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
            )}>
                <div className={cn(
                    compact ? "flex flex-row gap-6 py-6 min-w-max px-4 items-stretch" : "flex flex-col gap-4 py-4"
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
                            isTimeline={compact}
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
                            isTimeline={compact}
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
                            isTimeline={compact}
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
                                isTimeline={compact}
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
                                isTimeline={compact}
                                onModalChange={onModalChange}
                            />
                        </PhaseWrapper>
                    )}
                </div>

                {/* Hidden Action Engine for global secondary actions (modals, etc) */}
                <div 
                    className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none invisible"
                    aria-hidden="true"
                >
                    <ActionCategory
                        ref={actionEngineRef}
                        category={{ id: 'engine', label: '', icon: null as any, actions: Object.values(registry).flatMap(c => c.actions) }}
                        order={activeDoc}
                        userPermissions={userPermissions}
                        onActionSuccess={onActionSuccess}
                        posSessionId={posSessionId}
                        onModalChange={onModalChange}
                    />
                </div>
            </div>
        </TooltipProvider>
    )
}
