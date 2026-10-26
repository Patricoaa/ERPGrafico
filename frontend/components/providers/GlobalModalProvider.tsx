"use client"

import React, { createContext, useContext, useState, type ReactNode, useCallback, useMemo, useEffect } from "react"
import { Calculator, type LucideIcon } from "lucide-react"
import dynamic from "next/dynamic"
import { ENTITY_DRAWERS, hasEntityDrawer } from "@/lib/entity-drawers"
import { formatEntityDisplay, getEntityMetadata } from "@/lib/entity-registry"
import { usePathname, useRouter } from "next/navigation"
import { getModuleIdFromPath, getEntityModule } from "@/lib/module-registry"
import { ErrorBoundary, UnsavedChangesDialog } from "@/components/shared"
import { EntityViewBridge } from "./EntityViewBridge"
import { DirtyRegistry, type DirtyEntry } from "./dirtyGuardRegistry"

interface OpenEntityState {
    label: string
    id: number
    data?: unknown
    segmenter?: React.ReactNode
    /** Texto de la pestaña (p. ej. display_id). */
    display?: string
}

/** Herramientas que abren como pestaña propia (ADR-0101). */
export type ToolTabId = "cost-calculator"

const TOOL_TABS: Record<ToolTabId, { title: string; icon: LucideIcon }> = {
    "cost-calculator": { title: "Calculadora de Costos", icon: Calculator },
}

/** Pestaña efímera del espacio de trabajo: un documento (`entity`) o una herramienta (`tool`). */
type WorkspaceTab =
    | ({ type: "entity" } & OpenEntityState)
    | { type: "tool"; tool: ToolTabId }

const entityKey = (label: string, id: number) => `${label}:${id}`
const toolKey = (tool: ToolTabId) => `tool:${tool}`
const tabKey = (tab: WorkspaceTab) => (tab.type === "entity" ? entityKey(tab.label, tab.id) : toolKey(tab.tool))

/** Vista de una pestaña para la barra (ADR-0101). */
export interface WorkspaceTabView {
    key: string
    kind: "entity" | "tool"
    title: string
    /** Ayuda al pasar el cursor: tipo y módulo del documento. */
    description: string
    icon: LucideIcon | null
    active: boolean
}

const MAX_TABS = 8

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
    tabs: WorkspaceTab[] = []
    activeKey: string | null = null
    pending: PendingLeave | null = null
    sync(next: { tabs?: WorkspaceTab[]; activeKey?: string | null; pending?: PendingLeave | null }) {
        if (next.tabs !== undefined) this.tabs = next.tabs
        if (next.activeKey !== undefined) this.activeKey = next.activeKey
        if (next.pending !== undefined) this.pending = next.pending
    }
}

const CostCalculatorDrawer = dynamic(
    () => import("@/components/tools/CostCalculatorDrawer").then(m => ({ default: m.CostCalculatorDrawer })),
    { ssr: false },
)

function entityTabLabel(entity: OpenEntityState): string {
    if (entity.display) return entity.display
    const data = (entity.data && typeof entity.data === 'object' ? entity.data : {}) as Record<string, unknown>
    const display = formatEntityDisplay(entity.label, { id: entity.id, ...data })
    return display || `${getEntityMetadata(entity.label)?.title ?? 'documento'} #${entity.id}`
}

function tabView(tab: WorkspaceTab, active: boolean, pageModuleId: string | undefined): WorkspaceTabView {
    if (tab.type === "tool") {
        return { key: toolKey(tab.tool), kind: "tool", title: TOOL_TABS[tab.tool].title, description: TOOL_TABS[tab.tool].title, icon: TOOL_TABS[tab.tool].icon, active }
    }
    const metadata = getEntityMetadata(tab.label)
    const documentModule = getEntityModule(tab.label)
    const title = entityTabLabel(tab)
    // Si el documento vive en otro módulo que la página, la pestaña lo dice (el riel no sigue al drill-down).
    const moduleNote = documentModule && documentModule.id !== pageModuleId ? ` · ${documentModule.label}` : ""
    return {
        key: entityKey(tab.label, tab.id),
        kind: "entity",
        title,
        description: `${metadata?.title ?? "Documento"} ${title}${moduleNote}`,
        icon: metadata?.icon ?? null,
        active,
    }
}

