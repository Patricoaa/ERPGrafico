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
import { LabeledInput, LabeledSelect, FormSection, FormFooter } from "@/components/shared"

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
                <FormFooter
                    actions={
                        <>
                            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
                            <ActionSlideButton type="submit" form="custom-field-template-form" loading={loading}>
                                Crear Plantilla
                            </ActionSlideButton>
                        </>
                    }
                />
            }
        >
            <Form {...form}>
                    <form id="custom-field-template-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* Section 1: Definition */}
                        <div className="space-y-4">
                            <FormSection title="Definición del Atributo" icon={Plus} />
                            <div className="grid grid-cols-4 gap-4">
                                <div className="col-span-3">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                label="Nombre del Atributo"
                                                placeholder="Ej: Color de Tintas, Tamaño, etc."
                                                error={fieldState.error?.message}
                                                required
                                                {...field}
                                            />
                                        )}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <FormField
                                        control={form.control}
                                        name="field_type"
                                        render={({ field, fieldState }) => (
                                            <LabeledSelect
                                                label="Tipo"
                                                value={field.value}
                                                onChange={field.onChange}
                                                error={fieldState.error?.message}
                                                options={[
                                                    { value: "TEXT", label: "Texto" },
                                                    { value: "SELECT_SINGLE", label: "Lista" },
                                                    { value: "SELECT_MULTIPLE", label: "Multi" },
                                                ]}
                                            />
                                        )}
                                    />
                                </div>
                                <div className="col-span-4">
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field, fieldState }) => (
                                            <LabeledInput
                                                as="textarea"
                                                label="Instrucciones / Ayuda para el usuario"
                                                placeholder="Describa cómo completar este campo..."
                                                rows={2}
                                                error={fieldState.error?.message}
                                                {...field}
                                            />
                                        )}
                                    />
                                </div>

                                <div className="col-span-4 pt-2">
                                    <FormField
                                        control={form.control}
                                        name="is_required"
                                        render={({ field }) => (
                                            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20 hover:bg-muted/30 transition-colors border-dashed">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-black leading-none uppercase tracking-wider">Campo Obligatorio</p>
                                                    <p className="text-xs text-muted-foreground">El usuario no podrá guardar el documento sin completar este atributo.</p>
                                                </div>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Options (Conditional) */}
                        {(fieldType === "SELECT_SINGLE" || fieldType === "SELECT_MULTIPLE") && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <FormSection title="Opciones de la Lista" icon={Plus} />
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <LabeledInput
                                                label="Nueva Opción"
                                                value={newOption}
                                                onChange={(e) => setNewOption(e.target.value)}
                                                placeholder="Escriba y presione Enter..."
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        addOption()
                                                    }
                                                }}
                                            />
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="secondary" 
                                            onClick={addOption} 
                                            className="self-end !h-[1.5rem] px-3 font-bold"
                                        >
                                            Añadir
                                        </Button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto scrollbar-thin pr-1">
                                        {options.map((option, index) => (
                                            <div key={index} className="flex items-center justify-between bg-muted/50 border rounded-lg pl-3 pr-1 py-1 group hover:border-primary/30 transition-all">
                                                <span className="text-xs font-medium truncate">{option}</span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => removeOption(index)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                        {options.length === 0 && (
                                            <div className="col-span-2">
                                                <EmptyState context="generic" variant="minimal" description="Defina al menos una opción" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
            </Form>
        </BaseModal>
    )
}
