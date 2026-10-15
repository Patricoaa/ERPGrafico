"use client"

import { ShoppingCart, FileText } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { SalesOrdersView } from "@/features/sales"
import { TabBar } from "@/components/shared"
import { useState, useEffect, Suspense, useCallback } from "react"
import { Drawer, SkeletonShell } from "@/components/shared"
import { cn } from "@/lib/utils"
import { InvoiceSheet, OrderSheet } from "@/features/orders"

interface SalesOrdersDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

export function SalesOrdersDrawer({ open, onOpenChange, posSessionId }: SalesOrdersDrawerProps) {
    const [viewMode, setViewMode] = useState<'orders' | 'notes'>('orders')
    const [shouldRenderContent, setShouldRenderContent] = useState(open)
    const [selectedId, setSelectedId] = useState<number | null>(null)

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
        if (!newOpen) setSelectedId(null)
        onOpenChange(newOpen)
    }

    const handleViewModeChange = (v: string) => {
        setSelectedId(null)
        setViewMode(v as 'orders' | 'notes')
    }

    const handleActionSuccess = useCallback(() => {
        setSelectedId(null)
        onOpenChange(false)
    }, [onOpenChange])

    // Ficha documental incrustada (ADR-0083, decisión D11): OV o nota con su propio motor de
    // acciones; los relacionados se abren apilados con openEntity.
    const handleOrderSelect = useCallback((id: number | null) => setSelectedId(id), [])

    return (
        <Drawer
            open={open}
            onOpenChange={handleOpenChange}
            title={viewMode === 'orders' ? 'Notas de Ventas' : 'Notas Crédito / Débito'}
            subtitle={<>Historial <span className="opacity-30">|</span> Documentos emitidos</>}
            icon={getEntityIcon('pos.session')}
            side="bottom"
            boundary="screen"
            showOverlay
            defaultSize="90%"
            headerActions={
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
            }
        >
            <div className="px-6 pb-4 pt-2 flex-1 flex flex-col min-h-0">
                {shouldRenderContent && (
                    <div className="flex flex-1 min-h-0 gap-4">
                        {/* List */}
                        <div className={cn(
                            "flex flex-col min-h-0 transition-all duration-300",
                            selectedId ? "w-1/2" : "w-full"
                        )}>
                            <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                                <SalesOrdersView
                                    posSessionId={posSessionId}
                                    viewMode={viewMode}
                                    onActionSuccess={handleActionSuccess}
                                    onSelectOrder={handleOrderSelect}
                                    selectedId={selectedId}
                                />
                            </Suspense>
                        </div>

                        {/* Ficha de la OV incrustada (ADR-0083) */}
                        {selectedId && viewMode === 'orders' && (
                            <div className="w-1/2 border-l border-border flex flex-col min-h-0 overflow-hidden transition-all duration-300">
                                <OrderSheet
                                    key={selectedId}
                                    id={selectedId}
                                    kind="sale"
                                    embedded
                                    open
                                    onOpenChange={(isOpen) => { if (!isOpen) setSelectedId(null) }}
                                    posSessionId={posSessionId}
                                    onActionSuccess={handleActionSuccess}
                                />
                            </div>
                        )}

                        {/* Nota C/D: ficha documental incrustada (ADR-0083) */}
                        {selectedId && viewMode === 'notes' && (
                            <div className="w-1/2 border-l border-border flex flex-col min-h-0 overflow-hidden transition-all duration-300">
                                <InvoiceSheet
                                    key={selectedId}
                                    id={selectedId}
                                    embedded
                                    open
                                    onOpenChange={(isOpen) => { if (!isOpen) setSelectedId(null) }}
                                    posSessionId={posSessionId}
                                    onActionSuccess={handleActionSuccess}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Drawer>
    )
}