interface GlobalModalActionsContextType {
    /**
     * Abre el documento registrado en lib/entity-drawers.tsx como pestaña (o activa la pestaña si ya
     * está abierta). Avisa en consola si no hay drawer registrado.
     */
    openEntity: (label: string, id: number, data?: unknown, segmenter?: React.ReactNode, options?: OpenEntityOptions) => void
    /** Cierra todas las pestañas (documentos y herramientas). */
    closeEntity: () => void
    /**
     * Abre `label:id` como pestaña de la selección de una lista (`?selected`) sin pasar por la guarda:
     * quien la llama (`useDocumentSheetRoute`) ya la aplicó.
     */
    openRootEntity: (label: string, id: number) => void
    /** Cierra la pestaña de `label:id` sin guarda (la selección de la lista cambió). */
    closeEntityByRef: (label: string, id: number) => void
    /** Abre una herramienta (p. ej. la calculadora) como pestaña. */
    openTool: (tool: ToolTabId) => void
    /** Activa una pestaña (con guarda de cambios sin guardar). */
    activateTab: (key: string) => void
    /** Cierra una pestaña (con guarda de cambios sin guardar). */
    closeTab: (key: string) => void
    /**
     * Fija el texto con que se nombra un documento en su pestaña ("OV-000183").
     * Lo llama la ficha cuando carga su número (ADR-0083). No-op si no está abierta.
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
    /** Hay al menos un documento abierto en pestañas. */
    isSubModalActive: boolean
    /** Pestañas efímeras de la página, en orden de apertura (ADR-0101). */
    tabs: WorkspaceTabView[]
    isEntityOpen: (label: string, id: number) => boolean
    getSheetOffset: (id: string) => number
    getSheetIndex: (id: string) => number
    isSheetCollapsed: (id: string) => boolean
    expandedSheetWidth: number
    totalSheetsWidth: number
}

const GlobalModalActionsContext = createContext<GlobalModalActionsContextType | undefined>(undefined)
const GlobalModalStateContext = createContext<GlobalModalStateContextType | undefined>(undefined)

type CombinedContextType = GlobalModalActionsContextType & GlobalModalStateContextType

/** Pestaña que queda activa al cerrar la `index`: la vecina de la derecha o, si no hay, la de la izquierda. */
function neighbourKey(tabs: WorkspaceTab[], index: number): string | null {
    const next = tabs[index + 1] ?? tabs[index - 1]
    return next ? tabKey(next) : null
}

