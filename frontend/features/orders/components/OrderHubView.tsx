"use client"

import {useMemo, useState, useEffect, useCallback} from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { OriginPhase } from "./phases/OriginPhase"
import { ProductionPhase } from "./phases/ProductionPhase"
import { LogisticsPhase } from "./phases/LogisticsPhase"
import { BillingPhase } from "./phases/BillingPhase"
import { TreasuryPhase } from "./phases/TreasuryPhase"
import { getHubStatuses } from '@/features/orders/utils/status'
import { type Order, type Payment } from "../types"
import type { LucideIcon } from "lucide-react"

export interface OrderHubData {
    order: Order | null
    activeInvoice: Order | null
    activeDoc: Order
    userPermissions: string[]
    isNoteMode: boolean
    noteStatuses: Record<string, string | boolean | number>
    showProduction: boolean
    showLogistics: boolean
    invoices: Order[]
    billingIsComplete: boolean
    payments: Payment[]
    logisticsProgress: number
    fetchOrderDetails: () => void
    globalStatus: { label: string; status: string; icon: LucideIcon }
}

interface OrderHubIntegratedProps {
    data: OrderHubData
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
    showAnimations = true
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
        payments,
    } = data

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
            const hubStatuses = getHubStatuses(activeDoc as unknown as Parameters<typeof getHubStatuses>[0])
            if (hubStatuses.origin !== 'success') openSet.add('origin')
            if (hubStatuses.billing !== 'success') openSet.add('billing')
            if (hubStatuses.treasury !== 'success') openSet.add('treasury')
            if (showProduction && hubStatuses.production !== 'success' && hubStatuses.production !== 'not_applicable') openSet.add('production')
            if (showLogistics && hubStatuses.logistics !== 'success' && hubStatuses.logistics !== 'not_applicable') openSet.add('logistics')
        }

        return openSet
    }, [activeDoc?.id]) // Only recalculate when the document changes, not on every render

    const [openPhases, setOpenPhases] = useState<Set<string>>(initialOpenPhases)

    // Reset when document changes
    useEffect(() => {
        requestAnimationFrame(() => setOpenPhases(initialOpenPhases))
    }, [initialOpenPhases])

    const togglePhase = useCallback((phaseId: string) => (isOpen: boolean) => {
        setOpenPhases(prev => {
            if (isOpen) {
                return new Set([phaseId])
            }
            const next = new Set(prev)
            next.delete(phaseId)
            return next
        })
    }, [])

    if (!activeDoc) return null

    return (
        <TooltipProvider delayDuration={150}>
            <div className="flex flex-col w-full min-h-full pb-8">
                <div className="flex flex-col gap-2.5 w-full">
                    {/* 1. Origen */}
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

                    {/* 2. Facturación */}
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
                        isSale={type === 'sale'}
                    />

                    {/* 3. Tesorería */}
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
                        isSale={type === 'sale'}
                    />

                    {/* 4. Producción */}
                    {showProduction && (
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
                            isSale={type === 'sale'}
                        />
                    )}

                    {/* 5. Logística / Cumplimiento */}
                    {showLogistics && (
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
                    )}
                </div>
            </div>
        </TooltipProvider>
    )
}
