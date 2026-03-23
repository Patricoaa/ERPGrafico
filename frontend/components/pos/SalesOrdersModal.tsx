"use client"

import { BaseModal } from "@/components/shared/BaseModal"
import { ShoppingCart, FileText } from "lucide-react"
import { SalesOrdersView } from "@/features/sales"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"

interface SalesOrdersModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

export function SalesOrdersModal({ open, onOpenChange, posSessionId }: SalesOrdersModalProps) {
    const [viewMode, setViewMode] = useState<'orders' | 'notes'>('orders')

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="full"
            title={
                <div className="flex items-center justify-between w-full pr-8">
                    <span className="flex items-center gap-2">
                        {viewMode === 'orders' ? <ShoppingCart className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                        {viewMode === 'orders' ? 'Notas de Ventas' : 'Notas Crédito / Débito'}
                    </span>
                    
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
            }
            contentClassName="max-w-[95vw] h-[90vh] flex flex-col p-0"
        >
            <div className="flex-1 overflow-hidden p-6">
                {open && (
                    <SalesOrdersView
                        posSessionId={posSessionId}
                        viewMode={viewMode}
                        onActionSuccess={() => onOpenChange(false)}
                    />
                )}
            </div>
        </BaseModal>
    )
}
