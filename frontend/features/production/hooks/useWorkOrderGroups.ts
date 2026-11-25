"use client"

import api from "@/lib/api"
import { useServerGroups } from "@/hooks/useServerGroups"
import { toServerGroups } from "@/lib/server-groups"
import type { WorkOrder } from "@/features/production/types"
import { fetchWorkOrders, workOrderListParams, WORK_ORDERS_LIST_KEY } from "./useWorkOrders"

/** `my_tasks` arrives from the URL as text: the list params want a flag. */
const toFilters = (params: Record<string, string>) => ({ ...params, my_tasks: params.my_tasks === "true" })

async function fetchGroups(params: Record<string, string>) {
    const query = workOrderListParams(toFilters(params))
    query.append("group_by", params.group_by)
    const res = await api.get<unknown>("/production/orders/groups/", { params: query })
    return toServerGroups(res.data)
}
const fetchRows = (params: Record<string, string>, page: number, pageSize: number) => fetchWorkOrders(toFilters(params), page, pageSize)

/** Work orders grouped on the server by status or stage (ADR-0158 §7). */
export function useWorkOrderGroups({ groupKey, params }: { groupKey: string | null; params: Record<string, string> }) {
    return useServerGroups<WorkOrder>({ groupKey, params, queryKey: [WORK_ORDERS_LIST_KEY], fetchGroups, fetchRows })
}
