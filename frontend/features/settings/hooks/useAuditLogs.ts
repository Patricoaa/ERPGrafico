import { useState, useEffect } from "react"
import { settingsApi } from "../api/settingsApi"

export interface GlobalAuditLog {
    date: string
    user_name: string | null
    entity_label: string | null
    history_type: "+" | "~" | "-" | null
    source: "action_log" | "history"
    action_type: string | null
    type_label: string | null
    description: string
}

export function useAuditLogs(initialLogs?: GlobalAuditLog[]) {
    const [logs, setLogs] = useState<GlobalAuditLog[]>(initialLogs ?? [])
    const [loading, setLoading] = useState(!initialLogs)

    useEffect(() => {
        if (initialLogs) return
        let cancelled = false;
        (async () => {
            try {
                const data = await settingsApi.getAuditLogs()
                if (!cancelled) setLogs(data as unknown as GlobalAuditLog[])
            } catch {
                if (!cancelled) console.error("Error fetching audit logs")
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [initialLogs])

    return { logs, loading }
}
