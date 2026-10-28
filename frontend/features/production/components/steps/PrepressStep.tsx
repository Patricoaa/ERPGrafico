"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { ExternalLink, FileText, Hash, Layers, Lock, Package, Pencil, Sparkles, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LabeledInput, LabeledSwitch, DocumentAttachmentDropzone, StepHeader } from '@/components/shared'
import { cn, formatBytes } from '@/lib/utils'
import { productionApi } from '../../api/productionApi'
import { useWizardStore } from '../WorkOrderWizardStore'
import { toast } from 'sonner'
import type { WorkOrder, ProductionAttachment } from '../../types'

const schema = z.object({})

interface PrepressStepProps {
  order: WorkOrder
  stageData: WorkOrder['stage_data']
  actionable?: boolean
  onRefresh?: () => void
}

function FileGroup({ icon: Icon, title, files }: { icon: LucideIcon; title: string; files: ProductionAttachment[] }) {
  if (files.length === 0) return null
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
        <span className="tabular-nums">({files.length})</span>
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-1 gap-2">
        {files.map((att) => (
          <a
            key={att.id}
            href={att.file}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto flex items-center gap-2 rounded-sm border bg-card px-3 py-2 text-xs transition-colors hover:border-primary/40"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="flex-1 truncate font-medium" title={att.original_filename}>{att.original_filename}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{formatBytes(Number(att.file_size ?? 0))}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </a>
        ))}
      </div>
    </section>
  )
}

/** The approval lives in the step's bottom panel; the body shows the design files and instructions. */
export function PrepressStep({ order, stageData, actionable, onRefresh }: PrepressStepProps) {
  const { stepMode, setStepMode } = useWizardStore()
  const editing = stepMode === 'edit-in-place'
  const form = useForm({ resolver: zodResolver(schema) })
  const [saving, setSaving] = useState(false)

  // edit form state
  const [designNeeded, setDesignNeeded] = useState(stageData?.design_needed ?? false)
  const [folioEnabled, setFolioEnabled] = useState(stageData?.folio_enabled ?? false)
  const [folioStart, setFolioStart] = useState(stageData?.folio_start ?? '')
  const [specs, setSpecs] = useState(stageData?.prepress_specs ?? '')
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [deletedIds, setDeletedIds] = useState<number[]>([])

  // Re-init form state when entering edit mode
  const [prevEditing, setPrevEditing] = useState(editing)
  if (editing !== prevEditing) {
    setPrevEditing(editing)
    if (editing) {
      setDesignNeeded(stageData?.design_needed ?? false)
      setFolioEnabled(stageData?.folio_enabled ?? false)
      setFolioStart(stageData?.folio_start ?? '')
      setSpecs(stageData?.prepress_specs ?? '')
      setNewFiles([])
      setDeletedIds([])
    }
  }

  const currentOtFiles = (order.attachments ?? []).filter(
    (a) => !deletedIds.includes(a.id)
  )
  const checkoutFiles = order.checkout_files ?? []

  const openEdit = () => {
    setDesignNeeded(stageData?.design_needed ?? false)
    setFolioEnabled(stageData?.folio_enabled ?? false)
    setFolioStart(stageData?.folio_start ?? '')
    setSpecs(stageData?.prepress_specs ?? '')
    setNewFiles([])
    setDeletedIds([])
    setStepMode('edit-in-place')
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await productionApi.updateSection(order.id, 'prepress', {
        design_needed: designNeeded,
        folio_enabled: folioEnabled,
        folio_start: folioStart,
        prepress_specs: specs,
      })
      if (newFiles.length > 0) {
        await productionApi.addDesignFiles(order.id, newFiles)
      }
      for (const id of deletedIds) {
        await productionApi.removeAttachment(order.id, id)
      }
      toast.success('Pre-prensa actualizada')
      setStepMode('view')
      onRefresh?.()
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const headerRight = actionable ? (
    <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={openEdit}>
      <Pencil className="h-3.5 w-3.5" /> Editar
    </Button>
  ) : (
    <Lock className="h-4 w-4 text-muted-foreground" />
  )

  if (editing) {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <StepHeader
          title="Pre-Impresión"
          description="Diseño, folios y archivos para esta orden."
          icon={FileText}
        />

        <form id="wizard-edit-form" onSubmit={form.handleSubmit(handleSave)} className="flex flex-col gap-5">
          <LabeledSwitch
            label="Diseño requerido"
            description="El cliente debe aprobar el diseño antes de avanzar."
            checked={designNeeded}
            onCheckedChange={setDesignNeeded}
            color="warning"
          />

          <LabeledSwitch
            label="Numeración (folios)"
            description="El trabajo lleva numeración correlativa."
            checked={folioEnabled}
            onCheckedChange={setFolioEnabled}
          />

          {folioEnabled && (
            <LabeledInput
              label="Folio inicial"
              type="number"
              placeholder="Ej. 1"
              value={folioStart}
              onChange={(e) => setFolioStart(e.target.value)}
            />
          )}

          <LabeledInput
            label="Indicaciones de pre-prensa"
            as="textarea"
            rows={3}
            placeholder="Instrucciones técnicas para el operador…"
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
          />

          {/* Existing OT attachments — can be removed */}
          {currentOtFiles.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Adjuntos de la OT</h4>
              <div className="space-y-1">
                {currentOtFiles.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 rounded-sm border bg-card px-3 py-2 text-xs">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="flex-1 truncate">{att.original_filename}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletedIds((prev) => [...prev, att.id])}
                      className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar adjunto"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* New file uploads */}
          <section className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Añadir archivos de diseño</h4>
            {newFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-sm border bg-card px-3 py-2 text-xs">
                <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="flex-1 truncate">{f.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Quitar archivo"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <DocumentAttachmentDropzone
              label="Agregar archivo"
              file={null}
              onFileChange={(f) => { if (f) setNewFiles((prev) => [...prev, f]) }}
              accept=".pdf,image/*,.ai,.eps,.indd,.cdr"
            />
          </section>
        </form>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <StepHeader
        title="Pre-Impresión"
        description="Diseño, folios y archivos para esta orden."
        icon={FileText}
        rightContent={headerRight}
      />

      <section className="space-y-2">
        <dl className="grid grid-cols-1 gap-3 rounded-sm border bg-card px-4 py-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> Diseño</dt>
            <dd className={cn('mt-0.5', stageData?.design_needed && 'font-medium text-warning')}>
              {stageData?.design_needed ? 'Requerido · el cliente debe aprobarlo' : 'No requerido'}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Hash className="h-3.5 w-3.5" /> Folios</dt>
            <dd className="mt-0.5 tabular-nums">
              {stageData?.folio_enabled ? (stageData.folio_start ? `Numerados desde ${stageData.folio_start}` : 'Numerados') : 'Sin folios'}
            </dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Indicaciones</dt>
            <dd className={cn('mt-0.5 whitespace-pre-line', !stageData?.prepress_specs && 'text-muted-foreground')}>
              {stageData?.prepress_specs || 'Sin indicaciones adicionales'}
            </dd>
          </div>
        </dl>
      </section>

      <FileGroup icon={Package} title="Archivos del checkout (compra)" files={checkoutFiles} />
      <FileGroup icon={Layers} title="Archivos de diseño y adjuntos de la OT" files={(order.attachments ?? [])} />
    </div>
  )
}
