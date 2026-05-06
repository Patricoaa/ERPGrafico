import { EmptyState } from "@/components/shared"
import { Settings } from "lucide-react"

export default function FinancesSettingsPage() {
    return (
        <div className="pt-8">
            <EmptyState
                icon={<Settings className="w-12 h-12 text-primary/40" />}
                title="Configuración de Finanzas"
                description="Próximamente: Períodos fiscales, centros de costo y reglas de consolidación."
                variant="full"
                context="generic"
            />
        </div>
    )
}
