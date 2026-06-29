import JobsPageClient from "./JobsPageClient"
import { PageSectionHeader } from "@/components/shared"
import { type Metadata } from "next"

export const metadata: Metadata = {
    title: "Procesos en Segundo Plano | Configuración",
    description: "Gestión de trabajos asíncronos como exportaciones e importaciones masivas",
}

export default function JobsPage() {
    return (
        <div className="space-y-6">
            <PageSectionHeader 
                title="Procesos en Segundo Plano" 
                description="Visualice el progreso y descargue resultados de importaciones, exportaciones y reportes masivos." 
            />
            <JobsPageClient />
        </div>
    )
}
