"use client"

import { useQuery } from "@tanstack/react-query"
import { staleTime } from "@/lib/query-config"
import { useAuth } from "@/contexts/AuthContext"
import { SALES_KEYS } from "@/features/sales"
import { PURCHASING_KEYS } from "@/features/purchasing"
import { INVOICES_QUERY_KEY } from "@/features/billing"
import { ordersApi } from "../api/ordersApi"
import type { Order } from "../types"

/**
 * Datos de las fichas documentales de OV/OC y factura/nota (ADR-0083, U6: reemplaza a
 * `useOrderHubData` del Order Hub). Las claves cuelgan de los espacios de ventas, compras y
 * facturas: las invalidaciones de las mutaciones existentes refrescan la ficha sin código extra.
 * Los permisos salen de AuthContext (misma fuente `/auth/user/` que usaba el Hub).
 */
function usePermissions(): string[] {
    const { user } = useAuth()
    return user?.permissions ?? []
}

export function useOrderDocument(id: number | null, kind: "sale" | "purchase", enabled = true) {
    const permissions = usePermissions()
    const query = useQuery({
        queryKey: [...(kind === "sale" ? SALES_KEYS.all : PURCHASING_KEYS.all), "document-sheet", id] as const,
        queryFn: async () => (kind === "sale" ? ordersApi.getSaleOrder(id as number) : ordersApi.getPurchaseOrder(id as number)) as Promise<Order>,
        staleTime: staleTime.volatile,
        enabled: enabled && !!id,
    })
    return { order: query.data ?? null, permissions, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch }
}

export function useInvoiceDocument(id: number | null, enabled = true) {
    const permissions = usePermissions()
    const query = useQuery({
        queryKey: [...INVOICES_QUERY_KEY, "document-sheet", id] as const,
        queryFn: async () => ordersApi.getInvoice(id as number) as Promise<Order>,
        staleTime: staleTime.volatile,
        enabled: enabled && !!id,
    })
    return { invoice: query.data ?? null, permissions, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch }
}
