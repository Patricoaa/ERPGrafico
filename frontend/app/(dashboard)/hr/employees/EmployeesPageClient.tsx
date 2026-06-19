"use client"

import type { Employee } from "@/types/hr"
import { EmployeeListView } from "@/features/hr"

interface EmployeesPageClientProps {
    initialEmployees?: Employee[]
}

export default function EmployeesPageClient({ initialEmployees }: EmployeesPageClientProps) {
    return <EmployeeListView initialEmployees={initialEmployees} />
}
