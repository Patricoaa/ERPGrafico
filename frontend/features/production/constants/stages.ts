import { Package, FileText, CheckCircle2, Printer, Layers, Ban, type LucideIcon } from 'lucide-react'

export type StageId =
  | 'MATERIAL_ASSIGNMENT'
  | 'MATERIAL_APPROVAL'
  | 'OUTSOURCING_ASSIGNMENT'
  | 'PREPRESS'
  | 'PRESS'
  | 'POSTPRESS'
  | 'OUTSOURCING_VERIFICATION'
  | 'RECTIFICATION'
  | 'FINISHED'
  | 'CANCELLED'

export interface StageMeta {
  id: StageId
  label: string
  icon: LucideIcon
  color: string
  alwaysShow: boolean
  showInKanban: boolean
  order: number
}

export const STAGES_REGISTRY: Record<StageId, StageMeta> = {
  MATERIAL_ASSIGNMENT:      { id: 'MATERIAL_ASSIGNMENT',      label: 'Asignación de Materiales',     icon: Package,      color: 'bg-secondary',     alwaysShow: true,  showInKanban: true,  order: 1 },
  MATERIAL_APPROVAL:        { id: 'MATERIAL_APPROVAL',        label: 'Aprobación de Stock',          icon: CheckCircle2, color: 'bg-info/10',       alwaysShow: false, showInKanban: true,  order: 2 },
  OUTSOURCING_ASSIGNMENT:   { id: 'OUTSOURCING_ASSIGNMENT',   label: 'Asignación de Tercerizados',   icon: Package,      color: 'bg-warning/10',    alwaysShow: true,  showInKanban: false, order: 3 },
  PREPRESS:                 { id: 'PREPRESS',                 label: 'Pre-Impresión',                icon: FileText,     color: 'bg-primary/10',    alwaysShow: false, showInKanban: true,  order: 4 },
  PRESS:                    { id: 'PRESS',                    label: 'Impresión',                    icon: Printer,      color: 'bg-warning/10',    alwaysShow: false, showInKanban: true,  order: 5 },
  POSTPRESS:                { id: 'POSTPRESS',                label: 'Post-Impresión',               icon: Layers,       color: 'bg-info/5',        alwaysShow: false, showInKanban: true,  order: 6 },
  OUTSOURCING_VERIFICATION: { id: 'OUTSOURCING_VERIFICATION', label: 'Verificación de Tercerizados', icon: Package,      color: 'bg-warning/10',    alwaysShow: false, showInKanban: false, order: 7 },
  RECTIFICATION:            { id: 'RECTIFICATION',            label: 'Rectificación',                icon: Package,      color: 'bg-primary/10',    alwaysShow: false, showInKanban: false, order: 8 },
  FINISHED:                 { id: 'FINISHED',                 label: 'Finalizada',                   icon: CheckCircle2, color: 'bg-success/10',    alwaysShow: true,  showInKanban: true,  order: 9 },
  CANCELLED:                { id: 'CANCELLED',                label: 'Anulada',                      icon: Ban,          color: 'bg-muted/50',      alwaysShow: false, showInKanban: true,  order: 10 },
}

export const STAGES_ORDERED: StageMeta[] = Object.values(STAGES_REGISTRY).sort((a, b) => a.order - b.order)
