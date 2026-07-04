"use client"

import { showApiError } from "@/lib/errors"
import React, { useState, useEffect } from "react"

import { BaseModal, CancelButton, DataCell, DataTable, EmptyState, IconButton, LabeledContainer, SubmitButton } from '@/components/shared'
import { Input } from "@/components/ui/input"
import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"

import { toast } from "sonner"
import { partnersApi } from "@/features/contacts/api/partnersApi"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import {Trash2, Users} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface InitialCapitalModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

interface PartnerEntry {
    contact_id: number
    name: string
    amount: number
}

export function InitialCapitalModal({ open, onOpenChange, onSuccess }: InitialCapitalModalProps) {
    const [entries, setEntries] = useState<PartnerEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [totalCapital, setTotalCapital] = useState(0)

    useEffect(() => {
        const total = entries.reduce((acc, curr) => acc + curr.amount, 0)
        requestAnimationFrame(() => {
            setTotalCapital(total)
        })
    }, [entries])

    const handleAddPartner = (contactId: string | null, contact?: { id: number; name: string }) => {
        if (!contactId) return

        const id = parseInt(contactId)
        if (entries.some(e => e.contact_id === id)) {
            toast.error("Este socio ya ha sido agregado a la lista.")
            return
        }

        setEntries([...entries, { contact_id: id, name: contact?.name || `Contacto #${id}`, amount: 0 }])
    }

    const handleUpdateAmount = (index: number, amount: string) => {
        const value = parseFloat(amount) || 0
        const newEntries = [...entries]
        newEntries[index].amount = value
        setEntries(newEntries)
    }

    const handleRemovePartner = (index: number) => {
        const newEntries = [...entries]
        newEntries.splice(index, 1)
        setEntries(newEntries)
    }

    const handleSubmit = async () => {
        if (entries.length === 0) {
            toast.error("Debe agregar al menos un socio.")
            return
        }

        if (entries.some(e => e.amount <= 0)) {
            toast.error("Todos los montos deben ser mayores a cero.")
            return
        }

        setLoading(true)
        try {
            await partnersApi.initialSetup(entries.map(e => ({
                contact_id: e.contact_id,
                amount: e.amount
            })))
            toast.success("Configuración inicial de capital completada con éxito.")
            onSuccess()
            onOpenChange(false)
            setEntries([])
        } catch (error: unknown) {
            showApiError(error, "Error al procesar la configuración inicial")
        } finally {
            setLoading(false)
        }
    }

    const columns = useMemo<ColumnDef<PartnerEntry>[]>(() => [
        {
            header: "Socio",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        #{row.index + 1}
                    </div>
                    <DataCell.Text className="justify-start text-left font-medium">{row.original.name}</DataCell.Text>
                </div>
            )
        },
        {
            header: () => <div className="text-right">Monto Aportado</div>,
            cell: ({ row }) => (
                <div className="relative w-full max-w-[200px] ml-auto">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                    <Input
                        type="number"
                        value={row.original.amount || ""}
                        onChange={(e) => handleUpdateAmount(row.index, e.target.value)}
                        className="pl-7 text-right font-mono h-9"
                        placeholder="0"
                    />
                </div>
            ),
            meta: { align: 'right' }
        },
        {
            header: "Participación",
            cell: ({ row }) => {
                const percentage = totalCapital > 0 ? (row.original.amount / totalCapital) * 100 : 0
                return (
                    <DataCell.Chip size="sm" intent="primary" className="font-bold justify-center w-full">
                        {percentage.toFixed(2)}%
                    </DataCell.Chip>
                )
            },
            meta: { align: 'center' }
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <IconButton
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleRemovePartner(row.index)}
                >
                    <Trash2 className="h-4 w-4" />
                </IconButton>
            ),
            meta: { align: 'center' }
        }
    ], [totalCapital, handleUpdateAmount, handleRemovePartner])

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={
                <div className="flex items-center gap-2 text-primary">
                    <Users className="h-5 w-5" />
                    Configuración Inicial de Capital
                </div>
            }
            description="Defina los socios iniciales y sus aportes para establecer la estructura de capital de la empresa en marcha."
            footer={
                <div className="flex w-full gap-3 justify-end">
                    <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                    <SubmitButton onClick={handleSubmit} disabled={entries.length === 0} loading={loading}>
                        Guardar y Generar Asiento
                    </SubmitButton>
                </div>
            }
        >
            <div className="space-y-6">
                <Alert variant="primary">
                    <AlertTitle className="text-xs font-bold uppercase tracking-wider">Aviso Contable</AlertTitle>
                    <AlertDescription className="text-xs">
                        Esta acción generará un asiento de **Suscripción de Capital**, debitando la cuenta de **Capital por Cobrar Socios** (Activo) y acreditando la cuenta de **Capital Social** (Patrimonio), manteniendo la trazabilidad individual por socio.
                        Los aportes físicos de bienes se deben registrar posteriormente.
                    </AlertDescription>
                </Alert>

                <div className="space-y-4">
                    <LabeledContainer label="Agregar Socio">
                        <AdvancedContactSelector
                            value={null}
                            onChange={(val) => { }}
                            onSelectContact={(contact) => handleAddPartner(contact.id.toString(), contact)}
                            placeholder="Buscar contacto por nombre o RUT..."
                            className="border-0 focus-visible:ring-0 h-9"
                        />
                    </LabeledContainer>

                    <div className="border rounded-md overflow-hidden flex flex-col">
                        <DataTable
                            columns={columns}
                            data={entries}
                            variant="compact"
                            hidePagination
                            noBorder
                            emptyState={{
                                context: "users",
                                title: "No hay socios agregados",
                                description: "Use el buscador superior para agregar socios."
                            }}
                        />
                        {entries.length > 0 && (
                            <div className="bg-muted/30 font-bold border-t flex items-center px-4 py-3 text-sm">
                                <div className="flex-1 text-right pr-4 uppercase tracking-wider">Total Capital Suscrito</div>
                                <div className="w-[220px] pr-2">
                                    <DataCell.Currency value={totalCapital} className="justify-end text-lg font-black text-primary" />
                                </div>
                                <div className="w-[100px] text-center">100%</div>
                                <div className="w-12"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </BaseModal>
    )
}
