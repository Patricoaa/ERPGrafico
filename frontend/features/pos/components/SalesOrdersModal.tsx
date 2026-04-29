"use client"

import { ShoppingCart, FileText } from "lucide-react"
import { SalesOrdersView } from "@/features/sales"
import { FormTabs } from "@/components/shared"
import { ScrollArea as ScrollAreaUI } from "@/components/ui/scroll-area"
import { useState, useEffect, Suspense } from "react"
import { useWindowWidth } from "@/hooks/useWindowWidth"
import { cn } from "@/lib/utils"
import { BaseDrawer } from "@/components/shared"
import { TableSkeleton } from "@/components/shared"
import { useHubPanel } from "@/components/providers/HubPanelProvider"

interface SalesOrdersModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

export function SalesOrdersModal({ open, onOpenChange, posSessionId }: SalesOrdersModalProps) {
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
        <BaseDrawer
            open={open}
            onOpenChange={handleOpenChange}
            title={viewMode === 'orders' ? 'Notas de Ventas' : 'Notas Crédito / Débito'}
            subtitle={<>Historial <span className="opacity-30">|</span> Documentos emitidos</>}
            icon={viewMode === 'orders' ? ShoppingCart : FileText}
            height="full"
            headerActions={
                <FormTabs
                    value={viewMode}
                    onValueChange={(v) => setViewMode(v as 'orders' | 'notes')}
                    orientation="horizontal"
                    items={[
                        { value: 'orders', label: 'Ventas', icon: ShoppingCart },
                        { value: 'notes', label: 'Notas C/D', icon: FileText }
                    ]}
                    className="w-auto"
                >
                    <div className="hidden" />
                </FormTabs>
            }
        >
            <div className="py-2">
                {shouldRenderContent && (
                    <Suspense fallback={<TableSkeleton rows={10} columns={6} />}>
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
        </BaseDrawer>
    )
}
