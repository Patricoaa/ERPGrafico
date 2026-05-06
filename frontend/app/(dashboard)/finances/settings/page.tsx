"use client"

import { EmptyState } from "@/components/shared"
import { Settings } from "lucide-react"

export default function FinancesSettingsPage() {
    return (
        <div className="pt-8">
            <EmptyState
                icon={Settings}
                title="Configuración de Finanzas"
                description="Próximamente: Períodos fiscales, centros de costo y reglas de consolidación."
                variant="full"
                context="generic"
            />
        </div>
    )
}
