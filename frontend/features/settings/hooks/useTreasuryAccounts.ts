"use client"

import { useQuery } from "@tanstack/react-query"
import { TREASURY_ACCOUNTS_KEYS } from "@/features/treasury"
import { settingsApi } from "../api/settingsApi"
import type { TreasuryAccount } from "../api/types"

export function useTreasuryAccounts(enabled = true) {
    return useQuery<TreasuryAccount[]>({
        queryKey: TREASURY_ACCOUNTS_KEYS.all,
        queryFn: settingsApi.getTreasuryAccounts,
        staleTime: 10 * 60 * 1000,
        enabled,
    })
}
