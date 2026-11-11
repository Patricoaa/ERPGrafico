"use client"

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { ShoppingCart, FileText } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { ENTITY_DRAWERS, POSSessionDrawer } from "@/lib/entity-drawers"
import { SalesOrdersView } from "@/features/sales"
import { TabBar, Drawer, DrawerScope, SkeletonShell, DocumentHeaderSlotContext, type DocumentHeaderSlots, type DrawerScopeValue } from "@/components/shared"
import { EntityNavigationScope } from "@/components/providers/GlobalModalProvider"
import { InvoiceSheet, OrderSheet } from "@/features/orders"
import { usePosDocumentStack } from "../hooks/usePosDocumentStack"
import { setPosOperatorHeaders } from "@/lib/pos-operator"
import { useOperatorGate } from "../operator"
import { overlayEntryOf, paneEntryOf } from "../utils/documentStack"

interface SalesOrdersDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

/** Ámbito del POS: los drawers abiertos desde aquí se anclan a la pantalla y se mueven igual. */
const POS_DRAWER_SCOPE: DrawerScopeValue = { boundary: "screen", className: "pos-motion" }

export function SalesOrdersDrawer({ open, onOpenChange, posSessionId }: SalesOrdersDrawerProps) {
    const [viewMode, setViewMode] = useState<'orders' | 'notes'>('orders')
    const [shouldRenderContent, setShouldRenderContent] = useState(open)
    const { state, open: openInPanel, setRoot, closeEntry, closingKey, reset } = usePosDocumentStack()

    // Un único drawer: el documento reemplaza el contenido de la lista dentro de este mismo drawer.
    // Solo un drawer anidado (producto, contacto…) puede quedar encima, y reemplaza al anterior.
    const documentEntry = paneEntryOf(state.entries)
    const overlayEntry = overlayEntryOf(state.entries)
    const rootEntry = state.entries[0] ?? null

    // Mientras hay un documento abierto sus modificaciones quedan en el seguimiento (ambos modos);
    // en caja multiusuario además piden operador (DOCUMENT_EDIT). Salir del documento termina ese pase.
    const { release, setChallengeTarget } = useOperatorGate()
    const documentLabel = documentEntry?.label ?? null
    const documentId = documentEntry?.id ?? null
    useEffect(() => {
        if (!posSessionId || documentLabel === null || documentId === null) return
        setPosOperatorHeaders({ documentContext: posSessionId })
        setChallengeTarget('DOCUMENT_EDIT', { type: documentLabel, id: documentId })
        return () => {
            setPosOperatorHeaders({ documentContext: undefined })
            setChallengeTarget('DOCUMENT_EDIT', null)
            void release('DOCUMENT_EDIT')
        }
    }, [documentLabel, documentId, posSessionId, release, setChallengeTarget])

    // Nodos del header de este drawer: cuando hay un documento, su identidad y acciones se portan aquí.
    const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null)
    const [subtitleSlot, setSubtitleSlot] = useState<HTMLElement | null>(null)
    const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null)
    const headerSlots = useMemo<DocumentHeaderSlots>(
        () => ({ title: titleSlot, subtitle: subtitleSlot, actions: actionsSlot }),
        [titleSlot, subtitleSlot, actionsSlot],
    )

    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => setShouldRenderContent(true))
        } else {
            const timer = setTimeout(() => {
                requestAnimationFrame(() => setShouldRenderContent(false))
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [open])

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) reset()
        onOpenChange(newOpen)
    }

    const handleViewModeChange = (v: string) => {
        reset()
        setViewMode(v as 'orders' | 'notes')
    }

    const handleActionSuccess = useCallback(() => {
        reset()
        onOpenChange(false)
    }, [reset, onOpenChange])

    // Fila elegida en la lista: abre su documento como ficha hija.
    const handleRowSelect = useCallback((id: number | null) => {
        setRoot(id === null ? null : { label: viewMode === 'orders' ? 'sales.saleorder' : 'billing.invoice', id })
    }, [setRoot, viewMode])

    // «Volver» del header del documento: vuelve a la lista (sin salida: es un cambio de vista).
    const closeDocument = useCallback(() => setRoot(null), [setRoot])

    // Documento embebido en el cuerpo del drawer del POS (sin Drawer propio: ver ADR-0121).
    const renderDocument = () => {
        if (!documentEntry) return null
        const body = documentEntry.label === 'treasury.possession' ? (
            <POSSessionDrawer
                id={documentEntry.id}
                embedded
                open
                onOpenChange={(isOpen) => { if (!isOpen) closeDocument() }}
                onBack={closeDocument}
            />
        ) : documentEntry.label === 'billing.invoice' ? (
            <InvoiceSheet
                id={documentEntry.id}
                embedded
                open
                onOpenChange={(isOpen) => { if (!isOpen) closeDocument() }}
                onBack={closeDocument}
                posSessionId={posSessionId}
                onActionSuccess={handleActionSuccess}
            />
        ) : (
            <OrderSheet
                id={documentEntry.id}
                kind="sale"
                embedded
                open
                onOpenChange={(isOpen) => { if (!isOpen) closeDocument() }}
                onBack={closeDocument}
                posSessionId={posSessionId}
                onActionSuccess={handleActionSuccess}
            />
        )
        return <div key={documentEntry.key} className="pos-view-in flex min-h-0 flex-1 flex-col">{body}</div>
    }

    // Drawer anidado (producto, contacto, OT…): sale con animación y vuelve al documento que lo abrió.
    const renderOverlay = () => {
        if (!overlayEntry) return null
        const render = ENTITY_DRAWERS[overlayEntry.label]
        if (!render) return null
        const isClosing = closingKey === overlayEntry.key
        return (
            <Fragment key={overlayEntry.key}>
                {render({
                    id: overlayEntry.id,
                    data: overlayEntry.data,
                    open: !isClosing,
                    onOpenChange: (isOpen) => { if (!isOpen) closeEntry(overlayEntry.key, "pop") },
                    onSuccess: () => closeEntry(overlayEntry.key, "pop"),
                })}
            </Fragment>
        )
    }

    return (
        <EntityNavigationScope open={openInPanel}>
            <DrawerScope value={POS_DRAWER_SCOPE}>
                <Drawer
                    open={open}
                    onOpenChange={handleOpenChange}
                    title={documentEntry
                        ? <span ref={setTitleSlot} className="block min-w-0" />
                        : (viewMode === 'orders' ? 'Notas de Ventas' : 'Notas Crédito / Débito')}
                    subtitle={documentEntry
                        ? <span ref={setSubtitleSlot} className="block" />
                        : <>Historial <span className="opacity-30">|</span> Documentos emitidos</>}
                    icon={getEntityIcon('pos.session')}
                    side="bottom"
                    boundary="screen"
                    showOverlay
                    defaultSize="90%"
                    fillContent
                    className="pos-motion"
                    headerActions={documentEntry ? <div ref={setActionsSlot} className="flex items-center gap-1" /> : (
                        <TabBar
                            value={viewMode}
                            onValueChange={handleViewModeChange}
                            orientation="horizontal"
                            variant="underline"
                            items={[
                                { value: 'orders', label: 'Ventas', icon: ShoppingCart },
                                { value: 'notes', label: 'Notas C/D', icon: FileText }
                            ]}
                            className="w-auto animate-in fade-in duration-300"
                        >
                            <div className="hidden" />
                        </TabBar>
                    )}
                >
                    <div className="px-6 pb-4 pt-2 flex-1 flex flex-col min-h-0">
                        {shouldRenderContent && (
                            <div className="flex flex-1 min-h-0 flex-col">
                                {/* La lista se mantiene montada (filtros, scroll) mientras hay un documento */}
                                <div className={documentEntry ? "hidden" : "flex flex-1 min-h-0 flex-col"}>
                                    <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                                        <SalesOrdersView
                                            viewMode={viewMode}
                                            onSelectOrder={handleRowSelect}
                                            selectedId={rootEntry?.id ?? null}
                                        />
                                    </Suspense>
                                </div>
                                <DocumentHeaderSlotContext.Provider value={headerSlots}>
                                    {renderDocument()}
                                </DocumentHeaderSlotContext.Provider>
                            </div>
                        )}
                    </div>
                </Drawer>
                {renderOverlay()}
            </DrawerScope>
        </EntityNavigationScope>
    )
}
