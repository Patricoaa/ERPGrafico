"use client"

import React from "react"

import { PayrollDetailDrawer, type EmployeeBasic } from "@/features/hr"

interface EmployeePayrollPreviewProps {
    payrollId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    employee?: EmployeeBasic | null
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
