"use client"

import { FileText } from "lucide-react"
import { EmptyState, Section, SkeletonShell } from "@/components/shared"
import { usePayrollDetail, type EmployeeBasic } from "@/features/hr/hooks/usePayrolls"
import { usePayrollSections } from "./payrollSummary"

interface PayrollDetailViewProps {
    payrollId: number
    /** ADR-0152/0083: la ficha admin es el drawer/pestaña; aquí solo existe la lectura del empleado. */
    viewMode?: "employee"
    employee?: EmployeeBasic | null
}

/** Resumen de la propia liquidación para el perfil del empleado, sin acciones de administración. */
export function PayrollDetailView({ payrollId, employee }: PayrollDetailViewProps) {
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
