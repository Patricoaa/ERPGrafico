"use client"

import type React from "react"
import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { ShoppingCart, FileText } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { ENTITY_DRAWERS, POSSessionDrawer } from "@/lib/entity-drawers"
import { SalesOrdersView } from "@/features/sales"
import {
    TabBar,
    BaseModal,
    DrawerScope,
    SkeletonShell,
    DocumentHeaderSlotContext,
    DocumentBackAction,
    type DocumentHeaderSlots,
    type DrawerScopeValue,
    fadeInClass,
} from "@/components/shared"
import { EntityNavigationScope } from "@/components/providers/GlobalModalProvider"
import { InvoiceSheet, NoteWizardTab, OrderSheet } from "@/features/orders"
import { usePosDocumentStack, POS_NOTE_WIZARD_LABEL } from "../hooks/usePosDocumentStack"
import { setPosOperatorHeaders } from "@/lib/pos-operator"
import { useOperatorGate } from "../operator"
import { overlayEntriesOf, paneEntryOf, type StackEntry } from "../utils/documentStack"
import { cn } from "@/lib/utils"

export interface SalesOrdersModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

export type SalesOrdersDrawerProps = SalesOrdersModalProps

/** Ámbito del POS: los drawers abiertos desde aquí (drilldowns) se renderizan en línea dentro del modal. */
const POS_DRAWER_SCOPE: DrawerScopeValue = { boundary: "screen" }

