"use client"

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"

const WorkOrderWizard = dynamic(() => import("@/features/production/components/WorkOrderWizard").then(mod => mod.WorkOrderWizard), {
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
    openContact: (id: number, contact?: any) => void
    openTreasuryAccount: (id: number | null) => void
    registerSheet: (id: string, fullWidth: number, forceCollapse?: boolean) => void
    unregisterSheet: (id: string) => void
}

interface GlobalModalStateContextType {
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
    const [contactId, setContactId] = useState<number | null>(null)
    const [tempContact, setTempContact] = useState<any>(null)
    const [treasuryAccountId, setTreasuryAccountId] = useState<number | null>(null)
    const [sheetStack, setSheetStack] = useState<{id: string, width: number, forced: boolean}[]>([])

    const openWorkOrder = useCallback((id: number) => {
        setContactId(null)
        setTreasuryAccountId(null)
        setWoId(id)
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
        
        let totalOffset = 0
        for (let i = index + 1; i < sheetStack.length; i++) {
            const sheet = sheetStack[i]
            const isColl = i < sheetStack.length - 1 || sheet.forced
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
        return index < sheetStack.length - 1 || sheetStack[index].forced
    }, [sheetStack])

    const actionsValue = useMemo(() => ({
        openWorkOrder,
        openContact,
        openTreasuryAccount,
        registerSheet,
        unregisterSheet,
    }), [openWorkOrder, openContact, openTreasuryAccount, registerSheet, unregisterSheet])

    const stateValue = useMemo(() => ({
        isSubModalActive: !!(woId || contactId || treasuryAccountId),
        getSheetOffset,
        getSheetIndex,
        isSheetCollapsed
    }), [woId, contactId, treasuryAccountId, getSheetOffset, getSheetIndex, isSheetCollapsed])

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
            {contactId !== null && (
                <ContactModal
                    open={contactId !== null}
                    onOpenChange={(open) => !open && setContactId(null)}
                    contact={tempContact || { id: contactId }}
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
