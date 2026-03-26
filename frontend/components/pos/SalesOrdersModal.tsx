"use client"

import { ShoppingCart, FileText, Loader2 } from "lucide-react"
import { SalesOrdersView } from "@/features/sales"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, Suspense } from "react"
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle 
} from "@/components/ui/sheet"

interface SalesOrdersModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

export function SalesOrdersModal({ open, onOpenChange, posSessionId }: SalesOrdersModalProps) {
    const [viewMode, setViewMode] = useState<'orders' | 'notes'>('orders')

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent 
                side="left" 
                className="max-w-[85vw] w-[85vw] sm:max-w-[85vw] flex flex-col p-0 border-r shadow-2xl z-[100]"
            >
                <SheetHeader className="p-6 pb-2 border-b">
                    <div className="flex items-center justify-between w-full pr-8">
                        <SheetTitle className="flex items-center gap-2">
                            {viewMode === 'orders' ? <ShoppingCart className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                            {viewMode === 'orders' ? 'Notas de Ventas' : 'Notas Crédito / Débito'}
                        </SheetTitle>
                        
                        <Tabs 
                            value={viewMode} 
                            onValueChange={(v) => setViewMode(v as 'orders' | 'notes')}
                            className="w-auto"
                        >
                            <TabsList className="grid w-[360px] grid-cols-2 h-9">
                                <TabsTrigger value="orders" className="text-xs gap-2">
                                    <ShoppingCart className="h-3.5 w-3.5" />
                                    Notas de Venta
                                </TabsTrigger>
                                <TabsTrigger value="notes" className="text-xs gap-2">
                                    <FileText className="h-3.5 w-3.5" />
                                    N. Crédito / Débito
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-hidden p-6">
                    {open && (
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
                                onActionSuccess={() => onOpenChange(false)}
                            />
                        </Suspense>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}
