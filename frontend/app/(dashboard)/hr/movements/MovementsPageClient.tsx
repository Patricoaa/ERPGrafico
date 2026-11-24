"use client"

import type { EmployeeMovement } from "@/types/hr"
import { EmployeeMovementClientView } from "@/features/hr"

interface MovementsPageClientProps {
    initialMovements?: EmployeeMovement[]
}

export default function MovementsPageClient({ initialMovements }: MovementsPageClientProps) {
    return <EmployeeMovementClientView initialMovements={initialMovements} />
}
