"use client"

import { BaseDrawer } from "@/components/shared"
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

export function PayrollDetailSheet({ payrollId, open, onOpenChange, onUpdate, viewMode = 'admin', employee }: PayrollDetailSheetProps) {

    return (
            <BaseDrawer
                open={open}
                onOpenChange={onOpenChange}
                height="full"
                contentClassName="p-0"
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
            </BaseDrawer>
    )
}
