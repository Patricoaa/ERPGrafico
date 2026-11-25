"use client"

import { useServerGroups } from "@/hooks/useServerGroups"
import { salesApi } from "../api/salesApi"
import type { SaleNote } from "../types"
import { SALES_KEYS } from "./queryKeys"

const fetchGroups = (params: Record<string, string>) => salesApi.getSalesNoteGroups(params, params.group_by)
const fetchRows = (params: Record<string, string>, page: number, pageSize: number) => salesApi.getSalesNotes({ ...params, page, page_size: pageSize })

/** Sale credit / debit notes grouped on the server (ADR-0158 §7). */
export function useSaleNoteGroups({ groupKey, params }: { groupKey: string | null; params: Record<string, string> }) {
    return useServerGroups<SaleNote>({ groupKey, params, queryKey: [...SALES_KEYS.all, "notes"], fetchGroups, fetchRows })
}
