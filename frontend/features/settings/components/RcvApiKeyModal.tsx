"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound } from "lucide-react"
import { Form, FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { ActionConfirmModal, BaseModal, CancelButton, FormFooter, LabeledInput, LabeledSwitch, SubmitButton } from "@/components/shared"
import { Can } from "@/components/auth"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { getFieldErrorMessage } from "@/lib/errors"
import { useRcvApiKeyMutations } from "@/features/accounting"
import type { RcvApiKey, RcvApiKeyPayload } from "@/features/accounting"

import { missingRcvKeyMessage, rcvApiKeySchema, type RcvApiKeyFormValues } from "./rcvApiKeyModal.schema"

interface RcvApiKeyModalProps {
    /** `null` crea una nueva API key. */
    apiKey: RcvApiKey | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

const EMPTY_VALUES: RcvApiKeyFormValues = { label: "", key: "", is_active: true }

export function RcvApiKeyModal({ apiKey, open, onOpenChange }: RcvApiKeyModalProps) {
    const { create, update, remove, isCreating, isUpdating, isRemoving } = useRcvApiKeyMutations()
    const [confirmOpen, setConfirmOpen] = useState(false)
    const isEditing = apiKey !== null
    const writePermission = isEditing ? "accounting.change_rcvapikey" : "accounting.add_rcvapikey"

    const form = useForm<RcvApiKeyFormValues>({
        resolver: zodResolver(rcvApiKeySchema),
        defaultValues: EMPTY_VALUES,
    })

    useInitializeDrawerForm({
        form,
        open,
        initialData: apiKey,
        defaultValues: () => EMPTY_VALUES,
        mapData: (data) => ({ label: data.label, key: "", is_active: data.is_active }),
    })

    const onSubmit = async (values: RcvApiKeyFormValues) => {
        const missing = missingRcvKeyMessage(values, isEditing)
        if (missing) {
            form.setError("key", { message: missing })
            return
        }
        const payload: RcvApiKeyPayload = {
            label: values.label ?? "",
            is_active: values.is_active,
            ...(values.key?.trim() ? { key: values.key.trim() } : {}),
        }
        try {
            if (apiKey) await update({ id: apiKey.id, payload })
            else await create(payload)
            form.setValue("key", "")
            onOpenChange(false)
        } catch (error) {
            const duplicate = getFieldErrorMessage(error, "key")
            if (duplicate) form.setError("key", { message: duplicate })
        }
    }

    const onDelete = async () => {
        if (!apiKey) return
        try {
            await remove(apiKey.id)
            setConfirmOpen(false)
            onOpenChange(false)
        } catch {
            // El hook ya muestra el error.
        }
    }

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                size="sm"
                icon={KeyRound}
                title={isEditing ? "Editar API key" : "Agregar API key"}
                description="Clave de SimpleAPI usada para consultar el RCV del SII."
                footer={
                    <Can permission={writePermission}>
                        <FormFooter
                            leftActions={isEditing ? (
                                <Can permission="accounting.delete_rcvapikey">
                                    <Button type="button" variant="destructive" onClick={() => setConfirmOpen(true)} disabled={isRemoving}>
                                        Eliminar
                                    </Button>
                                </Can>
                            ) : undefined}
                            actions={
                                <>
                                    <CancelButton onClick={() => onOpenChange(false)} />
                                    <SubmitButton type="submit" loading={isCreating || isUpdating} onClick={form.handleSubmit(onSubmit)}>
                                        {isEditing ? "Guardar cambios" : "Agregar API key"}
                                    </SubmitButton>
                                </>
                            }
                        />
                    </Can>
                }
            >
                <Form {...form}>
                    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                        <FormField
                            control={form.control}
                            name="label"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Etiqueta"
                                    {...field}
                                    value={field.value ?? ""}
                                    placeholder="Ej: Cuenta principal"
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="key"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="API key"
                                    type="password"
                                    autoComplete="off"
                                    required={!isEditing}
                                    {...field}
                                    value={field.value ?? ""}
                                    placeholder={isEditing ? apiKey.masked_key : "Pegue la API key de SimpleAPI"}
                                    hint={isEditing ? "Se guarda cifrada. Déjela vacía para mantener la actual." : "Se guarda cifrada."}
                                    error={fieldState.error?.message}
                                />
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="is_active"
                            render={({ field }) => (
                                <LabeledSwitch
                                    label="Activa"
                                    description={field.value ? "Se usa para las consultas" : "No se usa para las consultas"}
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            )}
                        />
                    </form>
                </Form>
            </BaseModal>

            <ActionConfirmModal
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                onConfirm={onDelete}
                title="Eliminar API key"
                description="Se eliminará la API key. Las importaciones anteriores conservan su historial, sin la referencia a esta clave. Esta acción no se puede deshacer."
                variant="destructive"
            />
        </>
    )
}
