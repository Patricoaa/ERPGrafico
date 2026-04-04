"use client"

import { ShoppingCart, FileText, Loader2, ArrowLeft } from "lucide-react"
import { SalesOrdersView } from "@/features/sales"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
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
            setShouldRenderContent(true)
        } else {
            const timer = setTimeout(() => setShouldRenderContent(false), 500)
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
                        <div className="flex items-center justify-between w-full pl-12 text-left">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm border border-primary/5 hidden sm:block">
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
                            
                            <Tabs 
                                value={viewMode} 
                                onValueChange={(v) => setViewMode(v as 'orders' | 'notes')}
                                className="w-auto"
                            >
                                <TabsList className="grid w-[320px] grid-cols-2 h-9 rounded-xl border-primary/10">
                                    <TabsTrigger value="orders" className="text-xs gap-2 rounded-lg">
                                        <ShoppingCart className="h-3.5 w-3.5" />
                                        Ventas
                                    </TabsTrigger>
                                    <TabsTrigger value="notes" className="text-xs gap-2 rounded-lg">
                                        <FileText className="h-3.5 w-3.5" />
                                        Notas C/D
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </SheetHeader>

                    {/* Custom Navigation Button for Sheet (Top Left Corner) */}
                    <div className="absolute top-4 left-4 z-[60]">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 rounded-full bg-muted/50 backdrop-blur-sm border shadow-sm text-muted-foreground hover:bg-white hover:text-primary transition-all" 
                            onClick={() => handleOpenChange(false)}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </div>

                    <ScrollAreaUI className="flex-1 px-6">
                        <div className="py-6">
                            {shouldRenderContent && (
                                <Suspense fallback={
                                    <div className="flex h-full w-full items-center justify-center p-20">
                                        <div className="flex flex-col items-center gap-4">
                                            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                                            <p className="text-sm font-medium text-muted-foreground animate-pulse">Cargando datos de ventas...</p>
                                        </div>
                                    </div>
                                }>
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
