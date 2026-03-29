"use client"

import { 
    Sheet,
} from "@/components/ui/sheet"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
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
    const { closeCommandCenter, isSheetCollapsed } = useGlobalModals()

    const windowWidth = useWindowWidth(150, open)

    const handleOpenChangeProxy = (newOpen: boolean) => {
        if (newOpen && isSheetCollapsed("PAYROLL_DETAIL")) {
            // Jump behavior: Close Hub if we are opening from a collapsed tab
            closeCommandCenter()
        }
        onOpenChange(newOpen)
    }

    const fullWidth = Math.min(windowWidth * 0.85, 1600) // Match the 85vw logic
    return (
        <Sheet open={open} onOpenChange={handleOpenChangeProxy} modal={false}>
            <CollapsibleSheet
                sheetId="PAYROLL_DETAIL"
                open={open}
                onOpenChange={handleOpenChangeProxy}
                tabLabel="LIQUIDACIÓN"
                tabIcon={FileText}
                fullWidth={fullWidth}
                className="max-w-[90vw] w-[90vw] sm:max-w-[85vw] sm:w-[85vw]"
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
        </Sheet>
    )
}
