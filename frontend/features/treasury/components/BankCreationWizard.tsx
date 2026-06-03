"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Landmark, CheckCircle2, CreditCard, Banknote } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    GenericWizard, LabeledInput, FormSection,
} from "@/components/shared"
import type { WizardStep } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { useBanks } from "../hooks/useMasterData"
import { useProvisionAccount } from "../hooks/useTreasuryAccounts"
import { TreasuryAccountWizard } from "./TreasuryAccountWizard"

interface BankCreationWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function BankCreationWizard({ open, onOpenChange, onSuccess }: BankCreationWizardProps) {
    const { createBank, isCreating } = useBanks()
    const [stepIndex, setStepIndex] = useState(0)
    const [name, setName] = useState("")
    const [code, setCode] = useState("")
    const [swiftCode, setSwiftCode] = useState("")
    const [createdBankId, setCreatedBankId] = useState<number | null>(null)
    const [showAccountWizard, setShowAccountWizard] = useState(false)

    useEffect(() => {
        if (!open) return
        const id = requestAnimationFrame(() => {
            setStepIndex(0)
            setName("")
            setCode("")
            setSwiftCode("")
            setCreatedBankId(null)
            setShowAccountWizard(false)
        })
        return () => cancelAnimationFrame(id)
    }, [open])

    const handleCreateBank = async () => {
        try {
            const result = await createBank({ name, code: code || undefined, swift_code: swiftCode || undefined })
            setCreatedBankId(result.id)
            setStepIndex(1)
        } catch {
            // Error handled by hook
        }
    }

    const steps: WizardStep[] = useMemo(() => [
        {
            id: "bank-data",
            title: "Datos del Banco",
            isValid: !!name.trim(),
            component: (
                <div className="space-y-5 pt-2">
                    <FormSection title="Información del Banco" icon={Landmark} />
                    <div className="space-y-4">
                        <LabeledInput
                            label="Nombre del Banco"
                            placeholder="Ej: Banco de Chile"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <LabeledInput
                                label="Código (opcional)"
                                placeholder="Ej: 001"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                            />
                            <LabeledInput
                                label="SWIFT (opcional)"
                                placeholder="Ej: BCHICLRM"
                                value={swiftCode}
                                onChange={(e) => setSwiftCode(e.target.value)}
                                maxLength={11}
                            />
                        </div>
                    </div>
                </div>
            ),
        },
        {
            id: "success",
            title: "Banco Creado",
            isValid: true,
            component: (
                <div className="space-y-6 pt-4">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 rounded-full bg-success/10">
                            <CheckCircle2 className="h-12 w-12 text-success" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold">¡Banco creado exitosamente!</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                ¿Desea crear una cuenta de tesorería para este banco?
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-center gap-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                onSuccess?.()
                                onOpenChange(false)
                            }}
                        >
                            Ahora no
                        </Button>
                        <Button
                            onClick={() => setShowAccountWizard(true)}
                        >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Crear Cuenta
                        </Button>
                    </div>
                </div>
            ),
        },
    ], [name, code, swiftCode, onSuccess, onOpenChange])

    if (showAccountWizard && createdBankId) {
        return (
            <TreasuryAccountWizard
                open={showAccountWizard}
                onOpenChange={(open) => {
                    setShowAccountWizard(open)
                    if (!open) {
                        onSuccess?.()
                        onOpenChange(false)
                    }
                }}
                defaultBankId={createdBankId}
            />
        )
    }

    return (
        <GenericWizard
            open={open}
            onOpenChange={onOpenChange}
            title="Nuevo Banco"
            steps={steps}
            onComplete={async () => {
                onSuccess?.()
                onOpenChange(false)
            }}
            isCompleting={isCreating}
            completeButtonLabel="Finalizar"
        />
    )
}
