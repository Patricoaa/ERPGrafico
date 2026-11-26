"use client"

import { useMemo } from "react"
import { useServerGroups } from "@/hooks/useServerGroups"
import type { Page } from "@/lib/pagination"
import { toGroupParams } from "@/lib/server-groups"
import { inventoryApi } from "../api/inventoryApi"
import type { InventoryDocument, InventoryDocumentFilters, Product, ProductFilters } from "../types"
import { INVENTORY_DOCUMENTS_QUERY_KEY } from "./useInventoryDocuments"
import { fetchStockMoves, STOCK_MOVES_QUERY_KEY, type StockMove } from "./useStockMoves"
import { PRODUCTS_KEYS } from "./queryKeys"

interface GroupsArgs<F> {
    groupKey: string | null
    /** The filters the view hands its list hook (no paging), so groups and rows match. */
    filters: F
}

/** Typed filters → stable text params (value-equal filters keep the same object). */
function useParams(filters: object): Record<string, string> {
    const key = JSON.stringify(toGroupParams(filters))
    return useMemo(() => JSON.parse(key) as Record<string, string>, [key])
}

const productGroups = (params: Record<string, string>) => inventoryApi.getProductGroups(params as ProductFilters, params.group_by)
const productRows = (params: Record<string, string>, page: number, pageSize: number): Promise<Page<Product>> =>
    inventoryApi.getProducts({ ...(params as ProductFilters), page, page_size: pageSize })

const documentGroups = (params: Record<string, string>) => inventoryApi.getInventoryDocumentGroups(params as InventoryDocumentFilters, params.group_by)
const documentRows = (params: Record<string, string>, page: number, pageSize: number): Promise<Page<InventoryDocument>> =>
    inventoryApi.getInventoryDocuments({ ...(params as InventoryDocumentFilters), page, page_size: pageSize })

const moveGroups = (params: Record<string, string>) => inventoryApi.getStockMoveGroups(params)
const moveRows = (params: Record<string, string>, page: number, pageSize: number) => fetchStockMoves(params, page, pageSize)

/** Products grouped on the server by type or category (ADR-0158 §7). */
export function useProductGroups({ groupKey, filters }: GroupsArgs<ProductFilters>) {
    const params = useParams(filters)
    return useServerGroups<Product>({ groupKey, params, queryKey: PRODUCTS_KEYS.all, fetchGroups: productGroups, fetchRows: productRows })
}

/** Inventory documents grouped on the server (ADR-0158 §7). */
export function useInventoryDocumentGroups({ groupKey, filters }: GroupsArgs<InventoryDocumentFilters>) {
    const params = useParams(filters)
    return useServerGroups<InventoryDocument>({ groupKey, params, queryKey: INVENTORY_DOCUMENTS_QUERY_KEY, fetchGroups: documentGroups, fetchRows: documentRows })
}

/** Stock moves grouped on the server by day or product (ADR-0158 §7). */
export function useStockMoveGroups({ groupKey, filters }: GroupsArgs<Record<string, string>>) {
    const params = useParams(filters)
    return useServerGroups<StockMove>({ groupKey, params, queryKey: STOCK_MOVES_QUERY_KEY, fetchGroups: moveGroups, fetchRows: moveRows })
}
