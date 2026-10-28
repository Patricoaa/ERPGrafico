"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Lock, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { ManufacturingConfigFields, emptyManufacturingData } from '@/components/shared'
import type { ManufacturingData, ManufacturingContact } from "@/components/shared"
import type { WorkOrder } from "../../types"
import { canEditMfgSection } from "../../lib/mfgConfigEditability"
import { useWizardStore } from "../WorkOrderWizardStore"
import { productionApi } from "../../api/productionApi"
import { getErrorMessage } from "@/lib/errors"

// Fields are controlled by ManufacturingConfigFields; the form only owns submit.
const mfgConfigSchema = z.object({})

interface ManufacturingConfigSummaryProps {
    order: WorkOrder
    onSaved: () => void
}

/**
 * Step 3 once the work order exists.
 *
 * Product, quantity and dates live in the right rail and the sale order, so this
 * step only carries what the operator can still change: contact/reference,
 * job description and per-stage specifications.
 */
export function ManufacturingConfigSummary({ order, onSaved }: ManufacturingConfigSummaryProps) {
    const { stepMode, setStepMode } = useWizardStore()
    const form = useForm({ resolver: zodResolver(mfgConfigSchema) })
    const [saving, setSaving] = useState(false)
    const [editing, setEditing] = useState(false)

    const stageData = order.stage_data ?? {}
    // Contact stays editable until the OT closes; specifications freeze with their stage.
    const { canEdit, reason } = canEditMfgSection('planning', order)
    const specsLocked = !canEditMfgSection('prepress', order).canEdit

    const toMfgData = (): ManufacturingData => ({
        phases: {
            prepress: stageData.phases?.prepress ?? false,
            press: stageData.phases?.press ?? false,
            postpress: stageData.phases?.postpress ?? false,
        },
        specifications: {
            prepress: stageData.prepress_specs ?? "",
            press: stageData.press_specs ?? "",
            postpress: stageData.postpress_specs ?? "",
        },
        design_needed: stageData.design_needed ?? false,
        design_files: [],
        existing_design_files: stageData.design_attachments ?? [],
        folio_enabled: stageData.folio_enabled ?? false,
        folio_start: stageData.folio_start ?? "",
        print_type: (stageData.print_type as ManufacturingData['print_type']) ?? null,
        internal_notes: stageData.internal_notes ?? "",
        product_description: stageData.product_description ?? "",
    })
    const toContact = (): ManufacturingContact | null =>
        stageData.contact_id
            ? { id: Number(stageData.contact_id), name: stageData.contact_name ?? "", tax_id: stageData.contact_tax_id ?? "" }
            : null

    const [mfgData, setMfgData] = useState<ManufacturingData>(emptyManufacturingData())
    const [contact, setContact] = useState<ManufacturingContact | null>(null)

    // When wizard footer "Cancelar" resets stepMode → exit edit
    useEffect(() => {
        if (stepMode === 'view') {
            requestAnimationFrame(() => setEditing(false))
        }
    }, [stepMode])

    const handleEditStart = () => {
        setMfgData(toMfgData())
        setContact(toContact())
        setEditing(true)
        setStepMode('edit-in-place')
    }

    const handleSave = async () => {
        if (!editing || saving) return
        setSaving(true)
        try {
            const fd = new FormData()
            if (contact) fd.append('related_contact', String(contact.id))
            const contactFields = {
                contact_id: contact?.id ?? null,
                contact_name: contact?.name ?? null,
                contact_tax_id: contact?.tax_id ?? null,
            }
            // Only the edited keys: the server merges them into the current stage_data
            fd.append('stage_data', JSON.stringify(specsLocked
                ? contactFields
                : {
                phases: mfgData.phases,
                specifications: mfgData.specifications,
                prepress_specs: mfgData.specifications.prepress,
                press_specs: mfgData.specifications.press,
                postpress_specs: mfgData.specifications.postpress,
                design_needed: mfgData.design_needed,
                folio_enabled: mfgData.folio_enabled,
                folio_start: mfgData.folio_start,
                print_type: mfgData.print_type,
                product_description: mfgData.product_description,
                ...contactFields,
            }))
            if (!specsLocked) mfgData.design_files.forEach((file, i) => {
                fd.append(`design_file_${i}`, file)
            })

            await productionApi.patchWorkOrder(order.id, fd)
            toast.success("Cambios guardados correctamente")
            setEditing(false)
            setStepMode('view')
            onSaved()
        } catch (err) {
            toast.error(getErrorMessage(err) || "Error al guardar los cambios")
        } finally {
            setSaving(false)
        }
    }

    return (
        <form id="wizard-edit-form" onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
            <div className={cn("border rounded-md p-4", editing && "border-info/40 bg-info/5")}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase text-muted-foreground">Configuración de fabricación</h3>
                    {!editing && (
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            disabled={!canEdit}
                                            onClick={handleEditStart}
                                            className="flex items-center gap-1 text-xs px-2 py-1"
                                        >
                                            {canEdit ? <Pencil className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                            {canEdit ? "Editar" : "Bloqueado"}
                                        </Button>
                                    </span>
                                </TooltipTrigger>
                                {!canEdit && <TooltipContent side="left">{reason}</TooltipContent>}
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <ManufacturingConfigFields
                    data={editing ? mfgData : toMfgData()}
                    onDataChange={setMfgData}
                    contact={editing ? contact : toContact()}
                    onContactChange={setContact}
                    disabled={!editing}
                    specsDisabled={specsLocked}
                />
            </div>
        </form>
    )
}
