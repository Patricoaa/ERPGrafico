import type { Metadata } from "next"
import { serverFetch } from "@/lib/server-fetch"
import type { GlobalAuditLog } from "@/features/settings"
import AuditPageClient from "@/app/(dashboard)/settings/audit/AuditPageClient"

export const metadata: Metadata = {
  title: "Auditoría | Seguridad",
  description: "Trazabilidad completa de acciones y cambios en el sistema",
}

export default async function SecurityAuditPage() {
  let initialLogs: GlobalAuditLog[] | undefined
  try {
    const raw = await serverFetch<GlobalAuditLog[] | { results: GlobalAuditLog[] }>("core/audit/global/", {
      revalidate: 30,
      params: { limit: "200" },
    })
    initialLogs = Array.isArray(raw) ? raw : raw.results
  } catch {
    // Client-side fetch handles fallback
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <AuditPageClient initialLogs={initialLogs} />
    </div>
  )
}
