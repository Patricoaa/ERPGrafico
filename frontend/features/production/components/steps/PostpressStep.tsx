"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Layers, Lock, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LabeledInput, StepHeader } from '@/components/shared'
import { StageInstructionsPanel } from './StageInstructionsPanel'
import { productionApi } from '../../api/productionApi'
import { useWizardStore } from '../WorkOrderWizardStore'
import { toast } from 'sonner'
import type { WorkOrder } from '../../types'

const schema = z.object({})

interface PostpressStepProps {
  order: WorkOrder
  actionable?: boolean
  onRefresh?: () => void
}

/** The approval lives in the step's bottom panel; the body shows the finishing instructions. */
export function PostpressStep({ order, actionable, onRefresh }: PostpressStepProps) {
  const { stepMode, setStepMode } = useWizardStore()
  const editing = stepMode === 'edit-in-place'
  const form = useForm({ resolver: zodResolver(schema) })
  const [saving, setSaving] = useState(false)
  const [specs, setSpecs] = useState('')

  // Re-init form state when entering edit mode
  const [prevEditing, setPrevEditing] = useState(editing)
  if (editing !== prevEditing) {
    setPrevEditing(editing)
    if (editing) {
      setSpecs(order.stage_data?.postpress_specs ?? '')
    }
  }

  const openEdit = () => {
    setSpecs(order.stage_data?.postpress_specs ?? '')
    setStepMode('edit-in-place')
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await productionApi.updateSection(order.id, 'postpress', { postpress_specs: specs })
      toast.success('Post-prensa actualizada')
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

  return (
    <div className="flex flex-1 flex-col gap-4">
      <StepHeader
        title="Post-Impresión"
        description="Indicaciones técnicas para el operador de terminación."
        icon={Layers}
        rightContent={!editing ? headerRight : undefined}
      />
      {editing ? (
        <form id="wizard-edit-form" onSubmit={form.handleSubmit(handleSave)} className="flex flex-col gap-4">
          <LabeledInput
            label="Indicaciones de terminación"
            as="textarea"
            rows={4}
            placeholder="Instrucciones técnicas para el operador de post-prensa…"
            value={specs}
            onChange={(e) => setSpecs(e.target.value)}
          />
        </form>
      ) : (
        <StageInstructionsPanel title="Indicaciones de terminación" text={order.stage_data?.postpress_specs} />
      )}
    </div>
  )
}
