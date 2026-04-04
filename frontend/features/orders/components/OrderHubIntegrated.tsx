"use client"

import { useRef, useMemo, useState, useEffect, useCallback } from "react"
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
import { getHubStatuses } from "@/lib/order-status-utils"

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

    // Determine which phases are visible
    const visiblePhases = useMemo(() => {
        const phases = []
        phases.push('origin')
        phases.push('billing')
        phases.push('treasury')
        if (showProduction) phases.push('production')
        if (showLogistics) phases.push('logistics')
        return phases
    }, [showProduction, showLogistics])

    // --- Accordion State ---
    // Compute which phases should be open (all non-success phases)
    const initialOpenPhases = useMemo(() => {
        if (!activeDoc) return new Set<string>(['origin'])

        const openSet = new Set<string>()

        if (isNoteMode) {
            if (noteStatuses.origin !== 'success') openSet.add('origin')
            if (noteStatuses.billing !== 'success') openSet.add('billing')
            if (noteStatuses.treasury !== 'success') openSet.add('treasury')
            if (noteStatuses.logistics !== 'success') openSet.add('logistics')
        } else {
            const hubStatuses = getHubStatuses(activeDoc)
            if (hubStatuses.origin !== 'success') openSet.add('origin')
            if (hubStatuses.billing !== 'success') openSet.add('billing')
            if (hubStatuses.treasury !== 'success') openSet.add('treasury')
            if (showProduction && hubStatuses.production !== 'success' && hubStatuses.production !== 'not_applicable') openSet.add('production')
            if (showLogistics && hubStatuses.logistics !== 'success' && hubStatuses.logistics !== 'not_applicable') openSet.add('logistics')
        }

        // If all phases are complete, open origin as fallback
        if (openSet.size === 0) openSet.add('origin')

        return openSet
    }, [activeDoc?.id]) // Only recalculate when the document changes, not on every render

    const [openPhases, setOpenPhases] = useState<Set<string>>(initialOpenPhases)

    // Reset when document changes
    useEffect(() => {
        setOpenPhases(initialOpenPhases)
    }, [initialOpenPhases])

    const togglePhase = useCallback((phaseId: string) => (isOpen: boolean) => {
        setOpenPhases(prev => {
            const next = new Set(prev)
            if (isOpen) {
                next.add(phaseId)
            } else {
                next.delete(phaseId)
            }
            return next
        })
    }, [])

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
                                collapsible={true}
                                isOpen={openPhases.has('origin')}
                                onOpenChange={togglePhase('origin')}
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
                                collapsible={true}
                                isOpen={openPhases.has('billing')}
                                onOpenChange={togglePhase('billing')}
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
                                collapsible={true}
                                isOpen={openPhases.has('treasury')}
                                onOpenChange={togglePhase('treasury')}
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
                                    collapsible={true}
                                    isOpen={openPhases.has('production')}
                                    onOpenChange={togglePhase('production')}
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
                                    collapsible={true}
                                    isOpen={openPhases.has('logistics')}
                                    onOpenChange={togglePhase('logistics')}
                                />
                            </PhaseWrapper>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    )
}
