"use client"

import React, { useState } from 'react'
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Trash2, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import api from "@/lib/api"
import { toast } from "sonner"

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
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Error al crear plantilla")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-width-[500px]">
                <DialogHeader>
                    <DialogTitle>Nueva Plantilla de Campo Personalizado</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre del Campo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Color de Tintas, Tamaño, etc." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="field_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de Campo</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccione tipo" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="TEXT">Texto (Línea simple)</SelectItem>
                                            <SelectItem value="SELECT_SINGLE">Selección Única</SelectItem>
                                            <SelectItem value="SELECT_MULTIPLE">Selección Múltiple</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción / Ayuda</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Instrucciones para el usuario..."
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
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
                                <FormLabel>Opciones de Selección</FormLabel>
                                <div className="flex gap-2">
                                    <Input
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
                                    <Button type="button" variant="outline" size="icon" onClick={addOption}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div className="max-h-[150px] overflow-y-auto space-y-2">
                                    {options.map((option, index) => (
                                        <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-md">
                                            <span className="text-sm">{option}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-destructive"
                                                onClick={() => removeOption(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {options.length === 0 && (
                                        <p className="text-sm text-center text-muted-foreground py-2">No hay opciones añadidas</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : "Crear Plantilla"}
                                {!loading && <Save className="ml-2 h-4 w-4" />}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
