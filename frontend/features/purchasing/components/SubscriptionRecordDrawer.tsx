"use client"

import { SkeletonShell } from "@/components/shared"
import { ProductDrawerById } from "@/features/inventory"
import { useRecordById } from "@/hooks/useRecordById"
import type { Subscription } from "../hooks/useSubscriptions"

interface SubscriptionRecordDrawerProps {
    id: number
    /** Fila de la lista, si el llamador ya la tiene (evita la consulta). */
    data?: unknown
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

/**
 * Una suscripción se edita en la ficha de su producto (ADR-0152): resuelve el producto de la suscripción
 * (de la fila o por id) y abre `ProductDrawerById`. El historial sigue siendo un modal sobre la lista.
 */
export function SubscriptionRecordDrawer({ id, data, open, onOpenChange, onSuccess }: SubscriptionRecordDrawerProps) {
    const { record, isError } = useRecordById<Subscription>("/inventory/subscriptions", data ? null : id)
    const subscription = (data as Subscription | undefined) ?? record
    if (!subscription) return isError ? null : <SkeletonShell isLoading ariaLabel="Cargando suscripción" />
    return <ProductDrawerById id={subscription.product} open={open} onOpenChange={onOpenChange} onSuccess={onSuccess} />
}
