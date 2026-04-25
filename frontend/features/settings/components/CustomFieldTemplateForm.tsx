"use client"

import { showApiError } from "@/lib/errors"
import React, { useState } from 'react'
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Trash2, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CancelButton, IconButton } from "@/components/shared"
import { EmptyState } from "@/components/shared/EmptyState"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { BaseModal } from "@/components/shared/BaseModal"
import api from "@/lib/api"
import { toast } from "sonner"
import { ActionSlideButton } from "@/components/shared/ActionSlideButton";
import { LabeledInput, LabeledSelect } from "@/components/shared"

const templateSchema = z.object({
    name: z.string().min(1, "Nombre requerido"),
    field_type: z.enum(["TEXT", "SELECT_SINGLE", "SELECT_MULTIPLE"]),
    description: z.string().default(""),
    is_required: z.boolean().default(false),
    options: z.array(z.string()).default([]),
})

type TemplateFormValues = z.infer<typeof templateSchema>

interface CustomFieldTemplateFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: (template: any) => void
}

export function CustomFieldTemplateForm({ open, onOpenChange, onSuccess }: CustomFieldTemplateFormProps) {
    const [loading, setLoading] = useState(false)
    const [newOption, setNewOption] = useState("")

    const form = useForm<TemplateFormValues>({
        resolver: zodResolver(templateSchema) as any,
        defaultValues: {
            name: "",
            field_type: "TEXT",
            description: "",
            is_required: false,
            options: [],
        },
    })

    const fieldType = form.watch("field_type")
    const options = form.watch("options") || []

    const addOption = () => {
        if (!newOption.trim()) return
        const currentOptions = form.getValues("options") || []
        if (currentOptions.includes(newOption.trim())) {
            toast.error("La opción ya existe")
            return
        }
        form.setValue("options", [...currentOptions, newOption.trim()])
        setNewOption("")
    }

    const removeOption = (index: number) => {
        const currentOptions = form.getValues("options") || []
        form.setValue("options", currentOptions.filter((_, i) => i !== index))
    }

    const onSubmit = async (data: TemplateFormValues) => {
        setLoading(true)
        try {
            const response = await api.post("/inventory/custom-field-templates/", data)
            toast.success("Plantilla creada exitosamente")
            onSuccess(response.data)
            form.reset()
            onOpenChange(false)
        } catch (error: unknown) {
            showApiError(error, "Error al crear plantilla")
        } finally {
            setLoading(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="sm"
            title="Nueva Plantilla de Campo Personalizado"
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                    <ActionSlideButton type="submit" form="custom-field-template-form" loading={loading}>
                        Crear Plantilla
                    </ActionSlideButton>
                </div>
            }
        >
            <Form {...form}>
                <form id="custom-field-template-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                label="Nombre del Campo"
                                placeholder="Ej: Color de Tintas, Tamaño, etc."
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="field_type"
                        render={({ field, fieldState }) => (
                            <LabeledSelect
                                label="Tipo de Campo"
                                value={field.value}
                                onChange={field.onChange}
                                error={fieldState.error?.message}
                                options={[
                                    { value: "TEXT", label: "Texto (Línea simple)" },
                                    { value: "SELECT_SINGLE", label: "Selección Única" },
                                    { value: "SELECT_MULTIPLE", label: "Selección Múltiple" },
                                ]}
                            />
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field, fieldState }) => (
                            <LabeledInput
                                as="textarea"
                                label="Descripción / Ayuda"
                                placeholder="Instrucciones para el usuario..."
                                rows={3}
                                error={fieldState.error?.message}
                                {...field}
                            />
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="is_required"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>¿Es obligatorio?</FormLabel>
                                    <FormDescription>
                                        El usuario deberá completar este campo al vender.
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {(fieldType === "SELECT_SINGLE" || fieldType === "SELECT_MULTIPLE") && (
                        <div className="space-y-3 pt-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Opciones de Selección</p>
                            <div className="flex gap-2">
                                <LabeledInput
                                    label="Nueva opción"
                                    value={newOption}
                                    onChange={(e) => setNewOption(e.target.value)}
                                    placeholder="Nueva opción"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            addOption()
                                        }
                                    }}
                                />
                                <IconButton type="button" variant="outline" onClick={addOption} className="self-end mb-1">
                                    <Plus className="h-4 w-4" />
                                </IconButton>
                            </div>
                            <div className="max-h-[150px] overflow-y-auto space-y-2">
                                {options.map((option, index) => (
                                    <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-md">
                                        <span className="text-sm">{option}</span>
                                        <IconButton
                                            type="button"
                                            variant="ghost"
                                            className="h-7 w-7 text-destructive"
                                            onClick={() => removeOption(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </IconButton>
                                    </div>
                                ))}
                                {options.length === 0 && (
                                    <EmptyState context="generic" variant="minimal" description="No hay opciones añadidas" />
                                )}
                            </div>
                        </div>
                    )}
                </form>
            </Form>
        </BaseModal>
    )
}
