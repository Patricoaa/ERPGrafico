"use client"

import { useMemo } from "react"
import { useServerGroups } from "@/hooks/useServerGroups"
import { toGroupParams } from "@/lib/server-groups"
import { treasuryApi } from "../api/treasuryApi"
import type { TreasuryMovement, TreasuryMovementFilters } from "../types"
import { MOVEMENTS_KEYS } from "./queryKeys"
import { movementListParams } from "./useTreasuryMovements"

const fetchGroups = (params: Record<string, string>) => treasuryApi.getMovementGroups(params, params.group_by)
const fetchRows = (params: Record<string, string>, page: number, pageSize: number) => treasuryApi.getMovements({ ...params, page, page_size: pageSize })

/**
 * Treasury movements grouped on the server (ADR-0158 §7). `filters` are the ones the view hands
 * `useTreasuryMovements`: they go through the same `movementListParams`, so groups and rows match.
 */
export function useTreasuryMovementGroups({ groupKey, filters }: { groupKey: string | null; filters: TreasuryMovementFilters }) {
    const key = JSON.stringify(toGroupParams(movementListParams(filters)))
    const params = useMemo(() => JSON.parse(key) as Record<string, string>, [key])
    return useServerGroups<TreasuryMovement>({ groupKey, params, queryKey: MOVEMENTS_KEYS.all, fetchGroups, fetchRows })
}
