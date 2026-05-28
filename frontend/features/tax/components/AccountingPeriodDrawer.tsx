"use client"

import { Drawer, SkeletonShell, StatusBadge } from "@/components/shared"
import { Calendar } from "lucide-react"
import { useTaxPeriod } from "../hooks/useTaxQueries"

interface AccountingPeriodDrawerProps {
    periodId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function AccountingPeriodDrawer({ periodId, open, onOpenChange }: AccountingPeriodDrawerProps) {
    const { data: period, isLoading } = useTaxPeriod(periodId ?? undefined)

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            boundary="embedded"
            defaultSize="45%"
            title={period ? `Período ${period.month_display || period.id}` : "Período Contable"}
            icon={Calendar}
        >
            {isLoading ? (
                <SkeletonShell isLoading={true} ariaLabel="Cargando período" />
            ) : period ? (
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Mes</span>
                            <p className="font-medium">{period.month_display}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Año</span>
                            <p className="font-medium">{period.year}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Estado</span>
                            <p><StatusBadge status={period.status} /></p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Período Tributario</span>
                            <p className="font-medium">{period.tax_period_display || "—"}</p>
                        </div>
                    </div>
                </div>
            ) : null}
        </Drawer>
    )
}
