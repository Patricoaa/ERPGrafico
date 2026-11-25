"use client"

import { useServerGroups } from "@/hooks/useServerGroups"
import type { Page } from "@/lib/pagination"
import { purchasingApi } from "../api/purchasingApi"
import type { PurchaseReceipt } from "../entity-view/purchaseReceipt.entity"
import type { PurchaseReturn } from "../entity-view/purchaseReturn.entity"
import { PURCHASING_KEYS } from "./queryKeys"

interface GroupsArgs {
    groupKey: string | null
    params: Record<string, string>
}

const receiptGroups = (params: Record<string, string>) => purchasingApi.getReceiptGroups(params, params.group_by)
const receiptRows = async (params: Record<string, string>, page: number, pageSize: number) =>
    (await purchasingApi.getReceiptsPaginated({ ...params, page, page_size: pageSize })) as unknown as Page<PurchaseReceipt>
const returnGroups = (params: Record<string, string>) => purchasingApi.getReturnGroups(params, params.group_by)
const returnRows = async (params: Record<string, string>, page: number, pageSize: number) =>
    (await purchasingApi.getReturnsPaginated({ ...params, page, page_size: pageSize })) as unknown as Page<PurchaseReturn>

/** Purchase receipts grouped on the server (ADR-0158 §7). */
export function usePurchaseReceiptGroups({ groupKey, params }: GroupsArgs) {
    return useServerGroups<PurchaseReceipt>({ groupKey, params, queryKey: [...PURCHASING_KEYS.all, "receipts"], fetchGroups: receiptGroups, fetchRows: receiptRows })
}

/** Purchase returns grouped on the server (ADR-0158 §7). */
export function usePurchaseReturnGroups({ groupKey, params }: GroupsArgs) {
    return useServerGroups<PurchaseReturn>({ groupKey, params, queryKey: [...PURCHASING_KEYS.all, "returns"], fetchGroups: returnGroups, fetchRows: returnRows })
}
