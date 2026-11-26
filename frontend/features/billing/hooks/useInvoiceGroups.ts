"use client"

import { useServerGroups } from "@/hooks/useServerGroups"
import { billingApi } from "../api/billingApi"
import type { Invoice, InvoiceFilters } from "../types"
import { INVOICES_KEYS, PURCHASE_INVOICES_KEYS } from "./queryKeys"

type Mode = NonNullable<InvoiceFilters["mode"]>

const fetchers = (mode: Mode) => ({
    fetchGroups: (params: Record<string, string>) => billingApi.getInvoiceGroups({ ...params, mode }, params.group_by),
    fetchRows: (params: Record<string, string>, page: number, pageSize: number) => billingApi.getInvoices({ ...params, mode, page, page_size: pageSize }),
})
const SALE = fetchers("sale")
const PURCHASE = fetchers("purchase")

/** Sale or purchase invoices grouped on the server (ADR-0158 §7). */
export function useInvoiceGroups({ groupKey, params, mode }: { groupKey: string | null; params: Record<string, string>; mode: Mode }) {
    return useServerGroups<Invoice>({
        groupKey,
        params,
        queryKey: mode === "purchase" ? PURCHASE_INVOICES_KEYS.all : INVOICES_KEYS.all,
        ...(mode === "purchase" ? PURCHASE : SALE),
    })
}
