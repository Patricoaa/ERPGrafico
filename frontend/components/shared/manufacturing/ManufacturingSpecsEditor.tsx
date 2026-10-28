/**
 * ManufacturingSpecsEditor — TASK-108
 *
 * Shared controlled component for manufacturing phase configuration.
 * Replaces the ~10 useState variables in WorkOrderForm/index.tsx and
 * the duplicated phase UI in AdvancedManufacturingDrawer and WorkOrderMaterials.
 *
 * Consumers:
 *   - AdvancedManufacturingDrawer  (sales checkout, variant="modal", showContact)
 *   - WorkOrderForm/WorkOrderMaterials (production form, variant="inline")
 */

"use client"

import React from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Paintbrush, Printer, FileText, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { LabeledInput, FormSection } from "@/components/shared"
import { DesignFilesField } from "./DesignFilesField"

// ── Canonical shape ───────────────────────────────────────────────────────────

export interface ManufacturingData {
  phases: {
    prepress: boolean
    press: boolean
    postpress: boolean
  }
  specifications: {
    prepress: string
    press: string
    postpress: string
  }
  design_needed: boolean
  /** New File objects (not yet uploaded) */
  design_files: File[]
  /** Filenames of already-persisted design files */
  existing_design_files: string[]
  folio_enabled: boolean
  folio_start: string
  print_type: 'offset' | 'digital' | 'especial' | null
  internal_notes: string
  product_description: string
}

