"use client"

import type { Employee } from "@/types/hr"
import { EmployeeClientView } from "@/features/hr"

interface EmployeesPageClientProps {
    initialEmployees?: Employee[]
}

export default function EmployeesPageClient({ initialEmployees }: EmployeesPageClientProps) {
    return <EmployeeClientView initialEmployees={initialEmployees} />
}
