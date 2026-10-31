"use client"

import { FileText } from "lucide-react"
import { BaseModal } from "@/components/shared"
import { PayrollDetailView, type EmployeeBasic } from "@/features/hr"

interface EmployeePayrollModalProps {
    payrollId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    employee?: EmployeeBasic | null
}

export function EmployeePayrollModal({ payrollId, open, onOpenChange, employee }: EmployeePayrollModalProps) {
    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            title="Detalle de liquidación"
            description="Liquidación de remuneraciones"
            icon={FileText}
            size="xl"
            variant="raw"
            hideScrollArea
            className="h-[min(90dvh,900px)] max-h-[90dvh] rounded-md p-0"
            contentClassName="overflow-hidden p-0"
        >
            {payrollId !== null && (
                <PayrollDetailView
                    payrollId={payrollId}
                    viewMode="employee"
                    employee={employee}
                    isSheet
                />
            )}
        </BaseModal>
    )
}
