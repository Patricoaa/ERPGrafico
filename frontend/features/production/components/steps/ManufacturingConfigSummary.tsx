"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { Lock, Pencil, Calendar, User, Package, Settings, X, RotateCcw, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { LabeledInput, LabeledContainer, PeriodValidationDateInput } from "@/components/shared"
import { ManufacturingSpecsEditor, emptyManufacturingData } from "@/components/shared/manufacturing"
import type { ManufacturingData } from "@/components/shared/manufacturing"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { UoMSelector } from "@/components/selectors/UoMSelector"
import type { Contact } from "@/features/contacts/types"
import type { WorkOrder } from "../../types"
import type { MfgSection } from "../../lib/mfgConfigEditability"
import { canEditMfgSection } from "../../lib/mfgConfigEditability"
import { useWizardStore } from "../WorkOrderWizardStore"
import { productionApi } from "../../api/productionApi"
import { useUoMs, useWorkOrderIdentityActions } from "../../hooks"
import { getErrorMessage } from "@/lib/errors"

interface ManufacturingConfigSummaryProps {
    order: WorkOrder
    onSaved: () => void
    onRestartComplete?: () => void
    onCorrectionComplete?: (newOrderId: number) => void
}

// ── Section header with optional edit toggle ──────────────────────────────────

interface SectionHeaderProps {
    icon: React.ReactNode
    title: string
    section: MfgSection
    order: WorkOrder
    editingSection: MfgSection | null
    onEdit: (section: MfgSection) => void
}

