"use client"

import { useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { Check, Cog, Eye, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ManufacturingConfigFields, emptyManufacturingData, StepHeader } from '@/components/shared'
import type { ManufacturingData, ManufacturingContact } from "@/components/shared"
import { designFileUrls } from "../WizardRightSidebar"
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
    headerActions?: ReactNode
}

type Phase = keyof ManufacturingData['phases']
const PHASES: Phase[] = ['prepress', 'press', 'postpress']

/**
 * Step 3 once the work order exists.
 *
 * Product, quantity and dates live in the right rail and the sale order, so this
 * step only carries what the operator can still change: contact/reference,
 * job description and the specifications of the phases not closed yet. Editing is
 * switched from the step header ("Editar"), which puts the wizard in edit-in-place;
 * the footer saves.
 */
export function ManufacturingConfigSummary({ order, onSaved, headerActions }: ManufacturingConfigSummaryProps) {
    const { stepMode, setStepMode } = useWizardStore()
    const editing = stepMode === 'edit-in-place'
    const form = useForm({ resolver: zodResolver(mfgConfigSchema) })
    const [saving, setSaving] = useState(false)

    const stageData = order.stage_data ?? {}
    // A phase freezes once its stage starts; the others (and the contact) stay editable.
    const lockedPhases: Partial<Record<Phase, string>> = {}
    for (const phase of PHASES) {
        const { canEdit, reason } = canEditMfgSection(phase, order)
        if (!canEdit) lockedPhases[phase] = reason ?? 'Fase cerrada.'
    }

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

    // Entering edit mode starts from the saved data (adjust state during render, no effect).
    const [prevEditing, setPrevEditing] = useState(editing)
    if (editing !== prevEditing) {
        setPrevEditing(editing)
        if (editing) {
            setMfgData(toMfgData())
            setContact(toContact())
        }
    }

    const handleSave = async () => {
        if (!editing || saving) return
        setSaving(true)
        try {
            const fd = new FormData()
            if (contact) fd.append('related_contact', String(contact.id))
            // Only the edited keys of open phases: the server merges them and rejects closed ones.
            const open = (phase: Phase) => !lockedPhases[phase]
            const payload: Record<string, unknown> = {
                contact_id: contact?.id ?? null,
                contact_name: contact?.name ?? null,
                contact_tax_id: contact?.tax_id ?? null,
                product_description: mfgData.product_description,
                phases: Object.fromEntries(PHASES.map((p) => [p, open(p) ? mfgData.phases[p] : stageData.phases?.[p] ?? false])),
                specifications: mfgData.specifications,
            }
            if (open('prepress')) Object.assign(payload, {
                prepress_specs: mfgData.specifications.prepress,
                design_needed: mfgData.design_needed,
                folio_enabled: mfgData.folio_enabled,
                folio_start: mfgData.folio_start,
                design_attachments: mfgData.existing_design_files,
            })
            if (open('press')) Object.assign(payload, { press_specs: mfgData.specifications.press, print_type: mfgData.print_type })
            if (open('postpress')) Object.assign(payload, { postpress_specs: mfgData.specifications.postpress })
            fd.append('stage_data', JSON.stringify(payload))
            if (open('prepress')) mfgData.design_files.forEach((file, i) => fd.append(`design_file_${i}`, file))

            await productionApi.patchWorkOrder(order.id, fd)
            toast.success("Cambios guardados correctamente")
            setStepMode('view')
            onSaved()
        } catch (err) {
            toast.error(getErrorMessage(err) || "Error al guardar los cambios")
        } finally {
            setSaving(false)
        }
    }

    const isTerminal = order.status === 'FINISHED' || order.status === 'CANCELLED'

    // Editing: replace whatever came from the parent with explicit cancel + save.
    // View: use the wizard's header actions (WizardStageActions toggle) when provided,
    //       or fall back to a local edit button for standalone use.
    const headerRight = editing ? (
        <div className="flex items-center gap-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => setStepMode('view')}
            >
                <X className="h-3.5 w-3.5" />Cancelar
            </Button>
            <Button
                type="submit"
                form="wizard-edit-form"
                size="sm"
                disabled={saving}
                className="gap-1.5 h-8 text-xs"
            >
                <Check className="h-3.5 w-3.5" />{saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
        </div>
    ) : (
        headerActions ?? (
            isTerminal ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3 shrink-0" aria-hidden />Solo lectura
                </span>
            ) : (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-foreground h-7 text-xs"
                    onClick={() => setStepMode('edit-in-place')}
                >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
            )
        )
    )

    return (
        <div className="flex flex-1 flex-col gap-5">
            <StepHeader
                title="Configuración de Fabricación"
                description="Especificaciones técnicas, fases de producción y contacto asociado."
                icon={Cog}
                rightContent={headerRight}
            />
            <form id="wizard-edit-form" onSubmit={form.handleSubmit(handleSave)}>
                <ManufacturingConfigFields
                    data={editing ? mfgData : toMfgData()}
                    onDataChange={setMfgData}
                    contact={editing ? contact : toContact()}
                    onContactChange={setContact}
                    disabled={!editing}
                    lockedPhases={lockedPhases}
                    existingFileUrls={designFileUrls(order, stageData.design_attachments ?? [])}
                />
            </form>
        </div>
    )
}
