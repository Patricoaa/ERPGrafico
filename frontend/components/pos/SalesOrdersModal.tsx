"use client"

import { BaseModal } from "@/components/shared/BaseModal"
import { ShoppingCart } from "lucide-react"
import { SalesOrdersView } from "@/features/sales"

interface SalesOrdersModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    posSessionId?: number | null
}

export function SalesOrdersModal({ open, onOpenChange, posSessionId }: SalesOrdersModalProps) {
    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="full"
            title={
                <span className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Notas de Ventas
                </span>
            }
            contentClassName="max-w-[95vw] h-[90vh] flex flex-col p-0"
        >
            <div className="flex-1 overflow-hidden p-6">
                {open && (
                    <SalesOrdersView
                        posSessionId={posSessionId}
                        viewMode="orders"
                        onActionSuccess={() => onOpenChange(false)}
                    />
                )}
            </div>
        </BaseModal>
    )
}