export function GlobalModalProvider({ children }: { children: ReactNode }) {
    // ADR-0101: pestañas efímeras por página (documentos y herramientas); solo la activa se monta.
    const [tabs, setTabs] = useState<WorkspaceTab[]>([])
    const [activeKey, setActiveKey] = useState<string | null>(null)
    const activeTab = tabs.find(tab => tabKey(tab) === activeKey) ?? null
    const pathname = usePathname()
    const router = useRouter()
    const pageModuleId = getModuleIdFromPath(pathname)
    const [sheetStack, setSheetStack] = useState<{id: string, width: number, priority: number, forced: boolean}[]>([])
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1600)

    // Las pestañas son efímeras por página: al cambiar de ruta se cierran todas.
    const [trackedPath, setTrackedPath] = useState(pathname)
    if (trackedPath !== pathname) {
        setTrackedPath(pathname)
        setTabs([])
        setActiveKey(null)
    }

    useEffect(() => {
        if (typeof window === 'undefined') return
        const handleResize = () => setWindowWidth(window.innerWidth)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // Espejo mutable del último estado para los handlers (no son refs de render: se escriben solo en efectos).
    const [live] = useState(() => new LiveMirror())
    useEffect(() => { live.sync({ tabs, activeKey }) }, [live, tabs, activeKey])

    // Guarda de cambios sin guardar: un formulario sucio bloquea abrir, cambiar de pestaña y cerrar hasta decidir.
    const [registry] = useState(() => new DirtyRegistry())
    const [pendingLeave, setPendingLeave] = useState<PendingLeave | null>(null)
    const [savingLeave, setSavingLeave] = useState(false)

    useEffect(() => { live.sync({ pending: pendingLeave }) }, [live, pendingLeave])

    const runGuarded = useCallback((action: () => void, onCancel?: () => void) => {
        const dirty = registry.dirtyEntries()
        if (dirty.length === 0) { action(); return }
        // Ya hay una decisión en curso: la nueva petición se cancela, no se encola.
        if (live.pending) { onCancel?.(); return }
        const current = live.tabs.find(tab => tabKey(tab) === live.activeKey)
        const fallback = current?.type === "entity" ? entityTabLabel(current) : "Este formulario"
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

    const closeEntity = useCallback(() => { setTabs([]); setActiveKey(null) }, [])

    /** Quita una pestaña y activa la vecina si era la activa. */
    const removeTab = useCallback((key: string) => {
        const current = live.tabs
        const index = current.findIndex(tab => tabKey(tab) === key)
        if (index === -1) return
        if (live.activeKey === key) setActiveKey(neighbourKey(current, index))
        setTabs(prev => prev.filter(tab => tabKey(tab) !== key))
    }, [live])

    const closeTab = useCallback((key: string) => runGuarded(() => removeTab(key)), [runGuarded, removeTab])

    const activateTab = useCallback((key: string) => {
        if (key === live.activeKey) return
        runGuarded(() => setActiveKey(key))
    }, [runGuarded, live])

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

    // Salir de la página cierra las pestañas: un enlace interno con cambios sin guardar pasa por la guarda.
    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            if (!registry.hasDirty()) return
            const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
            if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return
            const url = new URL(anchor.href, window.location.href)
            if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
            event.preventDefault()
            event.stopPropagation()
            runGuarded(() => router.push(url.pathname + url.search + url.hash))
        }
        document.addEventListener("click", onClick, true)
        return () => document.removeEventListener("click", onClick, true)
    }, [registry, runGuarded, router])

    const setEntityDisplay = useCallback((label: string, id: number, display: string) => {
        setTabs(prev => prev.some(t => t.type === "entity" && t.label === label && t.id === id && t.display !== display)
            ? prev.map(t => (t.type === "entity" && t.label === label && t.id === id ? { ...t, display } : t))
            : prev)
    }, [])

    /** Añade la pestaña (o solo la activa si ya existe). Con el tope, descarta la más antigua que no sea la nueva. */
    const addTab = useCallback((tab: WorkspaceTab) => {
        const key = tabKey(tab)
        setTabs(prev => {
            if (prev.some(t => tabKey(t) === key)) return prev
            const next = [...prev, tab]
            return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next
        })
        setActiveKey(key)
    }, [])

    const openEntity = useCallback((label: string, id: number, data?: unknown, segmenter?: React.ReactNode, options?: OpenEntityOptions) => {
        if (!hasEntityDrawer(label)) {
            console.warn(`[GlobalModalProvider] No drawer registered for entity "${label}". Register it in lib/entity-drawers.tsx.`)
            return
        }
        const key = entityKey(label, id)
        if (live.activeKey === key) return
        runGuarded(() => addTab({ type: "entity", label, id, data, segmenter, display: options?.display }))
    }, [runGuarded, live, addTab])

    const openRootEntity = useCallback((label: string, id: number) => {
        if (!hasEntityDrawer(label)) return
        addTab({ type: "entity", label, id })
    }, [addTab])

    const closeEntityByRef = useCallback((label: string, id: number) => removeTab(entityKey(label, id)), [removeTab])

    const openTool = useCallback((tool: ToolTabId) => {
        if (live.activeKey === toolKey(tool)) return
        runGuarded(() => addTab({ type: "tool", tool }))
    }, [runGuarded, live, addTab])

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
        openRootEntity,
        closeEntityByRef,
        openTool,
        activateTab,
        closeTab,
        setEntityDisplay,
        registerDirty: (entry: DirtyEntry) => registry.register(entry),
        runGuarded,
        requestLeave,
        registerSheet,
        unregisterSheet,
    }), [openEntity, closeEntity, openRootEntity, closeEntityByRef, openTool, activateTab, closeTab, setEntityDisplay, registry, runGuarded, requestLeave, registerSheet, unregisterSheet])

    const tabViews = useMemo(
        () => tabs.map(tab => tabView(tab, tabKey(tab) === activeKey, pageModuleId)),
        [tabs, activeKey, pageModuleId],
    )

    const isEntityOpen = useCallback(
        (label: string, id: number) => tabs.some(tab => tab.type === "entity" && tab.label === label && tab.id === id),
        [tabs],
    )

    const hasEntityTab = tabs.some(tab => tab.type === "entity")

    const stateValue = useMemo(() => ({
        isSubModalActive: hasEntityTab,
        tabs: tabViews,
        isEntityOpen,
        getSheetOffset,
        getSheetIndex,
        isSheetCollapsed,
        expandedSheetWidth,
        totalSheetsWidth
    }), [hasEntityTab, tabViews, isEntityOpen, getSheetOffset, getSheetIndex, isSheetCollapsed, expandedSheetWidth, totalSheetsWidth])

    // X / Escape / clic fuera cierran la pestaña activa (con guarda).
    const handleDrawerOpenChange = useCallback((open: boolean) => {
        if (!open && live.activeKey) closeTab(live.activeKey)
    }, [closeTab, live])

    // Tras guardar, la pestaña ya cumplió su función: se cierra sin guarda.
    const closeActiveTab = useCallback(() => { if (live.activeKey) removeTab(live.activeKey) }, [removeTab, live])

    const renderActiveTab = () => {
        if (!activeTab) return null
        if (activeTab.type === "entity") {
            const render = ENTITY_DRAWERS[activeTab.label]
            if (!render) return null
            return (
                // key: cada documento monta su drawer desde cero al activarse
                <React.Fragment key={entityKey(activeTab.label, activeTab.id)}>
                    {render({
                        id: activeTab.id,
                        data: activeTab.data,
                        open: true,
                        onOpenChange: handleDrawerOpenChange,
                        onSuccess: closeActiveTab,
                        segmenter: activeTab.segmenter,
                    })}
                </React.Fragment>
            )
        }
        return null
    }

    // Las herramientas viven mientras su pestaña exista: así conservan su estado al cambiar de pestaña.
    const hasCalculatorTab = tabs.some(tab => tab.type === "tool" && tab.tool === "cost-calculator")

    return (
        <GlobalModalActionsContext.Provider value={actionsValue}>
        <GlobalModalStateContext.Provider value={stateValue}>
        <EntityViewBridge openEntity={openEntity}>
            {children}
            <ErrorBoundary variant="inline">
                {renderActiveTab()}
                {hasCalculatorTab && (
                    <CostCalculatorDrawer
                        open={activeKey === toolKey("cost-calculator")}
                        onOpenChange={handleDrawerOpenChange}
                    />
                )}
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
