"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ShoppingCart } from "lucide-react"
import { SalesOrdersView } from "@/features/sales"

interface SalesOrdersModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

export function SalesOrdersModal({ open, onOpenChange, posSessionId }: SalesOrdersModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size="full" className="max-w-[95vw] h-[90vh] flex flex-col">
                <DialogHeader className="pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Notas de Ventas
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    {open && (
                        <SalesOrdersView
                            posSessionId={posSessionId}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
