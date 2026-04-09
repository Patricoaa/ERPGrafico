"use client"

import { BaseModal } from "@/components/shared/BaseModal"
import { ShoppingCart } from "lucide-react"
import { SalesCheckoutWizardContent, SalesCheckoutWizardContentProps } from "./checkout/SalesCheckoutWizardContent"

interface SalesCheckoutWizardProps extends Omit<SalesCheckoutWizardContentProps, "onCancel" | "isInline"> {
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
                    <div className="p-3 bg-primary/10 rounded-lg">
                        <ShoppingCart className="h-6 w-6 text-primary" />
                    </div>
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
            <SalesCheckoutWizardContent 
                {...props} 
                initialDraftId={initialDraftId}
                onCancel={() => onOpenChange(false)}
                isInline={false}
            />
        </BaseModal>
    )
}

export default SalesCheckoutWizard
