"use client"

import { BaseModal } from '@/components/shared'
import { ShoppingCart } from "lucide-react"
import { SalesCheckoutWizardView, type SalesCheckoutWizardViewProps } from "./checkout/SalesCheckoutWizardView"

interface SalesCheckoutWizardProps extends Omit<SalesCheckoutWizardViewProps, "onCancel" | "isInline"> {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function SalesCheckoutWizard({
    open,
    onOpenChange,
    initialDraftId,
    ...props
}: SalesCheckoutWizardProps) {
    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="full"
            hideScrollArea
            className="h-[90vh]"
            contentClassName="p-0"
            title={
                <div className="flex items-center gap-4">
                    <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                    <div>
                        <span className="font-black tracking-tighter uppercase block">Cerrar Venta</span>
                        {initialDraftId && (
                            <span className="text-[10px] font-mono text-muted-foreground font-normal tracking-wider">
                                Borrador <span className="text-primary/80 font-bold">#{initialDraftId}</span>
                            </span>
                        )}
                    </div>
                </div>
            }
        >
            <SalesCheckoutWizardView 
                {...props} 
                initialDraftId={initialDraftId}
                onCancel={() => onOpenChange(false)}
                isInline={false}
            />
        </BaseModal>
    )
}

export default SalesCheckoutWizard
