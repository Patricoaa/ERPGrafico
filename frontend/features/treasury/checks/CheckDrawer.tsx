"use client"

import { useQuery } from '@tanstack/react-query'
import { Drawer, EmptyState, MoneyDisplay, SkeletonShell, StatusBadge } from "@/components/shared"
import { getEntityIcon } from "@/lib/entity-registry"
import { checksApi } from './api'
import type { Check } from './types'
import { formDrawerWidth } from '@/lib/form-widths'

interface CheckDrawerProps {
    id: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CheckDrawer({ id, open, onOpenChange }: CheckDrawerProps) {
    const { data: check, isLoading, isError } = useQuery<Check>({
        queryKey: ['checks', 'detail', id],
        queryFn: () => checksApi.get(id as number),
        enabled: !!id && open,
    })

    return (
        <Drawer
            mode="view"
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            boundary="embedded"
            defaultSize={formDrawerWidth("master", false)}
            title={check ? `${check.display_id}` : "Cheque"}
            subtitle={check?.bank_name}
            icon={getEntityIcon('treasury.check')}
        >
            {isError ? (
                <div className="p-4">
                    <EmptyState
                        context="treasury"
                        title="Error al cargar cheque"
                        description="No se pudo cargar la información del cheque."
                    />
                </div>
            ) : (
                <SkeletonShell isLoading={isLoading} ariaLabel="Cargando cheque">
                    {check ? (
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">N° Cheque</span>
                                    <p className="font-medium">{check.check_number}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Estado</span>
                                    <p><StatusBadge status={check.status} /></p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Banco</span>
                                    <p className="font-medium">{check.bank_name}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Monto</span>
                                    <p className="font-medium"><MoneyDisplay amount={parseFloat(check.amount)} inline /></p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Emisión</span>
                                    <p>{check.issue_date}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Vencimiento</span>
                                    <p>{check.due_date}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Girador</span>
                                    <p className="font-medium">{check.counterparty_name ?? check.drawer_name ?? '—'}</p>
                                </div>
                                {check.sale_order_display && (
                                    <div>
                                        <span className="text-muted-foreground">NV Asociada</span>
                                        <p className="font-medium">NV-{check.sale_order_display.number}</p>
                                    </div>
                                )}
                            </div>
                            {check.notes && (
                                <div>
                                    <span className="text-muted-foreground text-sm">Notas</span>
                                    <p className="text-sm mt-1 whitespace-pre-wrap">{check.notes}</p>
                                </div>
                            )}
                        </div>
                    ) : null}
                </SkeletonShell>
            )}
        </Drawer>
    )
}
