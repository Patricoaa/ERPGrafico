"use client"

import { useQuery } from "@tanstack/react-query"
import { TREASURY_ACCOUNTS_KEYS } from "@/features/treasury"
import { settingsApi } from "../api/settingsApi"
import type { TreasuryAccount } from "../api/types"
import { staleTime } from '@/lib/query-config'

export function useTreasuryAccounts(enabled = true) {
    return useQuery<TreasuryAccount[]>({
        queryKey: TREASURY_ACCOUNTS_KEYS.all,
        queryFn: settingsApi.getTreasuryAccounts,
        staleTime: staleTime.slow,
        enabled,
    })
}
