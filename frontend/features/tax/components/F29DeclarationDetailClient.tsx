"use client"

import React from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, SkeletonShell, FormFooter, CancelButton } from "@/components/shared"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useF29Detail } from "../hooks"

interface F29DeclarationDetailClientProps {
    f29Id: string
}

export function F29DeclarationDetailClient({ f29Id }: F29DeclarationDetailClientProps) {
    const router = useRouter()
    const { data: declaration, isLoading, error: queryError } = useF29Detail(f29Id)

    const errorStatus = queryError
        ? ((queryError as { response?: { status?: number } })?.response?.status ?? 500)
        : null

    if (errorStatus === 404) return notFound()
    if (errorStatus) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar declaración F29
        </div>
    )

    if (isLoading || !declaration) {
         return (
             <div className="flex-1 p-8">
                 <SkeletonShell isLoading={isLoading || !declaration} ariaLabel="Cargando detalle de declaración F29" />
             </div>
         )
     }

    const displayId = declaration.folio_number || `#${f29Id}`

    return (
        <EntityDetailPage
            entityType="f29_declaration"
            title="Declaración F29"
            displayId={displayId}
            icon="file"
            breadcrumb={[
                { label: "F29", href: "/tax/f29" },
                { label: displayId, href: `/tax/f29/${f29Id}` },
            ]}
            instanceId={parseInt(f29Id)}
            readonly={true}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push("/tax/f29")}>Volver</CancelButton>
                        </>
                    }
                />
            }
        >
            <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Folio</p>
                        <p className="font-semibold">{declaration.folio_number}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Periodo Tributario</p>
                        <p className="font-semibold">{declaration.tax_period_display || "—"}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Estado</p>
                        <div>
                            <StatusBadge status={declaration.status} size="sm" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Total a Pagar</p>
                        <p className="font-semibold">${parseFloat(declaration.total_to_pay || "0").toLocaleString("es-CL")}</p>
                    </div>
                </div>
            </div>
        </EntityDetailPage>
    )
}
