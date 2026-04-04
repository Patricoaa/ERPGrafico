"use client"

import { 
    Sheet,
} from "@/components/ui/sheet"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { CollapsibleSheet } from "@/components/shared/CollapsibleSheet"
import { FileText } from "lucide-react"
import { useState } from "react"
import { PayrollDetailContent } from "./PayrollDetailContent"

interface PayrollDetailSheetProps {
    payrollId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpdate?: () => void
    viewMode?: 'admin' | 'employee'
    employee?: any
}

import { useWindowWidth } from "@/hooks/useWindowWidth"

export function PayrollDetailSheet({ payrollId, open, onOpenChange, onUpdate, viewMode = 'admin', employee }: PayrollDetailSheetProps) {
    const { isSheetCollapsed } = useGlobalModals()
    const { closeHub } = useHubPanel()

    const windowWidth = useWindowWidth(150, open)

    const handleOpenChangeProxy = (newOpen: boolean) => {
        if (newOpen && isSheetCollapsed("PAYROLL_DETAIL")) {
            // Jump behavior: Close Hub if we are opening from a collapsed tab
            closeHub()
        }
        onOpenChange(newOpen)
    }

    return (
            <CollapsibleSheet
                sheetId={`PAYROLL_DETAIL_${payrollId}`}
                open={open}
                onOpenChange={onOpenChange}
                tabLabel="Detalle Pago"
                tabIcon={FileText}
                size="xl"
                className="max-w-[90vw] w-[90vw]"
            >
                {payrollId && (
                    <PayrollDetailContent 
                        payrollId={payrollId} 
                        onClose={() => onOpenChange(false)}
                        onUpdate={onUpdate}
                        isSheet={true}
                        viewMode={viewMode}
                        employee={employee}
                    />
                )}
            </CollapsibleSheet>
    )
}
