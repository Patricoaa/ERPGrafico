"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect, useMemo, useCallback } from "react"

import { BaseModal, CancelButton, DataCell, LabeledContainer, SubmitButton } from '@/components/shared'
import { toast } from "sonner"
import { partnersApi } from "@/features/contacts"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { Users } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { partnerEntryEntity, partnerEntryViews, type PartnerEntryRow } from "../entity-view/partnerEntry.entity"

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

    const handleUpdateAmount = useCallback((index: number, amount: string) => {
        const value = parseFloat(amount) || 0
        setEntries(prev => {
            const next = [...prev]
            next[index] = { ...next[index], amount: value }
            return next
        })
    }, [])

    const handleRemovePartner = useCallback((index: number) => {
        setEntries(prev => prev.filter((_, i) => i !== index))
    }, [])

    const augmentedEntries = useMemo<PartnerEntryRow[]>(() =>
        entries.map((e, i) => ({
            ...e,
            _totalCapital: totalCapital,
            _index: i,
            _onAmountChange: handleUpdateAmount,
        })),
        [entries, totalCapital, handleUpdateAmount]
    )

    const partnerEntryCollection = useEntityCollection(
        partnerEntryEntity,
        { rows: augmentedEntries },
        { pagination: { mode: "none" } }
    )

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
                            onChange={() => { }}
                            onSelectContact={(contact) => handleAddPartner(contact.id.toString(), contact)}
                            placeholder="Buscar contacto por nombre o RUT..."
                            className="border-0 focus-visible:ring-0 h-9"
                        />
                    </LabeledContainer>

                    <div className="overflow-hidden flex flex-col">
                        <Collection.Root
                            collection={partnerEntryCollection}
                            label="Socios del capital inicial"
                            actions={(row) => (
                                <DataCell.ActionGroup>
                                    <DataCell.Action
                                        action="delete"
                                        onClick={() => handleRemovePartner(row._index)}
                                    />
                                </DataCell.ActionGroup>
                            )}
                        >
                            <Collection.View
                                table={partnerEntryViews.table}
                                emptyTitle="No hay socios agregados"
                                emptyDescription="Use el buscador superior para agregar socios."
                            />
                        </Collection.Root>
                        {entries.length > 0 && (
                            <div className="bg-muted/30 font-bold border-t flex items-center px-4 py-3 text-sm">
                                <div className="flex-1 text-right pr-4 uppercase tracking-wider">Total Capital Suscrito</div>
                                <div className="w-[220px] pr-2">
                                    <DataCell.Currency value={totalCapital} weight="black" className="justify-end text-lg text-primary" />
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
