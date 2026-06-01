"use client"

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from "react"
import { ENTITY_DRAWERS, hasEntityDrawer } from "@/lib/entity-drawers"

interface OpenEntityState {
    label: string
    id: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any
}

interface GlobalModalActionsContextType {
    /**
     * Open the drawer registered in lib/entity-drawers.tsx for the given entity.
     * Throws if no drawer is registered for the label — check `hasEntityDrawer(label)` first
     * or rely on EntityBadge's automatic fallback to navigation.
     */
    openEntity: (label: string, id: number, data?: unknown) => void
    closeEntity: () => void
    /** @deprecated Use `openEntity('production.workorder', id)` */
    openWorkOrder: (id: number) => void
    /** @deprecated Use `openEntity('contacts.contact', id, contact)` */
    openContact: (id: number, contact?: unknown) => void
    /** @deprecated Use `openEntity('treasury.treasuryaccount', id)` */
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

type CombinedContextType = GlobalModalActionsContextType & GlobalModalStateContextType

export function GlobalModalProvider({ children }: { children: ReactNode }) {
    const [openedEntity, setOpenedEntity] = useState<OpenEntityState | null>(null)
    const [sheetStack, setSheetStack] = useState<{id: string, width: number, priority: number, forced: boolean}[]>([])
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1600)

    useEffect(() => {
        if (typeof window === 'undefined') return
        const handleResize = () => setWindowWidth(window.innerWidth)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const closeEntity = useCallback(() => setOpenedEntity(null), [])

    const openEntity = useCallback((label: string, id: number, data?: unknown) => {
        if (!hasEntityDrawer(label)) {
            console.warn(`[GlobalModalProvider] No drawer registered for entity "${label}". Register it in lib/entity-drawers.tsx.`)
            return
        }
        setOpenedEntity({ label, id, data })
    }, [])

    // Backward-compatible specific openers — delegate to the generic one.
    const openWorkOrder = useCallback((id: number) => openEntity('production.workorder', id), [openEntity])
    const openContact = useCallback((id: number, contact?: unknown) => openEntity('contacts.contact', id, contact), [openEntity])
    const openTreasuryAccount = useCallback((id: number | null) => {
        if (id === null) { closeEntity(); return }
        openEntity('treasury.treasuryaccount', id)
    }, [openEntity, closeEntity])

    const registerSheet = useCallback((id: string, fullWidth: number, priority: number, forced: boolean = false) => {
        setSheetStack(prev => {
            const existingIndex = prev.findIndex(s => s.id === id)
            const newStack = [...prev]
            if (existingIndex !== -1) {
                if (prev[existingIndex].width === fullWidth && prev[existingIndex].forced === forced && prev[existingIndex].priority === priority) return prev
                newStack[existingIndex] = { id, width: fullWidth, priority, forced }
            } else {
                newStack.push({ id, width: fullWidth, priority, forced })
            }
            newStack.sort((a, b) => a.priority - b.priority)
            return newStack
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
        if (index === -1 || index === 0) return 0

        let totalOffset = 0
        for (let i = 0; i < index; i++) {
            const sheet = sheetStack[i]
            if (!sheet.forced) {
                totalOffset += sheet.width + 16
            }
        }

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

        const minCanvasWidth = Math.max(400, windowWidth * 0.3)
        const maxTotalWidth = Math.max(0, windowWidth - minCanvasWidth - 96)
        return Math.min(total, maxTotalWidth)
    }, [sheetStack, windowWidth])

    const expandedSheetWidth = totalSheetsWidth

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (expandedSheetWidth > 0) {
            document.body.setAttribute('data-side-panel-width', String(expandedSheetWidth))
        } else {
            document.body.removeAttribute('data-side-panel-width')
        }
    }, [expandedSheetWidth])

    const actionsValue = useMemo(() => ({
        openEntity,
        closeEntity,
        openWorkOrder,
        openContact,
        openTreasuryAccount,
        registerSheet,
        unregisterSheet,
    }), [openEntity, closeEntity, openWorkOrder, openContact, openTreasuryAccount, registerSheet, unregisterSheet])

    const stateValue = useMemo(() => ({
        isSubModalActive: openedEntity !== null,
        getSheetOffset,
        getSheetIndex,
        isSheetCollapsed,
        expandedSheetWidth,
        totalSheetsWidth
    }), [openedEntity, getSheetOffset, getSheetIndex, isSheetCollapsed, expandedSheetWidth, totalSheetsWidth])

    const renderEntityDrawer = () => {
        if (!openedEntity) return null
        const render = ENTITY_DRAWERS[openedEntity.label]
        if (!render) return null
        return render({
            id: openedEntity.id,
            data: openedEntity.data,
            open: true,
            onOpenChange: (open) => { if (!open) setOpenedEntity(null) },
            onSuccess: () => setOpenedEntity(null),
        })
    }

    return (
        <GlobalModalActionsContext.Provider value={actionsValue}>
        <GlobalModalStateContext.Provider value={stateValue}>
            {children}
            {renderEntityDrawer()}
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
