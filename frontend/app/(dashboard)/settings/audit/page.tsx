import { serverFetch } from "@/lib/server-fetch"
import type { GlobalAuditLog } from "@/features/settings"
import AuditPageClient from "./AuditPageClient"

export default async function AuditHubPage() {
    let initialLogs: GlobalAuditLog[] | undefined
    try {
        const raw = await serverFetch<GlobalAuditLog[] | { results: GlobalAuditLog[] }>('core/audit/global/', {
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
        </div>)
}
