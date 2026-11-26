"use client"

import type { Invoice } from "@/features/billing"
import { useServerGroups } from "@/hooks/useServerGroups"
import { purchasingApi } from "../api/purchasingApi"
import { PURCHASING_KEYS } from "./queryKeys"

const fetchGroups = (params: Record<string, string>) => purchasingApi.getNoteGroups(params, params.group_by)
const fetchRows = (params: Record<string, string>, page: number, pageSize: number) => purchasingApi.getNotes({ filters: params, page, page_size: pageSize })

/** Purchase credit / debit notes grouped on the server (ADR-0158 §7). */
export function usePurchaseNoteGroups({ groupKey, params }: { groupKey: string | null; params: Record<string, string> }) {
    return useServerGroups<Invoice>({ groupKey, params, queryKey: [...PURCHASING_KEYS.all, "notes"], fetchGroups, fetchRows })
}
