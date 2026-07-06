"use client"

import { Drawer, SkeletonShell, StatusBadge } from "@/components/shared"
import { useDrawerIdentity } from "@/features/_shared/drawer"
import { useF29Detail } from "../hooks/useTaxQueries"
import { formDrawerWidth } from "@/lib/form-widths"

interface F29DeclarationDrawerProps {
    declarationId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function F29DeclarationDrawer({ declarationId, open, onOpenChange }: F29DeclarationDrawerProps) {
    const { data: declaration, isLoading } = useF29Detail(declarationId ?? undefined)

    const identity = useDrawerIdentity('tax.f29declaration', 'view', declaration, {
        customTitle: declaration ? `Declaración F29 — ${declaration.period_display || declaration.id}` : "Declaración F29",
    })

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            boundary="embedded"
            mode="view"
            defaultSize={formDrawerWidth("master", false)}
            icon={identity.icon}
            title={identity.title}
        >
            {isLoading ? (
                <SkeletonShell isLoading={true} ariaLabel="Cargando declaración" />
            ) : declaration ? (
                <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-muted-foreground">Período</span>
                            <p className="font-medium">{declaration.period_display}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Estado</span>
                            <p><StatusBadge status={declaration.is_registered ? "POSTED" : "DRAFT"} /></p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Fecha de Registro</span>
                            <p className="font-medium">{declaration.declaration_date || "—"}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Asiento Contable</span>
                            <p className="font-medium">{declaration.journal_entry || "—"}</p>
                        </div>
                    </div>
                </div>
            ) : null}
        </Drawer>
    )
}