export function SalesOrdersModal({ open, onOpenChange, posSessionId }: SalesOrdersModalProps) {
    const [viewMode, setViewMode] = useState<'orders' | 'notes'>('orders')
    const [shouldRenderContent, setShouldRenderContent] = useState(open)
    const { state, open: openInPanel, openNote, setRoot, back, reset } = usePosDocumentStack()

    // La fila elegida se incrusta en este modal y reemplaza a la lista. Toda entidad abierta desde ahí
    // se apila encima, cubriendo al padre; «Volver» quita la cima y revela la anterior.
    const documentEntry = paneEntryOf(state.entries)
    const overlayEntries = overlayEntriesOf(state.entries)
    const rootEntry = state.entries[0] ?? null
    // Drilldown en el mismo modal: solo la cima de las entidades apiladas se dibuja, en línea, en lugar de
    // la lista o el documento; «Volver» (siempre visible en su encabezado) la quita y revela la anterior.
    const topOverlay = overlayEntries[overlayEntries.length - 1] ?? null
    const previousEntry = overlayEntries.length > 1 ? overlayEntries[overlayEntries.length - 2] : documentEntry
    const showsEntity = documentEntry !== null || topOverlay !== null
    const backLabel = previousEntry?.display ? `Volver a ${previousEntry.display}` : documentEntry ? "Volver al documento" : "Volver a la lista"

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

    // Nodos del header de este modal: cuando hay un documento o entidad en línea, su identidad y acciones se portan aquí.
    const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null)
    const [subtitleSlot, setSubtitleSlot] = useState<HTMLElement | null>(null)
    const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null)
    const headerSlots = useMemo<DocumentHeaderSlots>(
        () => ({ title: titleSlot, subtitle: subtitleSlot, actions: actionsSlot }),
        [titleSlot, subtitleSlot, actionsSlot],
    )

    const inlineScope = useMemo<DrawerScopeValue>(
        () => ({ ...POS_DRAWER_SCOPE, inline: { onBack: back, backLabel, header: headerSlots } }),
        [back, backLabel, headerSlots],
    )
    // Con una entidad encima, el documento embebido deja de portar su identidad al header (queda montado, oculto).
    const documentSlots = useMemo<DocumentHeaderSlots>(
        () => topOverlay ? { title: null, subtitle: null, actions: null } : headerSlots,
        [topOverlay, headerSlots],
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

    // Documento embebido en el cuerpo del modal del POS (sin Drawer propio: ver ADR-0121).
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

    // Entidad apilada (cima), dibujada en línea. Los documentos de panel conservan el contexto de la sesión POS
    // (acciones de cobro); el resto sale del registro de drawers de entidad.
    const renderOverlay = (entry: StackEntry) => {
        const close = back
        const onOpenChange = (isOpen: boolean) => { if (!isOpen) close() }
        const open = true

        let body: React.ReactNode = null
        if (entry.label === "sales.saleorder") {
            body = <OrderSheet id={entry.id} kind="sale" open={open} onOpenChange={onOpenChange} posSessionId={posSessionId} onActionSuccess={handleActionSuccess} />
        } else if (entry.label === "billing.invoice") {
            body = <InvoiceSheet id={entry.id} open={open} onOpenChange={onOpenChange} posSessionId={posSessionId} onActionSuccess={handleActionSuccess} />
        } else if (entry.label === POS_NOTE_WIZARD_LABEL) {
            const noteType = (entry.data as { noteType: "NOTA_CREDITO" | "NOTA_DEBITO" }).noteType
            body = <NoteWizardTab invoiceId={entry.id} noteType={noteType} open={open} onOpenChange={onOpenChange} />
        } else if (entry.label === "treasury.possession") {
            body = <POSSessionDrawer id={entry.id} open={open} onOpenChange={onOpenChange} />
        } else {
            const render = ENTITY_DRAWERS[entry.label]
            body = render ? render({ id: entry.id, data: entry.data, open, onOpenChange, onSuccess: close }) : null
        }
        return <Fragment key={entry.key}>{body}</Fragment>
    }

    return (
        <EntityNavigationScope open={openInPanel} openNote={openNote}>
            <BaseModal
                open={open}
                onOpenChange={handleOpenChange}
                size="2xl"
                asDialog
                hideScrollArea
                title={showsEntity
                    ? <span ref={setTitleSlot} className="block min-w-0" />
                    : (viewMode === 'orders' ? 'Notas de Ventas' : 'Notas Crédito / Débito')}
                description={showsEntity
                    ? <span ref={setSubtitleSlot} className="block truncate" />
                    : <>Historial <span className="opacity-30">|</span> Documentos emitidos</>}
                icon={getEntityIcon('pos.session')}
                headerActions={showsEntity ? (
                    <div className="flex items-center gap-1">
                        {topOverlay && <DocumentBackAction label={backLabel} onClick={back} />}
                        <div ref={setActionsSlot} className="flex items-center gap-1" />
                    </div>
                ) : (
                    <TabBar
                        value={viewMode}
                        onValueChange={handleViewModeChange}
                        orientation="horizontal"
                        variant="underline"
                        items={[
                            { value: 'orders', label: 'Ventas', icon: ShoppingCart },
                            { value: 'notes', label: 'Notas C/D', icon: FileText }
                        ]}
                        className={cn("w-auto", fadeInClass({ duration: 300 }))}
                    >
                        <div className="hidden" />
                    </TabBar>
                )}
                className="h-[88vh] max-h-[92vh] flex flex-col"
                contentClassName="p-0 flex-1 flex flex-col min-h-0"
            >
                <div className="flex-1 flex flex-col min-h-0">
                    {shouldRenderContent && (
                        <div className="flex flex-1 min-h-0 flex-col">
                            {/* La lista se mantiene montada (filtros, scroll) mientras hay un documento o una entidad */}
                            <div className={documentEntry || topOverlay ? "hidden" : "flex flex-1 min-h-0 flex-col px-6 pb-4 pt-2"}>
                                <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                                    <SalesOrdersView
                                        viewMode={viewMode}
                                        onSelectOrder={handleRowSelect}
                                        selectedId={rootEntry?.id ?? null}
                                    />
                                </Suspense>
                            </div>
                            {/* El documento embebido conserva su estado mientras una entidad lo cubre */}
                            {documentEntry && (
                                <div className={topOverlay ? "hidden" : "flex flex-1 min-h-0 flex-col"}>
                                    <DocumentHeaderSlotContext.Provider value={documentSlots}>
                                        {renderDocument()}
                                    </DocumentHeaderSlotContext.Provider>
                                </div>
                            )}
                            {topOverlay && (
                                <DrawerScope value={inlineScope}>
                                    <div key={topOverlay.key} className="pos-view-in flex min-h-0 flex-1 flex-col">
                                        {renderOverlay(topOverlay)}
                                    </div>
                                </DrawerScope>
                            )}
                        </div>
                    )}
                </div>
            </BaseModal>
        </EntityNavigationScope>
    )
}

export const SalesOrdersDrawer = SalesOrdersModal
