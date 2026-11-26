"use client"

import { useServerGroups } from "@/hooks/useServerGroups"
import type { Page } from "@/lib/pagination"
import { salesApi } from "../api/salesApi"
import type { SaleDelivery } from "../entity-view/saleDelivery.entity"
import type { SaleReturn } from "../entity-view/saleReturn.entity"
import type { SaleFulfillment } from "../entity-view/saleFulfillment.entity"
import { SALES_KEYS } from "./queryKeys"

interface GroupsArgs {
    groupKey: string | null
    params: Record<string, string>
}

const deliveryGroups = (params: Record<string, string>) => salesApi.getDeliveryGroups(params, params.group_by)
const deliveryRows = async (params: Record<string, string>, page: number, pageSize: number) =>
    (await salesApi.getDeliveriesPaginated({ ...params, page, page_size: pageSize })) as unknown as Page<SaleDelivery>
const returnGroups = (params: Record<string, string>) => salesApi.getReturnGroups(params, params.group_by)
const returnRows = async (params: Record<string, string>, page: number, pageSize: number) =>
    (await salesApi.getReturnsPaginated({ ...params, page, page_size: pageSize })) as unknown as Page<SaleReturn>

/** Sale deliveries grouped on the server (ADR-0158 §7). */
export function useSaleDeliveryGroups({ groupKey, params }: GroupsArgs) {
    return useServerGroups<SaleDelivery>({ groupKey, params, queryKey: [...SALES_KEYS.all, "deliveries"], fetchGroups: deliveryGroups, fetchRows: deliveryRows })
}

/** Sale returns grouped on the server (ADR-0158 §7). */
export function useSaleReturnGroups({ groupKey, params }: GroupsArgs) {
    return useServerGroups<SaleReturn>({ groupKey, params, queryKey: [...SALES_KEYS.all, "returns"], fetchGroups: returnGroups, fetchRows: returnRows })
}

const fulfillmentGroups = (params: Record<string, string>) => salesApi.getFulfillmentGroups(params, params.group_by)
const fulfillmentRows = async (params: Record<string, string>, page: number, pageSize: number) =>
    (await salesApi.getFulfillmentPaginated({ ...params, page, page_size: pageSize })) as unknown as Page<SaleFulfillment>

/** Deliveries + returns grouped on the server (ADR-0158 §7). */
export function useSaleFulfillmentGroups({ groupKey, params }: GroupsArgs) {
    return useServerGroups<SaleFulfillment>({ groupKey, params, queryKey: [...SALES_KEYS.all, "fulfillment"], fetchGroups: fulfillmentGroups, fetchRows: fulfillmentRows })
}
