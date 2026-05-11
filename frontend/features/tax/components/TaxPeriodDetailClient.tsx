"use client"

import React, { useState, useEffect } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage, FormSkeleton, FormFooter, CancelButton } from "@/components/shared"
import api from "@/lib/api"
import { StatusBadge } from "@/components/shared/StatusBadge"

interface TaxPeriodDetailClientProps {
    periodId: string
}

export function TaxPeriodDetailClient({ periodId }: TaxPeriodDetailClientProps) {
    const router = useRouter()
    const [period, setPeriod] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)

    useEffect(() => {
        const fetchPeriod = async () => {
            try {
                const response = await api.get(`/tax/periods/${periodId}/`)
                setPeriod(response.data)
            } catch (err: any) {
                setError(err.response?.status || 500)
            } finally {
                setLoading(false)
            }
        }
        fetchPeriod()
    }, [periodId])

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar periodo tributario
        </div>
    )

    if (loading || !period) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const displayId = `${period.month}/${period.year}`

    return (
        <EntityDetailPage
            entityType="tax_period"
            title="Periodo Tributario"
            displayId={displayId}
            icon="calendar"
            breadcrumb={[
                { label: "Periodos", href: "/tax/periods" },
                { label: displayId, href: `/tax/periods/${periodId}` },
            ]}
            instanceId={parseInt(periodId)}
            readonly={true}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => router.push("/tax/periods")}>Volver</CancelButton>
                        </>
                    }
                />
            }
        >
            <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Año</p>
                        <p className="font-semibold">{period.year}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Mes</p>
                        <p className="font-semibold">{period.month}</p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Estado</p>
                        <div>
                            <StatusBadge status={period.is_closed ? 'CLOSED' : 'OPEN'} size="sm" />
                        </div>
                    </div>
                </div>
            </div>
        </EntityDetailPage>
    )
}
