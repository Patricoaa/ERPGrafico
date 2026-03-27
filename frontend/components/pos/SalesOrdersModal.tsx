"use client"

import { ShoppingCart, FileText, Loader2, X } from "lucide-react"
import { SalesOrdersView } from "@/features/sales"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
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
                side="right" 
                className="max-w-[90vw] w-[90vw] sm:max-w-[85vw] sm:w-[85vw] p-0 flex flex-col border-l shadow-2xl overflow-hidden rounded-l-3xl z-[100]"
            >
                <SheetHeader className="p-6 pb-4 border-b bg-background sticky top-0 z-50">
                    <div className="flex items-center justify-between w-full pr-12 text-left">
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

                {/* Custom Close Button for Sheet (Top Right Corner) */}
                <div className="absolute top-4 right-4 z-[60]">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded-full bg-slate-50/50 backdrop-blur-sm border shadow-sm text-muted-foreground hover:bg-white hover:text-rose-500 transition-all" 
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

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
