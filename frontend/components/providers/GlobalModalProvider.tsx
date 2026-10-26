"use client"

import React, { createContext, useContext, useState, type ReactNode, useCallback, useMemo, useEffect } from "react"
import { ENTITY_DRAWERS, hasEntityDrawer } from "@/lib/entity-drawers"
import { formatEntityDisplay, getEntityMetadata } from "@/lib/entity-registry"
import { ErrorBoundary, EntityNavigationContext, UnsavedChangesDialog } from "@/components/shared"
import { EntityViewBridge } from "./EntityViewBridge"
import { DirtyRegistry, type DirtyEntry } from "./dirtyGuardRegistry"

interface OpenEntityState {
    label: string
    id: number
    data?: unknown
    segmenter?: React.ReactNode
    /** Texto para "Volver a …" cuando se abra otro documento encima (p. ej. display_id). */
    display?: string
}

export interface OpenEntityOptions {
    display?: string
}

interface PendingLeave {
    names: string[]
    action: () => void
    onCancel?: () => void
}

/** Último estado renderizado, legible desde handlers sin depender del cierre. Se escribe solo en efectos. */
class LiveMirror {
    stack: OpenEntityState[] = []
    pending: PendingLeave | null = null
    sync(next: { stack?: OpenEntityState[]; pending?: PendingLeave | null }) {
        if (next.stack !== undefined) this.stack = next.stack
        if (next.pending !== undefined) this.pending = next.pending
    }
}

/** Máximo de documentos encadenados con "volver" (ADR-0080, GAP-11). */
const MAX_ENTITY_STACK = 5


function entityBackLabel(entity: OpenEntityState): string {
    if (entity.display) return entity.display
    const data = (entity.data && typeof entity.data === 'object' ? entity.data : {}) as Record<string, unknown>
    const display = formatEntityDisplay(entity.label, { id: entity.id, ...data })
    return display || `${getEntityMetadata(entity.label)?.title ?? 'documento'} #${entity.id}`
}

