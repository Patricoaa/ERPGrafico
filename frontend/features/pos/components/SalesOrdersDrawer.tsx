"use client"

import { ShoppingCart, FileText } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { SalesOrdersView } from "@/features/sales"
import { UnderlineTabs } from "@/components/shared"
import { useState, useEffect, Suspense } from "react"
import { Drawer, SkeletonShell } from "@/components/shared"
import { cn } from "@/lib/utils"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { OrderHubPanel } from "@/features/orders/components/OrderHubPanel"

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

    const { isHubOpen, closeHub } = useHubPanel()

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && isHubOpen) {
            closeHub()
        }
        if (!newOpen) setSelectedId(null)
        onOpenChange(newOpen)
    }

    const handleViewModeChange = (v: string) => {
        setSelectedId(null)
        setViewMode(v as 'orders' | 'notes')
    }

    const handleActionSuccess = () => {
        setSelectedId(null)
        onOpenChange(false)
    }

    const handleOrderSelect = (id: number | null) => {
        setSelectedId(id)
    }

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
                <UnderlineTabs
                    value={viewMode}
                    onValueChange={handleViewModeChange}
                    orientation="horizontal"
                    variant="underline"
                    items={[
                        { value: 'orders', label: 'Ventas', icon: ShoppingCart },
                        { value: 'notes', label: 'Notas C/D', icon: FileText }
                    ]}
                    className="w-auto animate-in fade-in duration-300"
                    headerClassName="border-b-0 px-0 h-auto"
                >
                    <div className="hidden" />
                </UnderlineTabs>
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

                        {/* Embedded HUB Panel */}
                        {selectedId && (
                            <div className="w-1/2 border-l border-border pl-4 flex flex-col min-h-0 overflow-hidden">
                                <OrderHubPanel
                                    orderId={viewMode === 'orders' ? selectedId : undefined}
                                    invoiceId={viewMode === 'notes' ? selectedId : undefined}
                                    type="sale"
                                    onClose={() => setSelectedId(null)}
                                    onActionSuccess={handleActionSuccess}
                                    posSessionId={posSessionId}
                                    showHeader={false}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Drawer>
    )
}
