"use client"

import React from "react"
import { Employee } from "@/types/hr"
import { PayrollDetailSheet } from "@/features/hr/components/payrolls/PayrollDetailSheet"

interface EmployeePayrollPreviewProps {
    payrollId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    employee?: Employee | null
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
