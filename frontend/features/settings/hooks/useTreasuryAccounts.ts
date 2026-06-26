"use client"

import { useQuery } from "@tanstack/react-query"
import { settingsApi } from "../api/settingsApi"
import type { TreasuryAccount } from "../api/types"

export const TREASURY_ACCOUNTS_QUERY_KEY = ["treasuryAccounts"]

export function useTreasuryAccounts(enabled = true) {
    return useQuery<TreasuryAccount[]>({
        queryKey: TREASURY_ACCOUNTS_QUERY_KEY,
        queryFn: settingsApi.getTreasuryAccounts,
        staleTime: 10 * 60 * 1000,
        enabled,
    })
}
