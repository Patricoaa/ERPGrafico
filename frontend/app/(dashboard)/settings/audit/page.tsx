import { serverFetch } from "@/lib/server-fetch"
import AuditPageClient from "./AuditPageClient"

interface GlobalAuditLog {
    date: string;
    user_name: string | null;
    entity_label: string | null;
    history_type: '+' | '~' | '-' | null;
    source: 'action_log' | 'history';
    action_type: string | null;
    type_label: string | null;
    description: string;
}

export default async function AuditHubPage() {
    let initialLogs: GlobalAuditLog[] | undefined
    try {
        initialLogs = await serverFetch<GlobalAuditLog[]>('core/audit/global/', {
            revalidate: 30,
        })
    } catch {
        // Client-side fetch handles fallback
    }

    return <AuditPageClient initialLogs={initialLogs} />
}
