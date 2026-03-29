"use client"

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"

const OrderCommandCenter = dynamic(() => import("@/components/orders/OrderCommandCenter").then(mod => mod.OrderCommandCenter), {
    ssr: false,
    loading: () => <div className="p-4 text-center">Cargando Centro de Comando...</div>
})

const WorkOrderWizard = dynamic(() => import("@/components/production/WorkOrderWizard").then(mod => mod.WorkOrderWizard), {
    ssr: false,
    loading: () => <div className="p-4 text-center">Cargando Gestor de OT...</div>
})

const ContactModal = dynamic(() => import("@/features/contacts/components/ContactModal"), {
    ssr: false,
    loading: () => <div className="p-4 text-center">Cargando Ficha...</div>
})

const TreasuryAccountModal = dynamic(() => import("@/features/treasury/components/TreasuryAccountModal").then(mod => mod.TreasuryAccountModal), {
    ssr: false,
    loading: () => <div className="p-4 text-center">Cargando Cuenta...</div>
})

interface GlobalModalActionsContextType {
    openWorkOrder: (id: number) => void
    openCommandCenter: (id: number | null, type: 'purchase' | 'sale' | 'obligation', invoiceId?: number | null, posSessionId?: number | null, onActionSuccess?: () => void) => void
    closeCommandCenter: () => void
    openContact: (id: number, contact?: any) => void
    openTreasuryAccount: (id: number | null) => void
    registerSheet: (id: string, fullWidth: number, forceCollapse?: boolean) => void
    unregisterSheet: (id: string) => void
}

interface GlobalModalStateContextType {
    isCommandCenterActive: boolean
    isSubModalActive: boolean
    getSheetOffset: (id: string) => number
    getSheetIndex: (id: string) => number
    isSheetCollapsed: (id: string) => boolean
}

const GlobalModalActionsContext = createContext<GlobalModalActionsContextType | undefined>(undefined)
const GlobalModalStateContext = createContext<GlobalModalStateContextType | undefined>(undefined)

// For backwards compatibility
type CombinedContextType = GlobalModalActionsContextType & GlobalModalStateContextType

