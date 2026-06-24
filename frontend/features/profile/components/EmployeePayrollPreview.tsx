"use client"

import React from "react"
import { type Employee } from "@/types/hr"
import { PayrollDetailDrawer } from "@/features/hr"

interface EmployeePayrollPreviewProps {
    payrollId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    employee?: Employee | null
}

export function EmployeePayrollPreview({ payrollId, open, onOpenChange, employee }: EmployeePayrollPreviewProps) {
    return (
        <PayrollDetailDrawer 
            payrollId={payrollId}
            open={open}
            onOpenChange={onOpenChange}
            viewMode="employee"
            employee={employee}
        />
    )
}