function SectionHeader({ icon, title, section, order, editingSection, onEdit }: SectionHeaderProps) {
    const { canEdit, reason } = canEditMfgSection(section, order)
    const isEditing = editingSection === section

    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                {icon}
                {title}
            </div>
            {section !== 'identity' && !isEditing && (
                <TooltipProvider delayDuration={200}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                disabled={!canEdit || editingSection !== null}
                                onClick={() => canEdit && editingSection === null && onEdit(section)}
                                className={cn(
                                    "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
                                    canEdit && editingSection === null
                                        ? "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                                        : "text-muted-foreground/40 cursor-not-allowed"
                                )}
                            >
                                {canEdit ? <Pencil className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                                {canEdit ? "Editar" : "Bloqueado"}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                            {!canEdit
                                ? reason
                                : editingSection !== null
                                    ? "Guarda o cancela la sección actual antes de editar otra"
                                    : `Editar ${title.toLowerCase()}`
                            }
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ManufacturingConfigSummary({ order, onSaved, onRestartComplete, onCorrectionComplete }: ManufacturingConfigSummaryProps) {
    const { stepMode, setStepMode } = useWizardStore()
    const { data: uoms = [] } = useUoMs()
    const [saving, setSaving] = useState(false)
    const [editingSection, setEditingSection] = useState<MfgSection | null>(null)
    const [isRestartDialogOpen, setIsRestartDialogOpen] = useState(false)
    const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false)
    const { restart, createCorrection, isRestarting, isCreatingCorrection } = useWorkOrderIdentityActions(order.id)

    // Local edit state per section
    const [editQuantity, setEditQuantity] = useState("")
    const [editUomId, setEditUomId] = useState("")
    const [editContact, setEditContact] = useState<Contact | null>(null)
    const [editStartDate, setEditStartDate] = useState<Date | null>(null)
    const [editDueDate, setEditDueDate] = useState<Date | null>(null)
    const [editNotes, setEditNotes] = useState("")
    const [editMfgData, setEditMfgData] = useState<ManufacturingData>(emptyManufacturingData())

    // When wizard footer "Cancelar" resets stepMode → exit edit
    useEffect(() => {
        if (stepMode === 'view') {
            setEditingSection(null)
        }
    }, [stepMode])

    const handleRestartConfirm = async () => {
        try {
            await restart()
            toast.success("OT eliminada. Abriendo formulario de creación...")
            onRestartComplete?.()
        } catch {
            // error shown by the hook's onError
        } finally {
            setIsRestartDialogOpen(false)
        }
    }

    const handleCorrectionConfirm = async () => {
        try {
            const result = await createCorrection()
            toast.success(`OT corregida creada: ${result.display_id}`)
            onCorrectionComplete?.(result.id)
        } catch {
            // error shown by the hook's onError
        } finally {
            setIsCorrectionDialogOpen(false)
        }
    }

    const handleEditStart = (section: MfgSection) => {
        setEditingSection(section)
        setStepMode('edit-in-place')

        // Pre-fill edit state from current order
        if (section === 'volume') {
            setEditQuantity(String(order.quantity ?? order.stage_data?.quantity ?? ""))
            setEditUomId(String(order.uom_id ?? order.stage_data?.uom_id ?? ""))
        }
        if (section === 'planning') {
            setEditContact(order.stage_data?.contact_id
                ? { id: Number(order.stage_data.contact_id), name: order.stage_data.contact_name ?? "", tax_id: order.stage_data.contact_tax_id ?? "" } as Contact
                : null
            )
            setEditStartDate(order.start_date ? new Date(order.start_date) : null)
            setEditDueDate(order.due_date ? new Date(order.due_date) : null)
            setEditNotes(order.stage_data?.internal_notes ?? "")
        }
        if (section === 'prepress' || section === 'press' || section === 'postpress') {
            setEditMfgData({
                phases: {
                    prepress: order.stage_data?.phases?.prepress ?? false,
                    press: order.stage_data?.phases?.press ?? false,
                    postpress: order.stage_data?.phases?.postpress ?? false,
                },
                specifications: {
                    prepress: order.stage_data?.prepress_specs ?? "",
                    press: order.stage_data?.press_specs ?? "",
                    postpress: order.stage_data?.postpress_specs ?? "",
                },
                design_needed: order.stage_data?.design_needed ?? false,
                design_files: [],
                existing_design_files: order.stage_data?.design_attachments ?? [],
                folio_enabled: order.stage_data?.folio_enabled ?? false,
                folio_start: order.stage_data?.folio_start ?? "",
                print_type: (order.stage_data?.print_type as ManufacturingData['print_type']) ?? null,
                internal_notes: order.stage_data?.internal_notes ?? "",
                product_description: order.stage_data?.product_description ?? "",
            })
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingSection || saving) return
        setSaving(true)
        try {
            const fd = new FormData()

            if (editingSection === 'volume') {
                fd.append('stage_data', JSON.stringify({
                    ...order.stage_data,
                    quantity: editQuantity,
                    uom_id: editUomId,
                }))
            }

            if (editingSection === 'planning') {
                if (editStartDate) fd.append('start_date', format(editStartDate, 'yyyy-MM-dd'))
                if (editDueDate) fd.append('estimated_completion_date', format(editDueDate, 'yyyy-MM-dd'))
                if (editContact) fd.append('related_contact', String(editContact.id))
                fd.append('stage_data', JSON.stringify({
                    ...order.stage_data,
                    internal_notes: editNotes,
                    contact_id: editContact?.id,
                    contact_name: editContact?.name,
                    contact_tax_id: editContact?.tax_id,
                }))
            }

            if (['prepress', 'press', 'postpress'].includes(editingSection)) {
                fd.append('stage_data', JSON.stringify({
                    ...order.stage_data,
                    phases: editMfgData.phases,
                    specifications: editMfgData.specifications,
                    prepress_specs: editMfgData.specifications.prepress,
                    press_specs: editMfgData.specifications.press,
                    postpress_specs: editMfgData.specifications.postpress,
                    design_needed: editMfgData.design_needed,
                    folio_enabled: editMfgData.folio_enabled,
                    folio_start: editMfgData.folio_start,
                    print_type: editMfgData.print_type,
                    product_description: editMfgData.product_description,
                }))
                editMfgData.design_files.forEach((file, i) => {
                    fd.append(`design_file_${i}`, file)
                })
            }

            await productionApi.patchWorkOrder(order.id, fd)
            toast.success("Cambios guardados correctamente")
            setEditingSection(null)
            setStepMode('view')
            onSaved()
        } catch (err) {
            toast.error(getErrorMessage(err) || "Error al guardar los cambios")
        } finally {
            setSaving(false)
        }
    }

    const stageData = order.stage_data ?? {}
    const isLinked = !!(order.sale_order_number || order.sale_order)
    // Unified accessors — serializer exposes these for both LINKED (from sale_line)
    // and MANUAL (from stage_data) OTs.
    const effectiveQuantity = order.quantity ?? stageData.quantity ?? null
    const effectiveUomName = order.uom_name ?? stageData.uom_name ?? null

    return (
        <form id="wizard-edit-form" onSubmit={handleSave} className="space-y-4">

            {/* ── Card 1: Identidad (always locked) ── */}
            <div className="border rounded-lg p-4 bg-muted/20">
                <SectionHeader
                    icon={<Package className="h-3.5 w-3.5" />}
                    title="Identidad"
                    section="identity"
                    order={order}
                    editingSection={editingSection}
                    onEdit={handleEditStart}
                />
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <p className="text-xs text-muted-foreground">N° OT</p>
                        <p className="font-semibold">{order.display_id}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Producto</p>
                        <p className="font-medium truncate">{order.product_name}</p>
                    </div>
                    {isLinked && (
                        <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Nota de Venta</p>
                            <p className="font-medium">NV-{order.sale_order_number ?? order.sale_order?.number ?? '—'}</p>
                        </div>
                    )}
                </div>
                <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">¿Producto o NV incorrecto?</span>
                    {order.status === 'DRAFT' && (
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                        disabled={isRestarting || isCreatingCorrection}
                                        onClick={() => setIsRestartDialogOpen(true)}
                                    >
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        Empezar de cero
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    Elimina esta OT y abre el formulario de creación desde el inicio
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    <TooltipProvider delayDuration={200}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    disabled={isRestarting || isCreatingCorrection}
                                    onClick={() => setIsCorrectionDialogOpen(true)}
                                >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Crear OT corregida
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                Crea una copia editable de esta OT. La original permanece sin cambios.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {/* ── Card 2: Volumen ── */}
            <div className={cn("border rounded-lg p-4", editingSection === 'volume' && "border-info/40 bg-info/5")}>
                <SectionHeader
                    icon={<Package className="h-3.5 w-3.5" />}
                    title="Volumen"
                    section="volume"
                    order={order}
                    editingSection={editingSection}
                    onEdit={handleEditStart}
                />
                {editingSection === 'volume' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <LabeledInput
                            label="Cantidad a Fabricar"
                            type="number"
                            step="0.01"
                            min="0"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                        />
                        <UoMSelector
                            value={editUomId}
                            onChange={setEditUomId}
                            uoms={uoms as Parameters<typeof UoMSelector>[0]['uoms']}
                            context="sale"
                            variant="standalone"
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-xs text-muted-foreground">Cantidad</p>
                            <p className="font-medium">{effectiveQuantity ?? "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Unidad</p>
                            <p className="font-medium">{effectiveUomName ?? "—"}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Card 3: Parámetros de fabricación ── */}
            <div className={cn("border rounded-lg p-4", ['prepress', 'press', 'postpress'].includes(editingSection ?? '') && "border-info/40 bg-info/5")}>
                <SectionHeader
                    icon={<Settings className="h-3.5 w-3.5" />}
                    title="Parámetros de Fabricación"
                    section="prepress"
                    order={order}
                    editingSection={editingSection}
                    onEdit={handleEditStart}
                />
                <ManufacturingSpecsEditor
                    value={['prepress', 'press', 'postpress'].includes(editingSection ?? '') ? editMfgData : {
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
                    }}
                    onChange={setEditMfgData}
                    disabled={!['prepress', 'press', 'postpress'].includes(editingSection ?? '')}
                    showProductDescription={false}
                    showInternalNotes={false}
                    variant="inline"
                />
            </div>

            {/* ── Card 4: Planificación ── */}
            <div className={cn("border rounded-lg p-4", editingSection === 'planning' && "border-info/40 bg-info/5")}>
                <SectionHeader
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    title="Planificación"
                    section="planning"
                    order={order}
                    editingSection={editingSection}
                    onEdit={handleEditStart}
                />
                {editingSection === 'planning' ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <PeriodValidationDateInput
                                date={editStartDate ?? undefined}
                                onDateChange={(d) => setEditStartDate(d ?? null)}
                                label="Fecha Inicio"
                                validationType="tax"
                            />
                            <PeriodValidationDateInput
                                date={editDueDate ?? undefined}
                                onDateChange={(d) => setEditDueDate(d ?? null)}
                                label="Fecha Entrega"
                                validationType="tax"
                            />
                        </div>
                        <LabeledContainer label="Contacto Relacionado">
                            {editContact ? (
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <User className="h-3.5 w-3.5 text-primary shrink-0" />
                                        <span className="font-semibold text-sm truncate">{editContact.name}</span>
                                    </div>
                                    <button type="button" onClick={() => setEditContact(null)} className="text-muted-foreground hover:text-destructive">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <AdvancedContactSelector
                                    onSelectContact={(c) => setEditContact(c as Contact)}
                                    onChange={() => { }}
                                    placeholder="Buscar contacto..."
                                    variant="inline"
                                    className="h-[1.5rem] px-0 border-none bg-transparent shadow-none text-sm text-muted-foreground"
                                />
                            )}
                        </LabeledContainer>
                        <LabeledInput
                            label="Notas Internas"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-xs text-muted-foreground">Fecha Inicio</p>
                            <p className="font-medium">
                                {order.start_date ? format(new Date(order.start_date), 'dd/MM/yyyy') : "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Fecha Entrega</p>
                            <p className="font-medium">
                                {order.due_date ? format(new Date(order.due_date), 'dd/MM/yyyy') : "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Contacto</p>
                            <p className="font-medium">{stageData.contact_name ?? "—"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Notas</p>
                            <p className="text-muted-foreground text-xs truncate">{stageData.internal_notes || "—"}</p>
                        </div>
                    </div>
                )}
            </div>
        {/* ── Restart confirmation ── */}
        <AlertDialog open={isRestartDialogOpen} onOpenChange={setIsRestartDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar y empezar de cero</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción eliminará permanentemente la OT <strong>{order.display_id}</strong> y abrirá el formulario de creación desde el principio. No se puede deshacer.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isRestarting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isRestarting}
                        onClick={handleRestartConfirm}
                    >
                        {isRestarting ? "Eliminando..." : "Eliminar y empezar de cero"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* ── Correction confirmation ── */}
        <AlertDialog open={isCorrectionDialogOpen} onOpenChange={setIsCorrectionDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Crear OT corregida</AlertDialogTitle>
                    <AlertDialogDescription>
                        Se creará una copia de <strong>{order.display_id}</strong> que podrás modificar libremente. La OT original permanecerá sin cambios.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isCreatingCorrection}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={isCreatingCorrection}
                        onClick={handleCorrectionConfirm}
                    >
                        {isCreatingCorrection ? "Creando..." : "Crear OT corregida"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </form>
    )
}
