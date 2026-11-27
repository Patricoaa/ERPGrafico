import type { Metadata } from "next"
import JobsView from "@/app/(dashboard)/settings/jobs/JobsView"

export const metadata: Metadata = {
  title: "Procesos en Segundo Plano | Seguridad",
  description: "Gestión de tareas asíncronas como exportaciones e importaciones masivas",
}

export default function SecurityJobsPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-6">
      <JobsView />
    </div>
  )
}
