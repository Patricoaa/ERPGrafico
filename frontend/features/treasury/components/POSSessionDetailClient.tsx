"use client"

import React, { useState, useEffect } from "react"
import { notFound } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormSkeleton } from "@/components/shared"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { formatPlainDate } from "@/lib/utils"
import { User, Calendar, Clock, Monitor, Wallet } from "lucide-react"

interface POSSessionDetailClientProps {
    sessionId: string
}

interface POSSessionData {
    id: number
    user_name: string
    terminal_name?: string
    treasury_account_name?: string
    status: string
    status_display: string
    opened_at: string
    closed_at: string | null
    opening_balance: number
    total_cash_sales: number
    total_card_sales: number
    total_transfer_sales: number
    total_credit_sales: number
    total_other_cash_inflow: number
    total_other_cash_outflow: number
    expected_cash: number
    notes?: string
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between items-start py-3 border-b border-border/50 last:border-0">
            <span className="text-sm text-muted-foreground font-medium">{label}</span>
            <span className="text-sm font-semibold text-right max-w-[60%]">{value}</span>
        </div>
    )
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
            <Icon className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-primary">{title}</h3>
        </div>
    )
}

export function POSSessionDetailClient({ sessionId }: POSSessionDetailClientProps) {
    const [data, setData] = useState<POSSessionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<number | null>(null)

    useEffect(() => {
        api.get(`/treasury/pos-sessions/${sessionId}/`)
            .then(res => setData(res.data))
            .catch(err => setError(err.response?.status || 500))
            .finally(() => setLoading(false))
    }, [sessionId])

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar la sesión
        </div>
    )

    if (loading || !data) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const displayId = `SES-${String(data.id).padStart(6, "0")}`

    return (
        <EntityDetailPage
            entityType="payment" // closest available; sidebar suppressed below
            title="Sesión de Caja POS"
            displayId={displayId}
            icon="calculator"
            breadcrumb={[
                { label: "Sesiones POS", href: "/sales/sessions" },
                { label: displayId, href: `/treasury/sessions/${sessionId}` },
            ]}
            instanceId={data.id}
            readonly={true}
            sidebar={null}
        >
            <div className="max-w-3xl mx-auto w-full space-y-2">
                {/* Status banner */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20 mb-4">
                    <span className="text-sm font-medium text-muted-foreground">Estado de la sesión</span>
                    <StatusBadge status={data.status} />
                </div>

                {/* General info */}
                <SectionTitle icon={User} title="Información General" />
                <div className="rounded-lg border bg-card overflow-hidden">
                    <DetailRow label="Cajero" value={data.user_name} />
                    {data.terminal_name && (
                        <DetailRow label="Terminal" value={data.terminal_name} />
                    )}
                    {data.treasury_account_name && (
                        <DetailRow label="Caja / Cuenta" value={data.treasury_account_name} />
                    )}
                </div>

                {/* Timing */}
                <SectionTitle icon={Calendar} title="Tiempos" />
                <div className="rounded-lg border bg-card overflow-hidden">
                    <DetailRow
                        label="Apertura"
                        value={data.opened_at ? new Date(data.opened_at).toLocaleString("es-CL") : "—"}
                    />
                    <DetailRow
                        label="Cierre"
                        value={data.closed_at ? new Date(data.closed_at).toLocaleString("es-CL") : <span className="text-success font-bold">Abierta</span>}
                    />
                </div>

                {/* Cash summary */}
                <SectionTitle icon={Wallet} title="Resumen de Caja" />
                <div className="rounded-lg border bg-card overflow-hidden">
                    <DetailRow
                        label="Fondo Inicial"
                        value={<MoneyDisplay amount={data.opening_balance} />}
                    />
                    <DetailRow
                        label="Ventas Efectivo"
                        value={<MoneyDisplay amount={data.total_cash_sales} />}
                    />
                    <DetailRow
                        label="Ventas Tarjeta"
                        value={<MoneyDisplay amount={data.total_card_sales} />}
                    />
                    <DetailRow
                        label="Ventas Transferencia"
                        value={<MoneyDisplay amount={data.total_transfer_sales} />}
                    />
                    <DetailRow
                        label="Ventas Crédito"
                        value={<MoneyDisplay amount={data.total_credit_sales} />}
                    />
                    <DetailRow
                        label="Otros Ingresos"
                        value={<MoneyDisplay amount={data.total_other_cash_inflow} />}
                    />
                    <DetailRow
                        label="Egresos de Caja"
                        value={<MoneyDisplay amount={data.total_other_cash_outflow} />}
                    />
                    <div className="flex justify-between items-center py-3 px-0 bg-muted/30">
                        <span className="text-sm font-black text-foreground">Efectivo Esperado</span>
                        <span className="text-base font-black text-primary">
                            <MoneyDisplay amount={data.expected_cash} />
                        </span>
                    </div>
                </div>

                {data.notes && (
                    <>
                        <SectionTitle icon={Clock} title="Notas" />
                        <div className="rounded-lg border bg-card p-4">
                            <p className="text-sm text-muted-foreground">{data.notes}</p>
                        </div>
                    </>
                )}
            </div>
        </EntityDetailPage>
    )
}
