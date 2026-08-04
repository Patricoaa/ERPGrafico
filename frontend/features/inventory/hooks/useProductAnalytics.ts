"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventoryApi"
import type { ProductAnalyticsParams } from "../analyticsTypes"
import { assignChartColors } from "@/lib/chart-colors"

export interface ProductAnalyticsData {
    analyticsLoading: boolean
    typePie: Array<{ id: string; value: number; color: string }>
    availabilityPie: Array<{ id: string; value: number; color: string }>
    categoryPie: Array<{ id: string; value: number; color: string }>
    priceRangeBar: Array<{ rango: string; productos: number }>
    summary: {
        totalProducts: number
        withStock: number
        outOfStock: number
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
        params.price_field ?? "sale",
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
        const availabilityPie = assignChartColors(
            (analytics?.availability_distribution ?? []).map(d => ({ id: d.label, value: d.value })),
        )
        const categoryPie = assignChartColors(
            (analytics?.catalog_category_distribution ?? []).map(d => ({ id: d.id, value: d.value })),
        )
        const priceRangeBar = (analytics?.price_range_distribution ?? []).map(d => ({
            rango: d.id,
            productos: d.value,
        }))
        const summary = {
            totalProducts: analytics?.summary?.total_products ?? 0,
            withStock: analytics?.summary?.with_stock ?? 0,
            outOfStock: analytics?.summary?.out_of_stock ?? 0,
        }

        return {
            analyticsLoading,
            typePie,
            availabilityPie,
            categoryPie,
            priceRangeBar,
            summary,
        }
    }, [analytics, analyticsLoading])
}
