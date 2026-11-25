"use client"

import { useRouter } from "next/navigation"
import { FileText } from "lucide-react"
import { EmptyState, Section, SkeletonShell } from "@/components/shared"
import { usePayrollDetail, type EmployeeBasic } from "@/features/hr/hooks/usePayrolls"
import { PayrollDetailDrawer } from "./PayrollDetailDrawer"
import { usePayrollSections } from "./payrollSummary"

interface PayrollDetailViewProps {
    payrollId: number
    /** `admin`: ficha completa incrustada (página). `employee`: lectura de la propia liquidación (perfil). */
    viewMode?: "admin" | "employee"
    employee?: EmployeeBasic | null
}

/**
 * Liquidación fuera de un drawer. La administración ve la misma ficha documental que abre
 * `openEntity("hr.payroll", id)`, incrustada; el empleado ve solo el Resumen, sin acciones.
 */
export function PayrollDetailView({ payrollId, viewMode = "admin", employee }: PayrollDetailViewProps) {
    const router = useRouter()
    if (viewMode === "admin") {
        return (
            <PayrollDetailDrawer
                embedded
                open
                payrollId={payrollId}
                onOpenChange={(o) => { if (!o) router.push("/hr/payrolls") }}
            />
        )
    }
    return <EmployeePayrollSummary payrollId={payrollId} employee={employee} />
}

function EmployeePayrollSummary({ payrollId, employee }: { payrollId: number; employee?: EmployeeBasic | null }) {
    const { payrollDetail, isLoading, isError } = usePayrollDetail(payrollId, "employee", employee)
    const payroll = payrollDetail?.payroll ?? null
    const sections = usePayrollSections(payroll)

    if (!isLoading && (isError || !payroll)) {
        return <EmptyState icon={FileText} title="Liquidación no encontrada" />
    }

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando liquidación">
            <div className="h-full space-y-8 overflow-y-auto px-6 pt-4 pb-8 scrollbar-thin">
                {payroll && (
                    sections.map((section, index) => (
                        <section key={section.title ?? index} className="space-y-4" aria-label={section.title}>
                            {section.title && <Section.Header spaced title={section.title} icon={section.icon} />}
                            {section.content}
                        </section>
                    ))
                )}
            </div>
        </SkeletonShell>
    )
}
