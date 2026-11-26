"use client"

import { useServerGroups } from "@/hooks/useServerGroups"
import { purchasingApi, type OrderFilters } from "../api/purchasingApi"
import type { PurchaseOrderAPI } from "../types"
import { PURCHASING_KEYS } from "./queryKeys"

const fetchGroups = (params: Record<string, string>) => purchasingApi.getOrderGroups(params as OrderFilters, params.group_by)
const fetchRows = (params: Record<string, string>, page: number, pageSize: number) => purchasingApi.getOrders({ ...(params as OrderFilters), page, page_size: pageSize })

/** Purchase orders grouped on the server (ADR-0158 §7). */
export function usePurchaseOrderGroups({ groupKey, params }: { groupKey: string | null; params: Record<string, string> }) {
    return useServerGroups<PurchaseOrderAPI>({ groupKey, params, queryKey: PURCHASING_KEYS.orders(), fetchGroups, fetchRows })
}
