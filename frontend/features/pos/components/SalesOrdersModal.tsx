"use client"

import { ShoppingCart, FileText } from "lucide-react"
import { SalesOrdersView } from "@/features/sales"
import { FormTabs } from "@/components/shared"
import { ScrollArea as ScrollAreaUI } from "@/components/ui/scroll-area"
import { useState, useEffect, Suspense } from "react"
import { useWindowWidth } from "@/hooks/useWindowWidth"
import {
    Sheet,
    SheetHeader,
    SheetTitle
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { CollapsibleSheet } from "@/components/shared/CollapsibleSheet"
import { SheetCloseButton } from "@/components/shared/SheetCloseButton"
import { TableSkeleton } from "@/components/shared"

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

    const windowWidth = useWindowWidth(150, open)

    const { isSheetCollapsed } = useGlobalModals()
    const { isHubOpen, closeHub } = useHubPanel()
    const [wasOpenBeforeHub, setWasOpenBeforeHub] = useState(false)

    // Jump behavior: Close Hub if we are opening Sales Notes from a collapsed tab
    useEffect(() => {
        if (open && isSheetCollapsed("POS_SALES")) {
            closeHub()
        }
    }, [open, isSheetCollapsed, closeHub])

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && isHubOpen) {
            closeHub()
        }
        onOpenChange(newOpen)
    }



    const isDesktop = windowWidth >= 768;
    const isTablet = windowWidth >= 640;
    const activePush = isHubOpen && !isSheetCollapsed("POS_SALES");

    return (
        <CollapsibleSheet
            sheetId="POS_SALES"
            open={open}
            onOpenChange={handleOpenChange}
            tabLabel={viewMode === 'orders' ? 'NOTAS VENTAS' : 'NOTAS C/D'}
            tabIcon={viewMode === 'orders' ? ShoppingCart : FileText}
            size="full"
            className={cn(
                "max-w-full w-full",
                activePush ? "!shadow-[-15px_0_30px_rgba(0,0,0,0.08)] !border-r-0 !ring-0" : "shadow-2xl"
            )}
        >
            <div className="flex flex-col h-full bg-transparent backdrop-blur-md">
                <SheetHeader className="p-6 pb-4 border-b bg-transparent sticky top-0 z-50">
                    <div className="flex items-center justify-between w-full text-left">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-lg text-primary shadow-sm border border-primary/5 hidden sm:block">
                                {viewMode === 'orders' ? <ShoppingCart className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                            </div>
                            <div className="flex flex-col">
                                <SheetTitle className="text-xl font-bold tracking-tight text-foreground">
                                    {viewMode === 'orders' ? 'Notas de Ventas' : 'Notas Crédito / Débito'}
                                </SheetTitle>
                                <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
                                    Historial <span className="opacity-30">|</span> Documentos emitidos
                                </div>
                            </div>
                        </div>

                        <FormTabs
                            value={viewMode}
                            onValueChange={(v) => setViewMode(v as 'orders' | 'notes')}
                            orientation="horizontal"
                            items={[
                                { value: 'orders', label: 'Ventas', icon: ShoppingCart },
                                { value: 'notes', label: 'Notas C/D', icon: FileText }
                            ]}
                            className="w-auto"
                        />
                    </div>
                </SheetHeader>

                <SheetCloseButton
                    onClick={() => handleOpenChange(false)}
                    className="absolute top-4 right-4 z-[60]"
                />

                <ScrollAreaUI className="flex-1 px-6">
                    <div className="py-6">
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
                </ScrollAreaUI>
            </div>
        </CollapsibleSheet>
    )
}
