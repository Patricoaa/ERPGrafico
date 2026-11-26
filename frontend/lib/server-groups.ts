import { z } from "zod"

/**
 * Server grouping of a list (ADR-0158 §7, collection-toolbar §7.1): one element of
 * `GET <list>/groups/?group_by=<key>&<filters>`.
 */
export interface ServerGroup {
    /** Group value as text (`"2026-11-02"`, a pk, a choice); `null` for the rows without a value. */
    key: string | null
    /** Choice label or related name; `null` when there is none (formatted from `key` by the field kind). */
    label: string | null
    /** Rows of the whole filtered list in this group (not only the loaded ones). */
    count: number
    /** Sums by aggregate name (the entity field id), as decimal strings. */
    aggregates: Record<string, string>
    /** List params that select this group's rows; `null`: they cannot be listed (no value, no null filter). */
    params: Record<string, string> | null
}

/** Stable id of a group inside one grouping (the "no value" group has a `null` key). */
export const serverGroupId = (group: Pick<ServerGroup, "key">): string => group.key ?? "∅"

/** Runtime state of one server group in a collection: its loaded rows and controls. */
export interface ServerGroupState<T> extends ServerGroup {
    id: string
    open: boolean
    /** Rows loaded so far, in list order. */
    rows: T[]
    isLoading: boolean
    isError: boolean
    hasMore: boolean
    toggle: () => void
    showMore: () => void
}

const serverGroupSchema = z.object({
    key: z.string().nullable(),
    label: z.string().nullable(),
    count: z.number(),
    aggregates: z.record(z.string(), z.string()),
    params: z.record(z.string(), z.string()).nullable(),
})

/**
 * List filters as `groups/` params: drops empty values and writes the rest as text (`true` → `"true"`),
 * so a feature's typed filters can key and feed `useServerGroups`.
 */
export function toGroupParams(filters: object): Record<string, string> {
    return Object.fromEntries(
        Object.entries(filters)
            .filter(([, value]) => value !== undefined && value !== null && value !== "")
            .map(([key, value]) => [key, String(value)]),
    )
}

/** Parses a `groups/` response (validates the backend contract at the boundary). */
export function toServerGroups(data: unknown): ServerGroup[] {
    return z.array(serverGroupSchema).parse(data)
}