interface GlobalModalActionsContextType {
    /**
     * Open the drawer registered in lib/entity-drawers.tsx for the given entity.
     * Throws if no drawer is registered for the label — check `hasEntityDrawer(label)` first
     * or rely on EntityBadge's automatic fallback to navigation.
     */
    openEntity: (label: string, id: number, data?: unknown, segmenter?: React.ReactNode, options?: OpenEntityOptions) => void
    /** Cierra todos los documentos abiertos con openEntity. */
    closeEntity: () => void
    /** Vuelve al documento anterior de la pila (no-op si no hay). */
    goBackEntity: () => void
    /**
     * Fija el texto con que se nombra un documento abierto en la pila ("Volver a OV-000183").
     * Lo llama la ficha cuando carga su número (ADR-0083). No-op si no está en la pila.
     */
    setEntityDisplay: (label: string, id: number, display: string) => void
    /** Registra un formulario en la guarda de cambios sin guardar. Devuelve la función que lo retira. */
    registerDirty: (entry: DirtyEntry) => () => void
    /**
     * Ejecuta `action` ya, o tras la decisión del usuario si hay formularios sucios
     * (Guardar y continuar / Descartar y continuar; "Seguir editando" la cancela).
     */
    runGuarded: (action: () => void, onCancel?: () => void) => void
    /** Versión con promesa de `runGuarded`: resuelve `true` si se puede continuar. */
    requestLeave: () => Promise<boolean>
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
    // ADR-0080 (GAP-11): pila de documentos; se muestra el superior y se puede volver.
    const [entityStack, setEntityStack] = useState<OpenEntityState[]>([])
    const openedEntity = entityStack.length > 0 ? entityStack[entityStack.length - 1] : null
    const [sheetStack, setSheetStack] = useState<{id: string, width: number, priority: number, forced: boolean}[]>([])
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1600)

    useEffect(() => {
        if (typeof window === 'undefined') return
        const handleResize = () => setWindowWidth(window.innerWidth)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Espejo mutable del último estado para los handlers (no son refs de render: se escriben solo en efectos).
    const [live] = useState(() => new LiveMirror())
    useEffect(() => { live.sync({ stack: entityStack }) }, [live, entityStack])

    // Guarda de cambios sin guardar: un formulario sucio bloquea abrir, volver y cerrar hasta decidir.
    const [registry] = useState(() => new DirtyRegistry())
    const [pendingLeave, setPendingLeave] = useState<PendingLeave | null>(null)
    const [savingLeave, setSavingLeave] = useState(false)

    useEffect(() => { live.sync({ pending: pendingLeave }) }, [live, pendingLeave])

    const runGuarded = useCallback((action: () => void, onCancel?: () => void) => {
        const dirty = registry.dirtyEntries()
        if (dirty.length === 0) { action(); return }
        // Ya hay una decisión en curso: la nueva petición se cancela, no se encola.
        if (live.pending) { onCancel?.(); return }
        const top = live.stack[live.stack.length - 1]
        const fallback = top ? entityBackLabel(top) : "Este formulario"
        setPendingLeave({ names: dirty.map(e => e.name ?? fallback), action, onCancel })
    }, [registry, live])

    const requestLeave = useCallback(
        () => new Promise<boolean>(resolve => runGuarded(() => resolve(true), () => resolve(false))),
        [runGuarded],
    )

    const keepEditing = useCallback(() => {
        live.pending?.onCancel?.()
        setPendingLeave(null)
    }, [live])

    const closeEntity = useCallback(() => setEntityStack([]), [])

    const goBackEntity = useCallback(() => runGuarded(() => setEntityStack(prev => prev.slice(0, -1))), [runGuarded])

    const resolveLeave = useCallback(async (mode: "save" | "discard") => {
        const pending = pendingLeave
        if (!pending) return
        const dirty = registry.dirtyEntries()
        if (mode === "save") {
            setSavingLeave(true)
            let ok = true
            for (const entry of dirty) {
                if (!(await entry.save())) { ok = false; break }
            }
            setSavingLeave(false)
            setPendingLeave(null)
            if (ok) pending.action()
            else pending.onCancel?.()
            return
        }
        dirty.forEach(entry => entry.discard())
        setPendingLeave(null)
        pending.action()
    }, [pendingLeave, registry])

    useEffect(() => {
        if (typeof window === "undefined") return
        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!registry.hasDirty()) return
            event.preventDefault()
            event.returnValue = ""
        }
        window.addEventListener("beforeunload", onBeforeUnload)
        return () => window.removeEventListener("beforeunload", onBeforeUnload)
    }, [registry])

    const setEntityDisplay = useCallback((label: string, id: number, display: string) => {
        setEntityStack(prev => prev.some(e => e.label === label && e.id === id && e.display !== display)
            ? prev.map(e => (e.label === label && e.id === id ? { ...e, display } : e))
            : prev)
    }, [])


    const openEntity = useCallback((label: string, id: number, data?: unknown, segmenter?: React.ReactNode, options?: OpenEntityOptions) => {
        if (!hasEntityDrawer(label)) {
            console.warn(`[GlobalModalProvider] No drawer registered for entity "${label}". Register it in lib/entity-drawers.tsx.`)
            return
        }
        const entry: OpenEntityState = { label, id, data, segmenter, display: options?.display }
        const top = live.stack[live.stack.length - 1]
        if (top && top.label === label && top.id === id) return
        runGuarded(() => setEntityStack(prev => {
            const current = prev[prev.length - 1]
            if (current && current.label === label && current.id === id) return prev
            // Abrir desde un documento ya abierto apila; si no hay ninguno, empieza la pila.
            return [...prev, entry].slice(-MAX_ENTITY_STACK)
        }))
    }, [runGuarded, live])

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
                totalOffset += sheet.width
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
                total += sheet.width
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
        goBackEntity,
        setEntityDisplay,
        registerDirty: (entry: DirtyEntry) => registry.register(entry),
        runGuarded,
        requestLeave,
        registerSheet,
        unregisterSheet,
    }), [openEntity, closeEntity, goBackEntity, setEntityDisplay, registry, runGuarded, requestLeave, registerSheet, unregisterSheet])

    const stateValue = useMemo(() => ({
        isSubModalActive: openedEntity !== null,
        getSheetOffset,
        getSheetIndex,
        isSheetCollapsed,
        expandedSheetWidth,
        totalSheetsWidth
    }), [openedEntity, getSheetOffset, getSheetIndex, isSheetCollapsed, expandedSheetWidth, totalSheetsWidth])

    const handleDrawerOpenChange = useCallback((open: boolean) => {
        if (!open) runGuarded(closeEntity)
    }, [runGuarded, closeEntity])

    const renderEntityDrawer = () => {
        if (!openedEntity) return null
        const render = ENTITY_DRAWERS[openedEntity.label]
        if (!render) return null
        const previous = entityStack.length > 1 ? entityStack[entityStack.length - 2] : null
        const drawer = render({
            id: openedEntity.id,
            data: openedEntity.data,
            open: true,
            onOpenChange: handleDrawerOpenChange,
            onSuccess: closeEntity,
            segmenter: openedEntity.segmenter,
        })
        return (
            // key: cada documento de la pila monta su drawer desde cero
            <EntityNavigationContext.Provider
                key={`${openedEntity.label}:${openedEntity.id}`}
                value={previous ? { backLabel: entityBackLabel(previous), goBack: goBackEntity } : null}
            >
                {drawer}
            </EntityNavigationContext.Provider>
        )
    }

    return (
        <GlobalModalActionsContext.Provider value={actionsValue}>
        <GlobalModalStateContext.Provider value={stateValue}>
        <EntityViewBridge openEntity={openEntity}>
            {children}
            <ErrorBoundary variant="inline">
                {renderEntityDrawer()}
            </ErrorBoundary>
            <UnsavedChangesDialog
                open={pendingLeave !== null}
                names={pendingLeave?.names ?? []}
                saving={savingLeave}
                onSave={() => { void resolveLeave("save") }}
                onDiscard={() => { void resolveLeave("discard") }}
                onKeepEditing={keepEditing}
            />
        </EntityViewBridge>
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

/** Como `useGlobalModalActions` pero devuelve `undefined` fuera del provider (hooks compartidos, stories). */
export function useOptionalGlobalModalActions() {
    return useContext(GlobalModalActionsContext)
}

export function useGlobalModals(): CombinedContextType {
    const actions = useContext(GlobalModalActionsContext)
    const state = useContext(GlobalModalStateContext)
    if (actions === undefined || state === undefined) {
        throw new Error("useGlobalModals must be used within a GlobalModalProvider")
    }
    return { ...actions, ...state }
}
