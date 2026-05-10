"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormSkeleton, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { getEmployee, updateEmployee, getAFPs, getPayrollConcepts } from "@/features/hr/api/hrApi"
import type { Employee, AFP, PayrollConcept } from "@/types/hr"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { EmployeeFormModal } from "@/features/hr/components/EmployeeFormModal"

interface EmployeeDetailClientProps {
    employeeId: string
}

export function EmployeeDetailClient({ employeeId }: EmployeeDetailClientProps) {
    const router = useRouter()
    const [employee, setEmployee] = useState<Employee | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)
    const [modalOpen, setModalOpen] = useState(false)

    const fetchEmployee = async () => {
        try {
            const data = await getEmployee(parseInt(employeeId))
            setEmployee(data)
        } catch (err: any) {
            setError(err.response?.status || 500)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEmployee()
    }, [employeeId])

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar empleado
        </div>
    )

    if (loading || !employee) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const displayId = formatEntityDisplay('hr.employee', employee)

    return (
        <EntityDetailPage
            entityLabel="hr.employee"
            displayId={displayId}
            breadcrumb={[
                { label: "Empleados", href: "/hr/employees" },
                { label: displayId, href: `/hr/employees/${employeeId}` },
            ]}
            instanceId={parseInt(employeeId)}
            readonly={true}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push("/hr/employees")}>Volver</CancelButton>
                            <ActionSlideButton onClick={() => setModalOpen(true)}>
                                Editar Empleado
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <div className="max-w-5xl mx-auto w-full p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Nombre</p>
                        <p className="font-semibold">{employee.contact_detail?.name}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">RUT</p>
                        <p className="font-semibold">{employee.contact_detail?.tax_id}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Cargo</p>
                        <p className="font-semibold">{employee.position || "—"}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Departamento</p>
                        <p className="font-semibold">{employee.department || "—"}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Sueldo Base</p>
                        <p className="font-semibold">${parseFloat(String(employee.base_salary)).toLocaleString("es-CL")}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Tipo de Contrato</p>
                        <p className="font-semibold">{employee.contract_type}</p>
                    </div>
                </div>
                
                <EmployeeFormModal 
                    open={modalOpen} 
                    onOpenChange={setModalOpen} 
                    employee={employee} 
                    onSaved={() => {
                        setModalOpen(false)
                        fetchEmployee()
                        router.refresh()
                    }} 
                />
            </div>
        </EntityDetailPage>
    )
}
