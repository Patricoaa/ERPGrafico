"use client"

import React, { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormSkeleton } from "@/components/shared"
import { TransactionContent } from "@/components/shared/transaction-modal/TransactionContent"
import { SidebarContent } from "@/components/shared/transaction-modal/SidebarContent"

interface TreasuryMovementDetailClientProps {
    movementId: string
}

export function TreasuryMovementDetailClient({ movementId }: TreasuryMovementDetailClientProps) {
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)

    useEffect(() => {
        api.get(`/treasury/payments/${movementId}/`)
            .then(res => setData(res.data))
            .catch(err => setError(err.response?.status || 500))
            .finally(() => setLoading(false))
    }, [movementId])

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar el movimiento
        </div>
    )

    if (loading || !data) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const displayId: string = data.display_id ?? `#${movementId}`

    return (
        <EntityDetailPage
            entityLabel="treasury.treasurymovement"
            displayId={displayId}
            breadcrumb={[
                { label: "Movimientos", href: "/treasury/movements" },
                { label: displayId, href: `/treasury/movements/${movementId}` },
            ]}
            instanceId={parseInt(movementId)}
            readonly={true}
            sidebar={null}
        >
            {/* Reuse the same TransactionViewModal layout but inline — no BaseModal wrapper */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 w-full max-w-6xl mx-auto">
                {/* Left: transaction detail (75%) */}
                <div className="flex-1 min-w-0 overflow-y-auto">
                    <TransactionContent
                        type="payment"
                        data={data}
                        view="all"
                        navigateTo={() => {/* readonly – no navigation */}}
                    />
                </div>

                {/* Right: metadata sidebar (25%) */}
                <div className="w-full lg:w-[320px] shrink-0 bg-muted/20 border-l border-border/50 overflow-y-auto">
                    <div className="p-8 lg:p-10 space-y-10">
                        <SidebarContent
                            currentType="payment"
                            data={data}
                            closeModal={() => {/* no-op in page context */}}
                        />
                    </div>
                </div>
            </div>
        </EntityDetailPage>
    )
}
