"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound } from "lucide-react"
import { Form, FormField } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { ActionConfirmModal, CancelButton, Drawer, FormFooter, LabeledInput, LabeledSwitch, SubmitButton } from "@/components/shared"
import { Can } from "@/components/auth"
import { useInitializeDrawerForm } from "@/hooks/useInitializeDrawerForm"
import { formDrawerWidth } from "@/lib/form-widths"
import { getFieldErrorMessage } from "@/lib/errors"
import { useRcvApiKeyMutations } from "@/features/accounting"
import type { RcvApiKey, RcvApiKeyPayload } from "@/features/accounting"

import { missingRcvKeyMessage, rcvApiKeySchema, type RcvApiKeyFormValues } from "./rcvApiKeyDrawer.schema"

interface RcvApiKeyDrawerProps {
    /** `null` crea una nueva API key. */
    apiKey: RcvApiKey | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

const EMPTY_VALUES: RcvApiKeyFormValues = { label: "", key: "", is_active: true, monthly_limit: 10 }

const numberValue = (value: number) => (Number.isNaN(value) ? "" : value)
const parseNumber = (raw: string) => (raw === "" ? Number.NaN : Number(raw))

export function RcvApiKeyDrawer({ apiKey, open, onOpenChange }: RcvApiKeyDrawerProps) {
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
        mapData: (data) => ({ label: data.label, key: "", is_active: data.is_active, monthly_limit: data.monthly_limit }),
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
            monthly_limit: values.monthly_limit,
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
            <Drawer
                open={open}
                onOpenChange={onOpenChange}
                side="left"
                defaultSize={formDrawerWidth("simple", isEditing)}
                mode={isEditing ? "edit" : "create"}
                icon={KeyRound}
                title={isEditing ? "Editar API key" : "Agregar API key"}
                subtitle="Clave de SimpleAPI usada para consultar el RCV del SII."
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
                    <form className="space-y-4 p-6" onSubmit={form.handleSubmit(onSubmit)}>
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
                            name="monthly_limit"
                            render={({ field, fieldState }) => (
                                <LabeledInput
                                    label="Cupo mensual"
                                    hint="Consultas por mes, entre 1 y 1000."
                                    type="number"
                                    {...field}
                                    value={numberValue(field.value)}
                                    onChange={(event) => field.onChange(parseNumber(event.target.value))}
                                    min={1}
                                    max={1000}
                                    step={1}
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
            </Drawer>

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
