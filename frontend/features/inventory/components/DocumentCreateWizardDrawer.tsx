"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Drawer, LabeledInput, FormFooter } from "@/components/shared"
import {
    Form,
    FormField,
} from "@/components/ui/form"
import { showApiError } from "@/lib/errors"
import { useAdjustmentMutations, usePickingMutations, usePickingTypes } from "../hooks/useInventoryDocuments"
import { useWarehouses } from "../hooks/useWarehouses"
import { FileText, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft } from "lucide-react"

export type DocumentCreateType = "count" | "adjustment" | "receipt" | "delivery" | "transfer"

const baseSchema = z.object({
    documentType: z.enum(["count", "adjustment", "receipt", "delivery", "transfer"]),
    warehouse: z.coerce.number().min(1, "El almacén es requerido"),
    notes: z.string().optional(),
    picking_type: z.coerce.number().optional(),
})

type FormValues = z.infer<typeof baseSchema>

interface DocumentCreateWizardDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultType?: DocumentCreateType
    onSuccess?: (id: number) => void
}

export function DocumentCreateWizardDrawer({ open, onOpenChange, defaultType = "count", onSuccess }: DocumentCreateWizardDrawerProps) {
    const { createAdjustment, isCreating: isCreatingAdj } = useAdjustmentMutations()
    const { createPicking, isCreating: isCreatingPick } = usePickingMutations()
    const { data: warehousesPage } = useWarehouses({ page_size: 100 })
    const warehouses = warehousesPage?.results ?? []

    const { data: pickingTypesRes } = usePickingTypes()
    // Depending on the API format, it might be { results: [] } or just []
    const pickingTypes = Array.isArray(pickingTypesRes) ? pickingTypesRes : pickingTypesRes?.results ?? []

    const form = useForm<FormValues>({
        resolver: zodResolver(baseSchema),
        defaultValues: {
            documentType: defaultType,
            notes: "",
        }
    })

    useEffect(() => {
        if (open) {
            form.reset({
                documentType: defaultType,
                notes: "",
                warehouse: undefined,
                picking_type: undefined,
            })
        }
    }, [open, defaultType, form])

    const currentDocType = form.watch("documentType")

    // Filter picking types based on selected document type
    const applicablePickingTypes = pickingTypes.filter((pt: any) => {
        if (currentDocType === "receipt") return pt.code === "incoming"
        if (currentDocType === "delivery") return pt.code === "outgoing"
        if (currentDocType === "transfer") return pt.code === "internal"
        return false
    })

    const isCreating = isCreatingAdj || isCreatingPick

    const onSubmit = async (values: FormValues) => {
        try {
            let newDocId: number
            if (values.documentType === "count" || values.documentType === "adjustment") {
                const data = await createAdjustment({
                    adjustment_type: values.documentType === "count" ? "count" : "manual",
                    warehouse: values.warehouse,
                    notes: values.notes,
                })
                newDocId = data.id
            } else {
                if (!values.picking_type) throw new Error("Debe seleccionar un tipo de operación.")
                const data = await createPicking({
                    picking_type: values.picking_type,
                    warehouse: values.warehouse,
                    origin: values.notes,
                })
                newDocId = data.id
            }
            
            form.reset({ documentType: defaultType, notes: "" })
            onSuccess?.(newDocId)
            onOpenChange(false)
        } catch (error) {
            showApiError(error)
        }
    }

    const getIcon = () => {
        if (currentDocType === "receipt") return ArrowDownToLine
        if (currentDocType === "delivery") return ArrowUpFromLine
        if (currentDocType === "transfer") return ArrowRightLeft
        return FileText
    }

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            side="left"
            boundary="embedded"
            title="Nuevo Documento"
            subtitle="Asistente de creación de operaciones"
            icon={getIcon()}
            resizable
            defaultSize={450}
        >
            <div className="p-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="documentType"
                            render={({ field }) => (
                                <LabeledInput
                                    label="Tipo de Operación"
                                    type="select"
                                    options={[
                                        { value: "count", label: "Conteo de Inventario (Ajuste)" },
                                        { value: "adjustment", label: "Ajuste Manual" },
                                        { value: "receipt", label: "Recepción de Mercadería" },
                                        { value: "delivery", label: "Entrega de Mercadería" },
                                        { value: "transfer", label: "Transferencia Interna" }
                                    ]}
                                    required
                                    {...field}
                                    onChange={(e) => {
                                        field.onChange(e)
                                        // Reset picking_type when switching
                                        form.setValue("picking_type", undefined as any)
                                    }}
                                />
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="warehouse"
                            render={({ field }) => (
                                <LabeledInput
                                    label="Almacén Base"
                                    type="select"
                                    options={warehouses.map(w => ({ value: w.id.toString(), label: w.name }))}
                                    placeholder="Seleccione el almacén de la operación"
                                    required
                                    {...field}
                                />
                            )}
                        />

                        {["receipt", "delivery", "transfer"].includes(currentDocType) && (
                            <FormField
                                control={form.control}
                                name="picking_type"
                                render={({ field }) => (
                                    <LabeledInput
                                        label="Sub-Tipo de Operación"
                                        type="select"
                                        options={applicablePickingTypes.map((pt: any) => ({ value: pt.id.toString(), label: pt.name }))}
                                        placeholder="Seleccione el flujo específico"
                                        required
                                        {...field}
                                    />
                                )}
                            />
                        )}
                        
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <LabeledInput
                                    label={["receipt", "delivery", "transfer"].includes(currentDocType) ? "Documento de Origen" : "Notas / Motivo"}
                                    type="text"
                                    placeholder={["receipt", "delivery", "transfer"].includes(currentDocType) ? "Ej. PO-0012, SO-0050" : "Referencia del ajuste"}
                                    {...field}
                                    value={field.value || ""}
                                />
                            )}
                        />

                        <FormFooter
                            isSubmitting={isCreating}
                            submitLabel="Crear Documento"
                            cancelLabel="Cancelar"
                            onCancel={() => onOpenChange(false)}
                            className="pt-6"
                        />
                    </form>
                </Form>
            </div>
        </Drawer>
    )
}
