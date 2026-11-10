"use client"

import { UserRoundCheck } from "lucide-react"
import { EmptyState, SectionHeader, Skeleton } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { formatDateWith, formatTimeWith } from "@/lib/utils"
import { useSaleOrderTracking } from "../hooks/useSaleOrderTracking"

interface SaleOrderTrackingPanelProps {
    orderId: number
}

/**
 * Seguimiento de una venta: línea de tiempo con el paso, el operador y la fecha. Si la cuenta
 * del dispositivo difiere del operador (caja compartida) se muestra aparte. Es un registro de
 * buena fe: sin PIN, cualquiera pudo elegir otro nombre.
 */
export function SaleOrderTrackingPanel({ orderId }: SaleOrderTrackingPanelProps) {
    const { data, isLoading, isError, refetch } = useSaleOrderTracking(orderId)

    return (
        <section className="space-y-3 p-4" aria-label="Seguimiento de la venta">
            <SectionHeader icon={UserRoundCheck} title="Seguimiento" count={data?.length} />
            {isLoading ? (
                <div role="status" aria-label="Cargando seguimiento" className="space-y-2">
                    {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
            ) : isError ? (
                <div className="flex flex-col items-start gap-2">
                    <p className="text-sm text-muted-foreground">No se pudo cargar el seguimiento.</p>
                    <Button variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button>
                </div>
            ) : !data || data.length === 0 ? (
                <EmptyState variant="compact" title="Sin seguimiento" description="Esta venta no registró operadores por paso." />
            ) : (
                <ol className="divide-y divide-border rounded-md border">
                    {data.map((event, index) => (
                        <li key={`${event.step}-${event.occurred_at}-${index}`} className="flex items-baseline justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">{event.step_display}</p>
                                <p className="truncate text-sm text-muted-foreground">
                                    {event.operator_name}
                                    {event.device_user_name !== event.operator_name && ` · caja de ${event.device_user_name}`}
                                </p>
                            </div>
                            <time dateTime={event.occurred_at} className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {formatDateWith(event.occurred_at, { day: "2-digit", month: "2-digit", year: "numeric" })} {formatTimeWith(new Date(event.occurred_at))}
                            </time>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    )
}
