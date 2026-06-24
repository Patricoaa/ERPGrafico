"use client"

import { ShoppingCart, FileText } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { SalesOrdersView } from "@/features/sales"
import { TabBar } from "@/components/shared"
import { useState, useEffect, Suspense, useCallback } from "react"
import { Drawer, SkeletonShell } from "@/components/shared"
import { cn } from "@/lib/utils"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { OrderHubPanel } from "@/features/orders/components/OrderHubPanel"
import { DetailPanel } from "./DetailPanel"

interface SalesOrdersDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

interface DetailContent {
    type: string
    id: number
}

export function SalesOrdersDrawer({ open, onOpenChange, posSessionId }: SalesOrdersDrawerProps) {
    const [viewMode, setViewMode] = useState<'orders' | 'notes'>('orders')
    const [shouldRenderContent, setShouldRenderContent] = useState(open)
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [detailContent, setDetailContent] = useState<DetailContent | null>(null)

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

    const { isHubOpen, openHub, closeHub } = useHubPanel()

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && isHubOpen) {
            closeHub()
        }
        if (!newOpen) {
            setSelectedId(null)
            setDetailContent(null)
        }
        onOpenChange(newOpen)
    }

    const handleViewModeChange = (v: string) => {
        setSelectedId(null)
        setDetailContent(null)
        setViewMode(v as 'orders' | 'notes')
    }

    const handleActionSuccess = useCallback(() => {
        setDetailContent(null)
        setSelectedId(null)
        onOpenChange(false)
    }, [onOpenChange])

    const handleOrderSelect = useCallback((id: number | null) => {
        setSelectedId(id)
        setDetailContent(null)
        if (id) {
            openHub({
                orderId: viewMode === 'orders' ? id : undefined,
                invoiceId: viewMode === 'notes' ? id : undefined,
                type: 'sale',
                posSessionId,
                onActionSuccess: handleActionSuccess,
            })
        } else if (!id && isHubOpen) {
            closeHub()
        }
    }, [viewMode, posSessionId, isHubOpen, openHub, closeHub, handleActionSuccess])

    const handleOpenDetail = useCallback((docType: string, docId: number | string) => {
        setDetailContent({ type: docType, id: Number(docId) })
    }, [])

    const hasDetail = !!detailContent

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
                            selectedId && hasDetail ? "w-1/3" : selectedId ? "w-1/2" : "w-full"
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

                        {/* Embedded HUB Panel */}
                        {selectedId && (
                            <div className={cn(
                                "border-l border-border pl-4 flex flex-col min-h-0 overflow-hidden transition-all duration-300",
                                hasDetail ? "w-1/3" : "w-1/2"
                            )}>
                                <OrderHubPanel
                                    orderId={viewMode === 'orders' ? selectedId : undefined}
                                    invoiceId={viewMode === 'notes' ? selectedId : undefined}
                                    type="sale"
                                    onClose={() => setSelectedId(null)}
                                    onActionSuccess={handleActionSuccess}
                                    onOpenDetail={handleOpenDetail}
                                    posSessionId={posSessionId}
                                    showHeader={false}
                                />
                            </div>
                        )}

                        {/* Detail Panel (third column) */}
                        {selectedId && hasDetail && (
                            <div className="w-1/3 border-l border-border pl-4 flex flex-col min-h-0 overflow-hidden bg-muted/20 rounded-md">
                                <DetailPanel
                                    type={detailContent.type}
                                    id={detailContent.id}
                                    onClose={() => setDetailContent(null)}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Drawer>
    )
}
