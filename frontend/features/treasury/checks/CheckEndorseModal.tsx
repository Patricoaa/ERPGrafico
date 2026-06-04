"use client"

import React, { useState } from "react"
import { BaseModal, CancelButton, ActionSlideButton, FormFooter } from "@/components/shared"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { useCheckMutations } from "./hooks"
import type { Check } from "./types"

interface Props {
    check: Check
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CheckEndorseModal({ check, open, onOpenChange }: Props) {
    const { endorse, isCreating } = useCheckMutations()
    const [selectedContact, setSelectedContact] = useState<string | null>(null)

    const handleConfirm = async () => {
        if (!selectedContact) return
        await endorse({ id: check.id, endorsedTo: parseInt(selectedContact) })
        onOpenChange(false)
        setSelectedContact(null)
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={(v) => { if (!v) setSelectedContact(null); onOpenChange(v) }}
            title="Endosar Cheque"
            description={`Seleccione el proveedor al que endosará el cheque ${check.display_id} por $${check.amount}`}
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} />
                            <ActionSlideButton
                                loading={isCreating}
                                disabled={isCreating || !selectedContact}
                                onClick={handleConfirm}
                            >
                                Endosar
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <div className="py-4">
                <AdvancedContactSelector
                    label="Proveedor destino"
                    value={selectedContact}
                    onChange={setSelectedContact}
                    placeholder="Buscar proveedor..."
                />
            </div>
        </BaseModal>
    )
}
