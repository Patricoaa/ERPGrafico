"use client"

import React from "react"
import { 
    Sheet, 
    SheetContent, 
} from "@/components/ui/sheet"
import { PayrollDetailContent } from "./PayrollDetailContent"

interface PayrollDetailSheetProps {
    payrollId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpdate?: () => void
    viewMode?: 'admin' | 'employee'
    employee?: any
}

export function PayrollDetailSheet({ payrollId, open, onOpenChange, onUpdate, viewMode = 'admin', employee }: PayrollDetailSheetProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent 
                side="right" 
                className="max-w-[90vw] w-[90vw] sm:max-w-[85vw] sm:w-[85vw] p-0 flex flex-col border-l shadow-2xl overflow-hidden rounded-l-3xl"
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
            </SheetContent>
        </Sheet>
    )
}
