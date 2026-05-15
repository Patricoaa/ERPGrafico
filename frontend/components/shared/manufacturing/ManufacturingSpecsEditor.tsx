/**
 * ManufacturingSpecsEditor — TASK-108
 *
 * Shared controlled component for manufacturing phase configuration.
 * Replaces the ~10 useState variables in WorkOrderForm/index.tsx and
 * the duplicated phase UI in AdvancedManufacturingModal and WorkOrderMaterials.
 *
 * Consumers:
 *   - AdvancedManufacturingModal  (sales checkout, variant="modal", showContact)
 *   - WorkOrderForm/WorkOrderMaterials (production form, variant="inline")
 */

"use client"

import React from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { FileIcon, Paintbrush, Printer, FileText, Upload, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { LabeledInput, FormSection } from "@/components/shared"

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
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ManufacturingSpecsEditor({
  value,
  onChange,
  showProductDescription = false,
  showInternalNotes = false,
  variant = 'inline',
  disabled = false,
}: ManufacturingSpecsEditorProps) {

  const set = (patch: Partial<ManufacturingData>) =>
    onChange({ ...value, ...patch })

  const setPhase = (phase: keyof ManufacturingData['phases'], v: boolean) =>
    set({ phases: { ...value.phases, [phase]: v } })

  const setSpec = (phase: keyof ManufacturingData['specifications'], v: string) =>
    set({ specifications: { ...value.specifications, [phase]: v } })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      set({ design_files: [...value.design_files, ...Array.from(e.target.files!)] })
    }
  }

  const removeNewFile = (index: number) =>
    set({ design_files: value.design_files.filter((_, i) => i !== index) })

  const removeExistingFile = (index: number) =>
    set({ existing_design_files: value.existing_design_files.filter((_, i) => i !== index) })

  const phaseCardClass = (enabled: boolean) => cn(
    "relative group p-6 rounded-md border transition-all duration-300",
    enabled
      ? "bg-white shadow-sm border-primary/30 ring-1 ring-primary/5"
      : "bg-muted/30 border-border/40 opacity-60 grayscale-[0.5]",
    disabled && "pointer-events-none"
  )

  return (
    <div className="space-y-6">
      {/* Optional: Product description for products without BOM */}
      {showProductDescription && (
        <LabeledInput
          label="Descripción del Trabajo"
          placeholder="DETALLES ESPECÍFICOS DEL PRODUCTO..."
          value={value.product_description}
          onChange={e => set({ product_description: e.target.value })}
          disabled={disabled}
        />
      )}

      <FormSection title="Especificaciones Técnicas" icon={Paintbrush} />

      <div className={cn(
        "grid grid-cols-1 gap-4",
        variant === 'modal' ? "md:grid-cols-3" : "md:grid-cols-3"
      )}>

        {/* ── Pre-Impresión ─────────────────────────────────────────────── */}
        <div className={phaseCardClass(value.phases.prepress)}>
          <FormSection title="Pre-Impresión" icon={Paintbrush} className="pt-0 pb-4" />

          <div className="flex items-center justify-between mb-4 mt-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Habilitar Fase</span>
            <Switch
              checked={value.phases.prepress}
              onCheckedChange={v => setPhase('prepress', v)}
              className="scale-75 data-[state=checked]:bg-primary"
              disabled={disabled}
            />
          </div>

          {value.phases.prepress && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <LabeledInput
                label="Especificaciones"
                as="textarea"
                rows={3}
                value={value.specifications.prepress}
                onChange={e => setSpec('prepress', e.target.value)}
                placeholder="Instrucciones de diseño..."
                disabled={disabled}
              />

              <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/20 border border-border/40">
                <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Diseño Requerido</span>
                <Switch
                  checked={value.design_needed}
                  onCheckedChange={v => set({ design_needed: v })}
                  className="scale-75 data-[state=checked]:bg-primary"
                  disabled={disabled}
                />
              </div>

              {(value.design_needed || value.existing_design_files.length > 0) && (
                <div className="space-y-3 pt-2 border-t border-dashed">
                  {value.existing_design_files.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-[9px] uppercase text-muted-foreground/80 font-black tracking-widest pl-1">Archivos Originales</Label>
                      <div className="space-y-1">
                        {value.existing_design_files.map((file, idx) => (
                          <div key={`existing-${idx}`} className="flex items-center justify-between px-2 py-1.5 bg-primary/5 rounded-md text-[11px] border border-primary/20">
                            <div className="flex items-center gap-2 truncate">
                              <FileIcon className="h-3 w-3 shrink-0 text-primary" />
                              <span className="truncate font-bold">{file}</span>
                            </div>
                            {!disabled && (
                              <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => removeExistingFile(idx)}>
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {value.design_files.length > 0 && <Label className="text-[9px] uppercase text-muted-foreground/80 font-black tracking-widest pl-1">Nuevos Archivos</Label>}
                    <div className="space-y-1">
                      {value.design_files.map((file, idx) => (
                        <div key={`new-${idx}`} className="flex items-center justify-between px-2 py-1.5 bg-muted/40 rounded-md text-[11px] border border-border/40">
                          <div className="flex items-center gap-2 truncate">
                            <Upload className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          {!disabled && (
                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={() => removeNewFile(idx)}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!disabled && (
                      <label className="flex items-center justify-center gap-2 py-2 border border-dashed border-primary/30 rounded-md text-[10px] text-primary font-black uppercase tracking-widest cursor-pointer hover:bg-primary/5 transition-all">
                        <Plus className="h-3 w-3" /> Adjuntar Diseño
                        <input type="file" multiple className="hidden" onChange={handleFileChange} />
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-dashed">
                <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/20 border border-border/40">
                  <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Numeración (Folio)</span>
                  <Switch
                    checked={value.folio_enabled}
                    onCheckedChange={v => set({ folio_enabled: v })}
                    className="scale-75 data-[state=checked]:bg-primary"
                    disabled={disabled}
                  />
                </div>
                {value.folio_enabled && (
                  <div className="animate-in zoom-in-95 duration-200">
                    <LabeledInput
                      label="N° Inicial"
                      placeholder="Ej: 0001"
                      value={value.folio_start}
                      onChange={e => set({ folio_start: e.target.value })}
                      className="font-mono font-bold"
                      disabled={disabled}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Impresión ─────────────────────────────────────────────────── */}
        <div className={phaseCardClass(value.phases.press)}>
          <FormSection title="Impresión" icon={Printer} className="pt-0 pb-4" />

          <div className="flex items-center justify-between mb-4 mt-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Habilitar Fase</span>
            <Switch
              checked={value.phases.press}
              onCheckedChange={v => setPhase('press', v)}
              className="scale-75 data-[state=checked]:bg-primary"
              disabled={disabled}
            />
          </div>

          {value.phases.press && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <LabeledInput
                label="Especificaciones"
                as="textarea"
                rows={3}
                value={value.specifications.press}
                onChange={e => setSpec('press', e.target.value)}
                placeholder="Tintas, papel, terminaciones..."
                disabled={disabled}
              />

              <div className="space-y-2">
                <span className="text-[9px] uppercase text-muted-foreground font-black tracking-widest pl-1">Tecnología</span>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/30 rounded-md border border-border/40">
                  {(['offset', 'digital', 'especial'] as const).map(type => (
                    <Button
                      key={type}
                      type="button"
                      variant={value.print_type === type ? "default" : "ghost"}
                      size="sm"
                      disabled={disabled}
                      className={cn(
                        "h-7 text-[10px] uppercase font-black tracking-tight transition-all",
                        value.print_type === type
                          ? "bg-primary text-primary-foreground shadow-sm"
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
        <div className={cn(phaseCardClass(value.phases.postpress), "rounded-xl")}>
          <FormSection title="Post-Impresión" icon={FileText} className="pt-0 pb-4" />

          <div className="flex items-center justify-between mb-4 mt-1">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Habilitar Fase</span>
            <Switch
              checked={value.phases.postpress}
              onCheckedChange={v => setPhase('postpress', v)}
              className="scale-75 data-[state=checked]:bg-primary"
              disabled={disabled}
            />
          </div>

          {value.phases.postpress && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <LabeledInput
                label="Especificaciones"
                as="textarea"
                rows={3}
                value={value.specifications.postpress}
                onChange={e => setSpec('postpress', e.target.value)}
                placeholder="Acabados, laminado, troquel, etc."
                disabled={disabled}
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
            placeholder="INSTRUCCIONES CRÍTICAS PARA EL EQUIPO DE PRODUCCIÓN..."
            value={value.internal_notes}
            onChange={e => set({ internal_notes: e.target.value })}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}
