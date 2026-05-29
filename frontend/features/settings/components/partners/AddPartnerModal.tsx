"use client"
import { formatCurrency } from "@/lib/money"
import { cn } from "@/lib/utils"

import { showApiError } from "@/lib/errors"
import React, { useEffect, useState, useMemo } from "react"
import { BaseModal, CancelButton, SubmitButton } from '@/components/shared'

import { DataTable, LabeledInput, LabeledContainer, PeriodValidationDateInput, DataCell } from "@/components/shared"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { Partner } from "@/features/contacts/types/partner"
import { toast } from "sonner"
import {UserPlus, Info, TrendingDown} from "lucide-react"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"

import { Alert, AlertDescription } from "@/components/ui/alert"
import type { ColumnDef } from "@tanstack/react-table"

interface AddPartnerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function AddPartnerModal({ open, onOpenChange, onSuccess }: AddPartnerModalProps) {
    const [loading, setLoading] = useState(false)
    const [partners, setPartners] = useState<Partner[]>([])
    const [totalCapital, setTotalCapital] = useState(0)
    const [formData, setFormData] = useState({
        contact_id: "",
        amount: "",
        date: new Date().toISOString().split('T')[0],
        description: "Incorporación de nuevo socio"
    })

    useEffect(() => {
        if (open) {
            partnersApi.getPartners().then(data => {
                setPartners(data)
                const total = data.reduce((acc: number, p: Partner) => {
                    const amount = typeof p.partner_total_contributions === 'string'
                        ? parseFloat(p.partner_total_contributions)
                        : (p.partner_total_contributions || 0)
                    return acc + amount
                }, 0)
                setTotalCapital(total)
            })
        }
    }, [open])

    const handleSubmit = async () => {
        if (!formData.contact_id || !formData.amount) {
            toast.error("Debe completar todos los campos obligatorios.")
            return
        }

        setLoading(true)
        try {
            await partnersApi.recordSubscription({
                contact_id: parseInt(formData.contact_id),
                amount: parseFloat(formData.amount),
                type: 'SUBSCRIPTION',
                date: formData.date,
                description: formData.description
            })
            toast.success("Socio añadido exitosamente")
            onSuccess()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al añadir socio")
        } finally {
            setLoading(false)
        }
    }

    const newAmount = parseFloat(formData.amount) || 0
    const projectedTotal = totalCapital + newAmount

