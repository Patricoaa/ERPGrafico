"use client"

import { ShoppingCart, FileText } from "lucide-react"
import { getEntityIcon } from "@/lib/entity-registry"
import { SalesOrdersView } from "@/features/sales"
import { UnderlineTabs } from "@/components/shared"
import {ScrollArea as ScrollAreaUI } from "@/components/ui/scroll-area"
import { useState, useEffect, Suspense } from "react"
import { Drawer, SkeletonShell } from "@/components/shared"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

interface SalesOrdersDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

export function SalesOrdersDrawer({ open, onOpenChange, posSessionId }: SalesOrdersDrawerProps) {
    const [viewMode, setViewMode] = useState<'orders' | 'notes'>('orders')
    const [shouldRenderContent, setShouldRenderContent] = useState(open)

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
    const [wasOpenBeforeHub, setWasOpenBeforeHub] = useState(false)

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && isHubOpen) {
            closeHub()
        }
        onOpenChange(newOpen)
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
                    onValueChange={(v) => setViewMode(v as 'orders' | 'notes')}
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
                    <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                        <SalesOrdersView
                            posSessionId={posSessionId}
                            viewMode={viewMode}
                            onActionSuccess={() => {
                                setWasOpenBeforeHub(false)
                                onOpenChange(false)
                            }}
                        />
                    </Suspense>
                )}
            </div>
        </Drawer>
    )
}
