"use client"

import { useMemo } from "react"
import type { FilterState } from "@/components/shared"
import { useServerGroups } from "@/hooks/useServerGroups"
import type { Page } from "@/lib/pagination"
import { toGroupParams } from "@/lib/server-groups"
import { accountingApi } from "../api/accountingApi"
import { JOURNAL_ENTRIES_QUERY_KEY } from "./queryKeys"
import { journalEntryListParams, type JournalEntry } from "./useJournalEntries"

const fetchGroups = (params: Record<string, string>) => accountingApi.getEntryGroups(params, params.group_by)
const fetchRows = async (params: Record<string, string>, page: number, pageSize: number) =>
    (await accountingApi.getEntries({ ...params, page, page_size: pageSize })) as Page<JournalEntry>

/** Journal entries grouped on the server by status or day (ADR-0158 §7). */
export function useJournalEntryGroups({ groupKey, filters }: { groupKey: string | null; filters: Record<string, string> }) {
    const key = JSON.stringify(toGroupParams(journalEntryListParams(filters as FilterState)))
    const params = useMemo(() => JSON.parse(key) as Record<string, string>, [key])
    return useServerGroups<JournalEntry>({ groupKey, params, queryKey: JOURNAL_ENTRIES_QUERY_KEY, fetchGroups, fetchRows })
}
