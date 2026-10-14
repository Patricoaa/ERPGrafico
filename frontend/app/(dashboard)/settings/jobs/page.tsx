import JobsView from "./JobsView"
import { type Metadata } from "next"

export const metadata: Metadata = {
    title: "Procesos en Segundo Plano | Configuración",
    description: "Gestión de trabajos asíncronos como exportaciones e importaciones masivas",
}

export default function JobsPage() {
    return (
        <div className="flex-1 min-h-0 flex flex-col space-y-6">
            <JobsView />
        </div>
    )
}
