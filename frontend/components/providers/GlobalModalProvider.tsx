"use client"

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from "react"
import dynamic from "next/dynamic"
import { SkeletonShell } from "@/components/shared"

const WorkOrderWizard = dynamic(() => import("@/features/production").then(mod => mod.WorkOrderWizard), {
     ssr: false,
     loading: () => <SkeletonShell isLoading={true} ariaLabel="Cargando asistente de orden de trabajo" />
 })

const ContactModal = dynamic(() => import("@/features/contacts/components/ContactModal"), {
     ssr: false,
     loading: () => <SkeletonShell isLoading={true} ariaLabel="Cargando modal de contacto" />
 })

const TreasuryAccountModal = dynamic(() => import("@/features/treasury/components/TreasuryAccountModal").then(mod => mod.TreasuryAccountModal), {
     ssr: false,
     loading: () => <SkeletonShell isLoading={true} ariaLabel="Cargando modal de cuenta de tesorería" />
 })

interface GlobalModalActionsContextType {
    openWorkOrder: (id: number) => void
    openContact: (id: number, contact?: any) => void
    openTreasuryAccount: (id: number | null) => void
    registerSheet: (id: string, fullWidth: number, priority: number, forceCollapse?: boolean) => void
    unregisterSheet: (id: string) => void
}

interface GlobalModalStateContextType {
    isSubModalActive: boolean
    getSheetOffset: (id: string) => number
    getSheetIndex: (id: string) => number
    isSheetCollapsed: (id: string) => boolean
    expandedSheetWidth: number
    totalSheetsWidth: number
}

const GlobalModalActionsContext = createContext<GlobalModalActionsContextType | undefined>(undefined)
const GlobalModalStateContext = createContext<GlobalModalStateContextType | undefined>(undefined)

// For backwards compatibility
type CombinedContextType = GlobalModalActionsContextType & GlobalModalStateContextType

export function GlobalModalProvider({ children }: { children: ReactNode }) {
    const [woId, setWoId] = useState<number | null>(null)
    const [contactId, setContactId] = useState<number | null>(null)
    const [tempContact, setTempContact] = useState<any>(null)
    const [treasuryAccount, setTreasuryAccount] = useState<{isOpen: boolean, id: number | null}>({ isOpen: false, id: null })
    const [sheetStack, setSheetStack] = useState<{id: string, width: number, priority: number, forced: boolean}[]>([])
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1600)

    useEffect(() => {
        if (typeof window === 'undefined') return
        const handleResize = () => setWindowWidth(window.innerWidth)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const openWorkOrder = useCallback((id: number) => {
        setContactId(null)
        setTreasuryAccount({ isOpen: false, id: null })
        setWoId(id)
    }, [])

    const openContact = useCallback((id: number, contact?: any) => {
        setWoId(null)
        setTreasuryAccount({ isOpen: false, id: null })
        setContactId(id)
        setTempContact(contact || null)
    }, [])

    const openTreasuryAccount = useCallback((id: number | null) => {
        setWoId(null)
        setContactId(null)
        setTreasuryAccount({ isOpen: true, id })
    }, [])

    const handleContactSuccess = useCallback(() => {
        setContactId(null)
        setTempContact(null)
    }, [])

    const handleWorkOrderSuccess = useCallback(() => {
        setWoId(null)
    }, [])

    // Tab Management Logic
    const registerSheet = useCallback((id: string, fullWidth: number, priority: number, forced: boolean = false) => {
        console.log("registerSheet called:", { id, fullWidth, priority, forced })
        setSheetStack(prev => {
            const existingIndex = prev.findIndex(s => s.id === id)
            let newStack = [...prev]
            if (existingIndex !== -1) {
                if (prev[existingIndex].width === fullWidth && prev[existingIndex].forced === forced && prev[existingIndex].priority === priority) return prev
                newStack[existingIndex] = { id, width: fullWidth, priority, forced }
            } else {
                newStack.push({ id, width: fullWidth, priority, forced })
            }
            newStack.sort((a, b) => a.priority - b.priority)
            console.log("Updated sheetStack after register:", newStack)
            return newStack
        })
    }, [])

    const unregisterSheet = useCallback((id: string) => {
        console.log("unregisterSheet called:", id)
        setSheetStack(prev => {
            if (!prev.find(s => s.id === id)) return prev
            const newStack = prev.filter(s => s.id !== id)
            console.log("Updated sheetStack after unregister:", newStack)
            return newStack
        })
    }, [])

    const getSheetOffset = useCallback((id: string) => {
        const index = sheetStack.findIndex(s => s.id === id)
        if (index === -1 || index === 0) return 0
        
        let totalOffset = 0
        for (let i = 0; i < index; i++) {
            const sheet = sheetStack[i]
            if (!sheet.forced) {
                totalOffset += sheet.width + 16
            }
        }
        
        // Prevent leftmost sheets from going off-screen. We leave a 96px left margin (for layout sidebar + gaps)
        const currentSheet = sheetStack[index]
        const maxOffset = Math.max(0, windowWidth - currentSheet.width - 96)
        return Math.min(totalOffset, maxOffset)
    }, [sheetStack, windowWidth])

    const getSheetIndex = useCallback((id: string) => {
        return sheetStack.findIndex(s => s.id === id)
    }, [sheetStack])

    const isSheetCollapsed = useCallback((id: string) => {
        const index = sheetStack.findIndex(s => s.id === id)
        if (index === -1) return false
        return !!sheetStack[index].forced
    }, [sheetStack])

    const totalSheetsWidth = useMemo(() => {
        let total = 0
        sheetStack.forEach((sheet) => {
            if (!sheet.forced) {
                total += sheet.width + 16
            }
        })
        
        // Capping total width to guarantee the main content canvas always has at least 400px (or 30% of viewport) width
        const minCanvasWidth = Math.max(400, windowWidth * 0.3)
        const maxTotalWidth = Math.max(0, windowWidth - minCanvasWidth - 96)
        return Math.min(total, maxTotalWidth)
    }, [sheetStack, windowWidth])

    const expandedSheetWidth = totalSheetsWidth

    // Centrally synchronize the data-side-panel-width attribute on document.body
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (expandedSheetWidth > 0) {
            document.body.setAttribute('data-side-panel-width', String(expandedSheetWidth))
        } else {
            document.body.removeAttribute('data-side-panel-width')
        }
    }, [expandedSheetWidth])

    const actionsValue = useMemo(() => ({
        openWorkOrder,
        openContact,
        openTreasuryAccount,
        registerSheet,
        unregisterSheet,
    }), [openWorkOrder, openContact, openTreasuryAccount, registerSheet, unregisterSheet])

    const stateValue = useMemo(() => ({
        isSubModalActive: !!(woId || contactId || treasuryAccount.isOpen),
        getSheetOffset,
        getSheetIndex,
        isSheetCollapsed,
        expandedSheetWidth,
        totalSheetsWidth
    }), [woId, contactId, treasuryAccount.isOpen, getSheetOffset, getSheetIndex, isSheetCollapsed, expandedSheetWidth, totalSheetsWidth])

    return (
        <GlobalModalActionsContext.Provider value={actionsValue}>
        <GlobalModalStateContext.Provider value={stateValue}>
            {children}
            {woId !== null && (
                <WorkOrderWizard
                    mode={{ kind: 'manage', orderId: woId }}
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
            {treasuryAccount.isOpen && (
                <TreasuryAccountModal
                    open={treasuryAccount.isOpen}
                    onOpenChange={(open) => !open && setTreasuryAccount({ isOpen: false, id: null })}
                    accountId={treasuryAccount.id}
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
