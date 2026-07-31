"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { ProductAnalyticsParams, ProductAnalyticsResponse } from "../analyticsTypes"
import { assignChartColors } from "@/lib/chart-colors"

export interface ProductAnalyticsData {
    analytics: ProductAnalyticsResponse | undefined
    analyticsLoading: boolean
    typePie: Array<{ id: string; value: number; color: string }>
    categoryBar: Array<{ categoria: string; productos: number }>
    priceRangeBar: Array<{ rango: string; productos: number }>
    stockValueByCategoryPie: Array<{ id: string; value: number; color: string }>
    stockValueByTypePie: Array<{ id: string; value: number; color: string }>
    topByStockValueBar: Array<{ producto: string; valor: number }>
    topByUnitsBar: Array<{ producto: string; unidades: number }>
    summary: {
        totalValue: number
        totalUnits: number
        withStock: number
        outOfStock: number
        totalProducts: number
    }
}

export function useProductAnalytics(params: ProductAnalyticsParams = {}): ProductAnalyticsData {
    const queryKey = useMemo(() => [
        "inventory",
        "products",
        "analytics",
        params.search ?? null,
        params.category ?? null,
        params.product_type ?? null,
        params.can_be_sold ?? null,
        params.can_be_purchased ?? null,
        params.is_active ?? null,
    ], [params])

    const {
        data: analytics,
        isLoading: analyticsLoading,
    } = useQuery({
        queryKey: queryKey,
        queryFn: () => inventoryApi.getProductAnalytics(params),
        staleTime: 5 * 60 * 1000,
    })

    return useMemo(() => {
        const typePie = assignChartColors(
            (analytics?.catalog_type_distribution ?? []).map(d => ({ id: d.label, value: d.value })),
        )
        const categoryBar = (analytics?.catalog_category_distribution ?? []).map(d => ({
            categoria: d.id,
            productos: d.value,
        }))
        const priceRangeBar = (analytics?.price_range_distribution ?? []).map(d => ({
            rango: d.id,
            productos: d.value,
        }))
        const stockValueByCategoryPie = assignChartColors(
            (analytics?.stock_value_by_category ?? []).map(d => ({ id: d.id, value: Number(d.value) })),
        )
        const stockValueByTypePie = assignChartColors(
            (analytics?.stock_value_by_type ?? []).map(d => ({ id: d.label, value: Number(d.value) })),
        )
        const topByStockValueBar = (analytics?.top_products_by_stock_value ?? []).map(d => ({
            producto: d.name,
            valor: Number(d.value),
        }))
        const topByUnitsBar = (analytics?.top_products_by_units ?? []).map(d => ({
            producto: d.name,
            unidades: Number(d.value),
        }))
        const summary = {
            totalValue: Number(analytics?.summary?.total_value ?? 0),
            totalUnits: Number(analytics?.summary?.total_units ?? 0),
            withStock: analytics?.summary?.with_stock ?? 0,
            outOfStock: analytics?.summary?.out_of_stock ?? 0,
            totalProducts: analytics?.summary?.total_products ?? 0,
        }

        return {
            analytics,
            analyticsLoading,
            typePie,
            categoryBar,
            priceRangeBar,
            stockValueByCategoryPie,
            stockValueByTypePie,
            topByStockValueBar,
            topByUnitsBar,
            summary,
        }
    }, [analytics, analyticsLoading])
}