    const footerContent = (
        <div className="flex w-full gap-3 justify-end">
            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
            <SubmitButton onClick={handleSubmit} disabled={!formData.contact_id || newAmount <= 0} loading={loading}>
                Confirmar Incorporación
            </SubmitButton>
        </div>
    )

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
            title={
                <div className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-primary" />
                    Incorporación de Nuevo Socio
                </div>
            }
            description="Añada un nuevo integrante a la sociedad y registre su compromiso de capital inicial."
            footer={footerContent}
        >
            <div className="space-y-6">
                {/* Selector de nuevo socio */}
                <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
                    <LabeledContainer label="Seleccionar Persona / Empresa">
                        <AdvancedContactSelector
                            value={formData.contact_id}
                            onChange={(val) => setFormData(prev => ({ ...prev, contact_id: val || "" }))}
                            placeholder="Busque por nombre o RUT..."
                            className="border-0 focus-visible:ring-0 h-9"
                        />
                    </LabeledContainer>
                    <div className="grid grid-cols-2 gap-4">
                        <LabeledInput
                            label="Aporte de Capital ($)"
                            type="number"
                            value={formData.amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                            placeholder="0"
                            className="font-mono"
                        />
                        <PeriodValidationDateInput
                            label="Fecha de Incorporación"
                            date={formData.date ? new Date(formData.date + 'T12:00:00') : undefined}
                            onDateChange={(d) => {
                                if (!d) {
                                    setFormData(prev => ({ ...prev, date: "" }))
                                    return
                                }
                                setFormData(prev => ({ ...prev, date: d.toISOString().split('T')[0] }))
                            }}
                            validationType="accounting"
                        />
                    </div>
                </div>

                {/* Proyección de Dilución */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <TrendingDown className="h-4 w-4" />
                            Proyección de Participación (Dilución)
                        </h4>
                        <div className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                            Total Proyectado: {formatCurrency(projectedTotal)}
                        </div>
                    </div>

                    <RowTable
                        partners={partners}
                        projectedTotal={projectedTotal}
                        newAmount={newAmount}
                    />
                </div>

                <Alert className="bg-primary/5 border-primary/20">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs text-primary">
                        Esta acción registrará la suscripción formal de capital. Los aportes reales (efectivo/activos) deben cargarse a través del Libro Auxiliar o Tesorería.
                    </AlertDescription>
                </Alert>
            </div>
        </BaseModal>
    )
}

interface ProjectionRow {
    id: string
    name: string
    type: "existing" | "new"
    capital: number
    currentPerc: string
    projectedPerc: string
}

const projColumns: ColumnDef<ProjectionRow>[] = [
    {
        header: "Socio",
        accessorKey: "name",
        cell: ({ row }) => (
            <DataCell.Text className={cn("text-left justify-start text-xs font-semibold", row.original.type === "new" && "text-primary")}>
                {row.original.name}
            </DataCell.Text>
        ),
    },
    {
        header: "Capital Actual",
        accessorKey: "capital",
        cell: ({ row }) => (
            <DataCell.Currency value={row.original.capital} className={cn(row.original.type === "new" && "text-primary font-bold")} />
        ),
        meta: { align: "right" as const },
    },
    {
        header: "Actual %",
        id: "currentPerc",
        cell: ({ row }) => (
            <DataCell.Text className="text-right text-xs font-mono">{row.original.currentPerc}</DataCell.Text>
        ),
        meta: { align: "right" as const },
    },
    {
        header: "Proyectado %",
        id: "projectedPerc",
        cell: ({ row }) => (
            <DataCell.Text className="text-right text-xs font-bold text-primary font-mono">
                {row.original.projectedPerc}
            </DataCell.Text>
        ),
        meta: { align: "right" as const },
    },
]

function RowTable({ partners, projectedTotal, newAmount }: { partners: Partner[]; projectedTotal: number; newAmount: number }) {
    const rows: ProjectionRow[] = useMemo(() => {
        const existing: ProjectionRow[] = partners.map(p => {
            const contributions = typeof p.partner_total_contributions === "string"
                ? parseFloat(p.partner_total_contributions)
                : (p.partner_total_contributions || 0)
            const projectedPerc = projectedTotal > 0 ? (contributions / projectedTotal * 100).toFixed(2) : "0.00"
            return {
                id: `existing-${p.id}`,
                name: p.name,
                type: "existing" as const,
                capital: contributions,
                currentPerc: `${p.partner_equity_percentage}%`,
                projectedPerc: `${projectedPerc}%`,
            }
        })

        if (newAmount <= 0) return existing

        return [
            ...existing,
            {
                id: "new-partner",
                name: "NUEVO SOCIO",
                type: "new" as const,
                capital: newAmount,
                currentPerc: "-",
                projectedPerc: `${(newAmount / projectedTotal * 100).toFixed(2)}%`,
            },
        ]
    }, [partners, projectedTotal, newAmount])

    return (
        <DataTable
            columns={projColumns}
            data={rows}
            variant="embedded"
            hidePagination
            renderRow={(row, children) => {
                const extra = row.original.type === "new" ? "bg-primary/5 font-bold" : "opacity-70 grayscale-[0.5]"
                return React.cloneElement(children as React.ReactElement<{ className?: string }>, {
                    className: `${(children as React.ReactElement<{ className?: string }>).props.className ?? ""} ${extra}`,
                })
            }}
        />
    )
}

function formatCurrencyExcludingSymbol(amount: number) {
    return formatCurrency(amount)
}
