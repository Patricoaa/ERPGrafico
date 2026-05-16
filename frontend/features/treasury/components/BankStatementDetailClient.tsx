"use client"

import React from "react"
import { useQuery } from "@tanstack/react-query"
import { notFound } from "next/navigation"
import api from "@/lib/api"
import { EntityDetailPage, FormSkeleton } from "@/components/shared"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { Landmark, Calendar, FileText, BarChart3 } from "lucide-react"

interface BankStatementDetailClientProps {
    statementId: string
}

interface BankStatementData {
    id: number
    display_id: string
    treasury_account_name: string
    treasury_account: number
    statement_date: string
    period_start: string | null
    period_end: string | null
    opening_balance: number | string
    closing_balance: number | string
    status: string
    bank_format: string
    total_lines: number
    reconciled_lines: number
    reconciliation_progress: number
    notes?: string
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between items-center py-3 border-b border-border/50 last:border-0">
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

function ProgressBar({ value }: { value: number }) {
    return (
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
                className="h-2 rounded-full bg-success transition-all"
                style={{ width: `${Math.min(100, value)}%` }}
            />
        </div>
    )
}

export function BankStatementDetailClient({ statementId }: BankStatementDetailClientProps) {
    const { data: data, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['bankStatement', statementId],
        queryFn: async () => {
            const res = await api.get(`/treasury/statements/${statementId}/`)
            return res.data
        }
    })

    const error = queryError ? (queryError as any).response?.status || 500 : null

    if (error === 404) return notFound()
    if (error) return (
        <div className="flex-1 flex items-center justify-center p-8 text-destructive text-sm">
            Error al cargar la cartola
        </div>
    )

    if (loading || !data) {
        return (
            <div className="flex-1 p-8">
                <FormSkeleton />
            </div>
        )
    }

    const displayId = formatEntityDisplay('treasury.bankstatement', data)
    const openingBalance = typeof data.opening_balance === "string"
        ? parseFloat(data.opening_balance)
        : data.opening_balance
    const closingBalance = typeof data.closing_balance === "string"
        ? parseFloat(data.closing_balance)
        : data.closing_balance

    return (
        <EntityDetailPage
            entityLabel="treasury.treasurymovement"
            // closest available; sidebar suppressed below
            displayId={displayId}
            breadcrumb={[
                { label: "Conciliación", href: "/treasury/reconciliation" },
                { label: displayId, href: `/treasury/statements/${statementId}` },
            ]}
            instanceId={data.id}
            readonly={true}
            sidebar={null}
        >
            <div className="max-w-3xl mx-auto w-full space-y-2">
                {/* Status banner */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20 mb-4">
                    <span className="text-sm font-medium text-muted-foreground">Estado de la cartola</span>
                    <StatusBadge status={data.status} size="md" />
                </div>

                {/* Account & dates */}
                <SectionTitle icon={Landmark} title="Cuenta e Identificación" />
                <div className="rounded-lg border bg-card overflow-hidden">
                    <DetailRow label="Cuenta de Tesorería" value={data.treasury_account_name} />
                    <DetailRow label="Formato Bancario" value={<span className="font-mono text-xs">{data.bank_format}</span>} />
                </div>

                <SectionTitle icon={Calendar} title="Período" />
                <div className="rounded-lg border bg-card overflow-hidden">
                    <DetailRow
                        label="Fecha de Cartola"
                        value={new Date(data.statement_date + "T00:00:00").toLocaleDateString("es-CL")}
                    />
                    {data.period_start && (
                        <DetailRow
                            label="Inicio del Período"
                            value={new Date(data.period_start + "T00:00:00").toLocaleDateString("es-CL")}
                        />
                    )}
                    {data.period_end && (
                        <DetailRow
                            label="Fin del Período"
                            value={new Date(data.period_end + "T00:00:00").toLocaleDateString("es-CL")}
                        />
                    )}
                </div>

                {/* Balances */}
                <SectionTitle icon={FileText} title="Saldos" />
                <div className="rounded-lg border bg-card overflow-hidden">
                    <DetailRow label="Balance de Apertura" value={<MoneyDisplay amount={openingBalance} />} />
                    <DetailRow label="Balance de Cierre" value={<MoneyDisplay amount={closingBalance} />} />
                    <DetailRow
                        label="Variación"
                        value={
                            <span className={closingBalance >= openingBalance ? "text-success font-bold" : "text-destructive font-bold"}>
                                <MoneyDisplay amount={closingBalance - openingBalance} />
                            </span>
                        }
                    />
                </div>

                {/* Reconciliation progress */}
                <SectionTitle icon={BarChart3} title="Conciliación" />
                <div className="rounded-lg border bg-card p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Líneas conciliadas</span>
                        <span className="font-bold">
                            {data.reconciled_lines} / {data.total_lines}
                        </span>
                    </div>
                    <ProgressBar value={data.reconciliation_progress} />
                    <p className="text-xs text-muted-foreground text-right">
                        {data.reconciliation_progress}% completado
                    </p>
                </div>

                {data.notes && (
                    <>
                        <SectionTitle icon={FileText} title="Notas" />
                        <div className="rounded-lg border bg-card p-4">
                            <p className="text-sm text-muted-foreground">{data.notes}</p>
                        </div>
                    </>
                )}
            </div>
        </EntityDetailPage>
    )
}
