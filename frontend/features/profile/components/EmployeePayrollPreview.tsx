"use client"

import React from "react"
import { PayrollDetailSheet } from "@/features/hr/components/payrolls/PayrollDetailSheet"

interface EmployeePayrollPreviewProps {
    payrollId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    employee?: any 
}

export function EmployeePayrollPreview({ payrollId, open, onOpenChange, employee }: EmployeePayrollPreviewProps) {
    return (
        <PayrollDetailSheet 
            payrollId={payrollId}
            open={open}
            onOpenChange={onOpenChange}
            viewMode="employee"
            employee={employee}
        />
    )
}
