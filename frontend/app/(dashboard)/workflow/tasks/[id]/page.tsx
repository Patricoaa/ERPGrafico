import { redirect } from 'next/navigation'

// T-102 (F9): workflow.Task fue eliminado del UniversalRegistry (Camino B).
// TaskInbox vive en el sidebar global del DashboardShell, no como página de ruta propia.
// El deeplink no es resoluble — redirigir al dashboard como fallback.
export default async function DetailPage({ params: _params }: { params: Promise<{ id: string }> }) {
    redirect('/')
}
