"use client"

import { useServerGroups } from "@/hooks/useServerGroups"
import { salesApi } from "../api/salesApi"
import type { SaleOrder, SaleOrderFilters } from "../types"
import { SALES_KEYS } from "./queryKeys"

const fetchGroups = (params: Record<string, string>) => salesApi.getOrderGroups(params as SaleOrderFilters, params.group_by)
const fetchRows = (params: Record<string, string>, page: number, pageSize: number) => salesApi.getOrders({ ...(params as SaleOrderFilters), page, page_size: pageSize })

/**
 * Sale orders grouped on the server (ADR-0158 §7): `groups/` for the groups of the whole filtered
 * list, the order list for each open group's rows. `groupKey` comes from `useCollectionQuery`.
 */
export function useSaleOrderGroups({ groupKey, params }: { groupKey: string | null; params: Record<string, string> }) {
    return useServerGroups<SaleOrder>({
        groupKey,
        params,
        queryKey: [...SALES_KEYS.all, "orders"],
        fetchGroups,
        fetchRows,
    })
}