export function emptyManufacturingData(productDefaults?: {
  mfg_enable_prepress?: boolean
  mfg_enable_press?: boolean
  mfg_enable_postpress?: boolean
  mfg_prepress_design?: boolean
  mfg_prepress_folio?: boolean
  mfg_press_offset?: boolean
  mfg_press_digital?: boolean
  mfg_press_special?: boolean
}): ManufacturingData {
  let printType: ManufacturingData['print_type'] = null
  if (productDefaults?.mfg_press_offset) printType = 'offset'
  else if (productDefaults?.mfg_press_digital) printType = 'digital'
  else if (productDefaults?.mfg_press_special) printType = 'especial'

  return {
    phases: {
      prepress: !!productDefaults?.mfg_enable_prepress,
      press: !!productDefaults?.mfg_enable_press,
      postpress: !!productDefaults?.mfg_enable_postpress,
    },
    specifications: { prepress: '', press: '', postpress: '' },
    design_needed: !!productDefaults?.mfg_prepress_design,
    design_files: [],
    existing_design_files: [],
    folio_enabled: !!productDefaults?.mfg_prepress_folio,
    folio_start: '',
    print_type: printType,
    internal_notes: '',
    product_description: '',
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ManufacturingSpecsEditorProps {
  value: ManufacturingData
  onChange: (next: ManufacturingData) => void

  /** Show product_description field (for products without BOM) */
  showProductDescription?: boolean

  /** Show internal_notes textarea (wizard / production context) */
  showInternalNotes?: boolean

  /** Visual density */
  variant?: 'modal' | 'inline'

  disabled?: boolean

  /**
   * Phases that can no longer change (their stage already started), with the reason.
   * A locked phase can't be toggled nor edited; the others stay editable.
   */
  lockedPhases?: Partial<Record<keyof ManufacturingData['phases'], string>>

  /** Openable URL per existing design file name (opened in a new tab). */
  existingFileUrls?: Record<string, string>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ManufacturingSpecsEditor({
  value,
  onChange,
  showProductDescription = false,
  showInternalNotes = false,
  variant = 'inline',
  disabled = false,
  lockedPhases,
  existingFileUrls,
}: ManufacturingSpecsEditorProps) {
  const phaseDisabled = (phase: keyof ManufacturingData['phases']) => disabled || !!lockedPhases?.[phase]

  const set = (patch: Partial<ManufacturingData>) =>
    onChange({ ...value, ...patch })

  const setPhase = (phase: keyof ManufacturingData['phases'], v: boolean) =>
    set({ phases: { ...value.phases, [phase]: v } })

  const setSpec = (phase: keyof ManufacturingData['specifications'], v: string) =>
    set({ specifications: { ...value.specifications, [phase]: v } })

  const removeNewFile = (index: number) =>
    set({ design_files: value.design_files.filter((_, i) => i !== index) })

  const removeExistingFile = (index: number) =>
    set({ existing_design_files: value.existing_design_files.filter((_, i) => i !== index) })

  // Same quiet border as the notched fields; an off phase only fades.
  const phaseCardClass = (enabled: boolean) => cn(
    "relative group p-5 rounded-md border border-border transition-colors duration-300",
    enabled ? "bg-card" : "bg-muted/20 opacity-70",
  )

  const phaseToggle = (phase: keyof ManufacturingData['phases']) => (
    <div className="flex items-center justify-between mb-4 mt-1">
      <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        {lockedPhases?.[phase] ? "Fase cerrada" : "Habilitar fase"}
      </span>
      <Switch
        checked={value.phases[phase]}
        onCheckedChange={v => setPhase(phase, v)}
        className="scale-75 data-[state=checked]:bg-primary"
        disabled={phaseDisabled(phase)}
        title={lockedPhases?.[phase]}
      />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Optional: Product description for products without BOM */}
      {showProductDescription && (
        <LabeledInput
          label="Descripción del Trabajo"
          placeholder="Detalles específicos del producto…"
          value={value.product_description}
          onChange={e => set({ product_description: e.target.value })}
          disabled={disabled}
        />
      )}

      <FormSection title="Especificaciones Técnicas" icon={Wrench} />

      <div className={cn(
        "grid grid-cols-1 gap-4",
        variant === 'modal' ? "md:grid-cols-3" : "md:grid-cols-3"
      )}>

        {/* ── Pre-Impresión ─────────────────────────────────────────────── */}
        <div className={phaseCardClass(value.phases.prepress)}>
          <FormSection title="Pre-Impresión" icon={Paintbrush} className="pt-0 pb-4" />

          {phaseToggle('prepress')}

          {value.phases.prepress && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <LabeledInput
                label="Especificaciones"
                as="textarea"
                rows={3}
                value={value.specifications.prepress}
                onChange={e => setSpec('prepress', e.target.value)}
                placeholder="Instrucciones de diseño…"
                disabled={phaseDisabled('prepress')}
              />

              <div className="flex items-center justify-between px-3 py-2 rounded-sm bg-muted/20 border border-border">
                <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">Diseño requerido</span>
                <Switch
                  checked={value.design_needed}
                  onCheckedChange={v => set({ design_needed: v })}
                  className="scale-75 data-[state=checked]:bg-primary"
                  disabled={phaseDisabled('prepress')}
                />
              </div>

              {(value.design_needed || value.existing_design_files.length > 0 || value.design_files.length > 0) && (
                <DesignFilesField
                  existing={value.existing_design_files}
                  existingUrls={existingFileUrls}
                  files={value.design_files}
                  onAdd={(files) => set({ design_files: [...value.design_files, ...files] })}
                  onRemoveNew={removeNewFile}
                  onRemoveExisting={removeExistingFile}
                  disabled={phaseDisabled('prepress')}
                />
              )}

              <div className="flex items-center justify-between px-3 py-2 rounded-sm bg-muted/20 border border-border">
                <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">Numeración (folio)</span>
                <Switch
                  checked={value.folio_enabled}
                  onCheckedChange={v => set({ folio_enabled: v })}
                  className="scale-75 data-[state=checked]:bg-primary"
                  disabled={phaseDisabled('prepress')}
                />
              </div>
              {value.folio_enabled && (
                <div className="animate-in zoom-in-95 duration-200">
                  <LabeledInput
                    label="N° Inicial"
                    placeholder="Ej: 0001"
                    value={value.folio_start}
                    onChange={e => set({ folio_start: e.target.value })}
                    disabled={phaseDisabled('prepress')}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Impresión ─────────────────────────────────────────────────── */}
        <div className={phaseCardClass(value.phases.press)}>
          <FormSection title="Impresión" icon={Printer} className="pt-0 pb-4" />

          {phaseToggle('press')}

          {value.phases.press && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <LabeledInput
                label="Especificaciones"
                as="textarea"
                rows={3}
                value={value.specifications.press}
                onChange={e => setSpec('press', e.target.value)}
                placeholder="Tintas, papel, terminaciones…"
                disabled={phaseDisabled('press')}
              />

              <div className="space-y-2">
                <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">Tecnología</span>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/30 rounded-sm border border-border/40">
                  {(['offset', 'digital', 'especial'] as const).map(type => (
                    <Button
                      key={type}
                      type="button"
                      variant={value.print_type === type ? "default" : "ghost"}
                      size="sm"
                      disabled={phaseDisabled('press')}
                      className={cn(
                        "h-7 text-3xs uppercase font-medium tracking-tight transition-all",
                        value.print_type === type
                          ? "bg-primary text-primary-foreground shadow-card"
                          : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                      )}
                      onClick={() => set({ print_type: type })}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Post-Impresión ────────────────────────────────────────────── */}
        <div className={phaseCardClass(value.phases.postpress)}>
          <FormSection title="Post-Impresión" icon={FileText} className="pt-0 pb-4" />

          {phaseToggle('postpress')}

          {value.phases.postpress && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <LabeledInput
                label="Especificaciones"
                as="textarea"
                rows={3}
                value={value.specifications.postpress}
                onChange={e => setSpec('postpress', e.target.value)}
                placeholder="Acabados, laminado, troquel…"
                disabled={phaseDisabled('postpress')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Optional: Internal notes (wizard/production context) */}
      {showInternalNotes && (
        <div className="space-y-2">
          <FormSection title="Instrucciones de Taller" icon={FileText} />
          <LabeledInput
            as="textarea"
            label=""
            rows={4}
            placeholder="Instrucciones para el equipo de producción…"
            value={value.internal_notes}
            onChange={e => set({ internal_notes: e.target.value })}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}
