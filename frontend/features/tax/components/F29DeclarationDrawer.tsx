"use client"

import { Drawer, SkeletonShell, StatusBadge } from "@/components/shared"
import { FileText } from "lucide-react"
import { useF29Detail } from "../hooks/useTaxQueries"

interface F29DeclarationDrawerProps {
    declarationId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function F29DeclarationDrawer({ declarationId, open, onOpenChange }: F29DeclarationDrawerProps) {
    const { data: declaration, isLoading } = useF29Detail(declarationId ?? undefined)

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            boundary="embedded"
            defaultSize="50%"
            title={declaration ? `Declaración F29 — ${declaration.period_display || declaration.id}` : "Declaración F29"}
            icon={FileText}
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
