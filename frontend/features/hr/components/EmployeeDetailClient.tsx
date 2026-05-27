"use client"

import React, { useState } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, SkeletonShell, FormFooter, CancelButton, ActionSlideButton } from "@/components/shared"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { useEmployee } from "../hooks/useEmployees"
import type { Employee } from "@/types/hr"
import { EmployeeDrawer } from "./EmployeeDrawer"
import { formatCurrency } from "@/lib/money"

interface EmployeeDetailClientProps {
    employeeId: string
}

export function EmployeeDetailClient({ employeeId }: EmployeeDetailClientProps) {
    const router = useRouter()
    const [modalOpen, setModalOpen] = useState(false)

    const { data: employee, isLoading: loading, error: queryError, refetch: fetchEmployee } = useEmployee(employeeId)

    const error = queryError ? (queryError as any).response?.status || 500 : null

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar empleado
        </div>
    )

    if (loading || !employee) {
         return (
             <div className="flex-1 p-8">
                 <SkeletonShell isLoading={loading || !employee} ariaLabel="Cargando detalle de empleado" />
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
                        <p className="font-semibold">{formatCurrency(parseFloat(String(employee.base_salary)))}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Tipo de Contrato</p>
                        <p className="font-semibold">{employee.contract_type}</p>
                    </div>
                </div>
                
                <EmployeeDrawer 
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