export function GlobalModalProvider({ children }: { children: ReactNode }) {
    const [woId, setWoId] = useState<number | null>(null)
    const [occId, setOccId] = useState<number | null>(null)
    const [occInvoiceId, setOccInvoiceId] = useState<number | null>(null)
    const [occType, setOccType] = useState<'purchase' | 'sale' | 'obligation'>('sale')
    const [occPosSessionId, setOccPosSessionId] = useState<number | null>(null)
    const [occOnActionSuccess, setOccOnActionSuccess] = useState<(() => void) | undefined>(undefined)
    const [contactId, setContactId] = useState<number | null>(null)
    const [tempContact, setTempContact] = useState<any>(null)
    const [treasuryAccountId, setTreasuryAccountId] = useState<number | null>(null)
    const [sheetStack, setSheetStack] = useState<{id: string, width: number, forced: boolean}[]>([])

    const openWorkOrder = useCallback((id: number) => {
        // Keep occId/occInvoiceId if already open, allowing it to collapse
        setOccId(prev => prev); // Hack to access prev if needed, but not strictly required
        setOccInvoiceId(prev => prev);
        
        setContactId(null)
        setTreasuryAccountId(null)
        setWoId(id)
    }, [])

    const openCommandCenter = useCallback((id: number | null, type: 'purchase' | 'sale' | 'obligation', invoiceId?: number | null, posSessionId?: number | null, onActionSuccess?: () => void) => {
        setWoId(null)
        setContactId(null)
        setOccId(id)
        setOccInvoiceId(invoiceId || null)
        setOccType(type)
        setOccPosSessionId(posSessionId || null)
        setOccOnActionSuccess(() => onActionSuccess)
    }, [])

    const closeCommandCenter = useCallback(() => {
        setOccId(null)
        setOccInvoiceId(null)
        // deliberately leaving OCC type unchanged to keep context for UX-10 fix
    }, [])

    const openContact = useCallback((id: number, contact?: any) => {
        setWoId(null)
        setTreasuryAccountId(null)
        setContactId(id)
        setTempContact(contact || null)
    }, [])

    const openTreasuryAccount = useCallback((id: number | null) => {
        setWoId(null)
        setContactId(null)
        setTreasuryAccountId(id)
    }, [])

    const handleContactSuccess = useCallback(() => {
        setContactId(null)
        setTempContact(null)
    }, [])

    // Tab Management Logic
    const registerSheet = useCallback((id: string, fullWidth: number, forced: boolean = false) => {
        setSheetStack(prev => {
            const existingIndex = prev.findIndex(s => s.id === id)
            if (existingIndex !== -1) {
                // Update width or forced status if changed
                if (prev[existingIndex].width === fullWidth && prev[existingIndex].forced === forced) return prev
                const newStack = [...prev]
                newStack[existingIndex] = { id, width: fullWidth, forced }
                return newStack
            }
            return [...prev, { id, width: fullWidth, forced }]
        })
    }, [])

    const unregisterSheet = useCallback((id: string) => {
        setSheetStack(prev => {
            if (!prev.find(s => s.id === id)) return prev
            return prev.filter(s => s.id !== id)
        })
    }, [])

    const getSheetOffset = useCallback((id: string) => {
        const index = sheetStack.findIndex(s => s.id === id)
        if (index === -1 || index === sheetStack.length - 1) return 0
        
        // The offset for sheet [index] is the sum of visible widths of all sheets from [index + 1] to end
        let totalOffset = 0
        for (let i = index + 1; i < sheetStack.length; i++) {
            const sheet = sheetStack[i]
            // A sheet at index [i] is "collapsed" if it's not the top-most OR if it's forced
            const isColl = i < sheetStack.length - 1 || sheet.forced
            
            // If the foreground sheet is collapsed, it shouldn't push the background sheet horizontally
            // because we use vertical stacking for tabs at the screen edge.
            totalOffset += isColl ? 0 : sheet.width
        }
        return totalOffset
    }, [sheetStack])

    const getSheetIndex = useCallback((id: string) => {
        return sheetStack.findIndex(s => s.id === id)
    }, [sheetStack])

    const isSheetCollapsed = useCallback((id: string) => {
        const index = sheetStack.findIndex(s => s.id === id)
        if (index === -1) return false
        
        // It's collapsed if it's not the top-most OR if it's forced
        return index < sheetStack.length - 1 || sheetStack[index].forced
    }, [sheetStack])

    const actionsValue = useMemo(() => ({
        openWorkOrder,
        openCommandCenter,
        closeCommandCenter,
        openContact,
        openTreasuryAccount,
        registerSheet,
        unregisterSheet,
    }), [openWorkOrder, openCommandCenter, closeCommandCenter, openContact, openTreasuryAccount, registerSheet, unregisterSheet])

    const stateValue = useMemo(() => ({
        isCommandCenterActive: !!(occId || occInvoiceId),
        isSubModalActive: !!(woId || contactId || treasuryAccountId),
        getSheetOffset,
        getSheetIndex,
        isSheetCollapsed
    }), [occId, occInvoiceId, woId, contactId, treasuryAccountId, getSheetOffset, getSheetIndex, isSheetCollapsed])

    return (
        <GlobalModalActionsContext.Provider value={actionsValue}>
        <GlobalModalStateContext.Provider value={stateValue}>
            {children}
            {woId !== null && (
                <WorkOrderWizard
                    orderId={woId}
                    open={woId !== null}
                    onOpenChange={(open) => !open && setWoId(null)}
                />
            )}
            {(occId !== null || occInvoiceId !== null) && (
                <OrderCommandCenter
                    orderId={occId}
                    invoiceId={occInvoiceId}
                    type={occType}
                    open={occId !== null || occInvoiceId !== null}
                    onOpenChange={(open) => { if (!open) { setOccId(null); setOccInvoiceId(null); } }}
                    isExternalModalOpen={!!(woId || contactId || treasuryAccountId)}
                    posSessionId={occPosSessionId}
                    onActionSuccess={occOnActionSuccess}
                />
            )}
            {contactId !== null && (
                <ContactModal
                    open={contactId !== null}
                    onOpenChange={(open) => !open && setContactId(null)}
                    contact={tempContact || { id: contactId }} // Pass ID if full contact not available
                    onSuccess={handleContactSuccess}
                />
            )}
            {treasuryAccountId !== null && (
                <TreasuryAccountModal
                    open={treasuryAccountId !== null}
                    onOpenChange={(open) => !open && setTreasuryAccountId(null)}
                    accountId={treasuryAccountId}
                />
            )}
        </GlobalModalStateContext.Provider>
        </GlobalModalActionsContext.Provider>
    )
}

export function useGlobalModalActions() {
    const context = useContext(GlobalModalActionsContext)
    if (context === undefined) {
        throw new Error("useGlobalModalActions must be used within a GlobalModalProvider")
    }
    return context
}

export function useGlobalModals(): CombinedContextType {
    const actions = useContext(GlobalModalActionsContext)
    const state = useContext(GlobalModalStateContext)
    if (actions === undefined || state === undefined) {
        throw new Error("useGlobalModals must be used within a GlobalModalProvider")
    }
    return { ...actions, ...state }
}
