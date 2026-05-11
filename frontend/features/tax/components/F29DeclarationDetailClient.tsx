"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormSkeleton, FormFooter, CancelButton } from "@/components/shared"
import api from "@/lib/api"
import { StatusBadge } from "@/components/shared/StatusBadge"

interface F29DeclarationDetailClientProps {
    f29Id: string
}

export function F29DeclarationDetailClient({ f29Id }: F29DeclarationDetailClientProps) {
    const router = useRouter()
    const [declaration, setDeclaration] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)

    useEffect(() => {
        const fetchDeclaration = async () => {
            try {
                const response = await api.get(`/tax/f29/${f29Id}/`)
                setDeclaration(response.data)
            } catch (err: any) {
                setError(err.response?.status || 500)
            } finally {
                setLoading(false)
            }
        }
        fetchDeclaration()
    }, [f29Id])

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar declaración F29
        </div>
    )

    if (loading || !declaration) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
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
