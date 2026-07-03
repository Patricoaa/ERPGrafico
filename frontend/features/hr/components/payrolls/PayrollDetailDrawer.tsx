"use client"

import { Drawer } from "@/components/shared"
import { getEntityIcon } from "@/lib/entity-registry"
import { useState } from "react"
import { PayrollDetailContent } from "./PayrollDetailContent"
import type { EmployeeBasic } from "@/features/hr/hooks/usePayrolls"
import { formDrawerWidth } from "@/lib/form-widths"

interface PayrollDetailDrawerProps {
    payrollId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpdate?: () => void
    viewMode?: 'admin' | 'employee'
    employee?: EmployeeBasic | null
}

export function PayrollDetailDrawer({ payrollId, open, onOpenChange, onUpdate, viewMode = 'admin', employee }: PayrollDetailDrawerProps) {
    const [headerData, setHeaderData] = useState<{
        title?: React.ReactNode | string
        subtitle?: React.ReactNode | string
        icon?: React.ElementType
        headerActions?: React.ReactNode
    }>({})

    return (
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                boundary="embedded"
                defaultSize={formDrawerWidth("master", false)}
                contentClassName="p-0 flex flex-col overflow-hidden"
                title={headerData.title}
                subtitle={headerData.subtitle}
                icon={headerData.icon || getEntityIcon('hr.payroll')}
                headerActions={headerData.headerActions}
            >
                {payrollId && (
                    <PayrollDetailContent 
                        payrollId={payrollId} 
                        onClose={() => onOpenChange(false)}
                        onUpdate={onUpdate}
                        isSheet={true}
                        viewMode={viewMode}
                        employee={employee}
                        onHeaderDataChange={setHeaderData}
                    />
                )}
            </Drawer>
    )
}
