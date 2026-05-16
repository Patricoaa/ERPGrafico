"use client"

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Package, FileText, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BaseModal } from '@/components/shared/BaseModal'
import { ActionConfirmModal } from '@/components/shared/ActionConfirmModal'
import { LabeledSelect } from '@/components/shared'
import { cn } from '@/lib/utils'
import { showApiError } from '@/lib/errors'
import { useConfirmAction } from '@/hooks/useConfirmAction'
import { useVatRate } from '@/hooks/useVatRate'
import { useAuth } from '@/contexts/AuthContext'
import { useHubPanel } from '@/components/providers/HubPanelProvider'
import api from '@/lib/api'
import { useWorkOrderMutations } from '../hooks'
import { completeTask } from '@/features/workflow/api/workflowApi'
import dynamic from 'next/dynamic'
import { FormSkeleton } from '@/components/shared'

import { WizardHeader } from './WizardHeader'
import { WizardProcessSidebar } from './WizardProcessSidebar'
import { WizardStickyFooter } from './WizardStickyFooter'

import { WizardRightSidebar } from './WizardRightSidebar'
import {
  MaterialAssignmentStep,
  MaterialApprovalStep,
  OutsourcingAssignmentStep,
  OutsourcingVerificationStep,
  PrepressStep,
  PressStep,
  PostpressStep,
  RectificationStep,
  FinishedStep,
} from './steps'
import { useWizardStore, selectPendingTasks } from './WorkOrderWizardStore'
import type { WorkOrder, WorkOrderMaterial, WorkOrderStage, WorkOrderTask } from '../types'
import { STAGES_ORDERED } from '../constants/stages'

const WorkOrderForm = dynamic(
  () => import('@/features/production/components/forms/WorkOrderForm').then((m) => m.WorkOrderForm),
  { ssr: false, loading: () => <FormSkeleton /> }
)

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_STAGES: WorkOrderStage[] = STAGES_ORDERED.filter(s => s.id !== 'CANCELLED')

function getFilteredStages(order: WorkOrder): WorkOrderStage[] {
  return BASE_STAGES.filter((stage) => {
    if (stage.alwaysShow) return true
    if (stage.id === 'MATERIAL_APPROVAL') {
      return (order.materials ?? []).some((m: WorkOrderMaterial) => !m.is_outsourced) ||
        order.current_stage === 'MATERIAL_APPROVAL'
    }
    if (stage.id === 'PREPRESS') return order.current_stage === 'PREPRESS' || order.requires_prepress
    if (stage.id === 'PRESS') return order.current_stage === 'PRESS' || order.requires_press
    if (stage.id === 'POSTPRESS') return order.current_stage === 'POSTPRESS' || order.requires_postpress
    if (stage.id === 'OUTSOURCING_VERIFICATION') {
      return order.current_stage === 'OUTSOURCING_VERIFICATION' ||
        (order.materials ?? []).some((m: WorkOrderMaterial) => m.is_outsourced)
    }
    if (stage.id === 'RECTIFICATION') {
      return order.current_stage === 'RECTIFICATION' || (order.materials ?? []).length > 0
    }
    return false
  })
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface WorkOrderWizardProps {
  orderId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  targetStage?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkOrderWizard({ orderId, open, onOpenChange, onSuccess, targetStage }: WorkOrderWizardProps) {
  const { user } = useAuth()
  const { openHub } = useHubPanel()
  const { multiplier: vatMultiplier } = useVatRate()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  // ── mutations (all write ops via hook) ─────────────────────────────────────
  const mutations = useWorkOrderMutations(orderId, { onSuccess: () => { fetchOrder(); onSuccess?.() } })

  // ── store ──────────────────────────────────────────────────────────────────
  const {
    order, loading, viewingStepIndex,
    taskNotes, taskFiles,
    isAnnulModalOpen, isDeleteModalOpen, isBackwardModalOpen, pendingPrevStage,
    showPOPreview, outsourcedPending,
    rectificationAdjustments, rectificationProducedQty, rectificationOutsourcedAdjustments,
    setOrder, setLoading, setViewingStepIndex,
    setTaskNote, setTaskFile,
    setIsAnnulModalOpen, setIsDeleteModalOpen, setIsBackwardModalOpen, setPendingPrevStage,
    setShowPOPreview, setOutsourcedPending,
    setRectificationAdjustments, setRectificationProducedQty, setRectificationOutsourcedAdjustments,
    reset: resetStore,
  } = useWizardStore()

  // local UI state that doesn't need to be in the store
  const finishConfirm = useConfirmAction<string>(async (stageId) => { handleTransition(stageId) })
  const [showCheatsheet, setShowCheatsheet] = useState(false)

  // ── derived ────────────────────────────────────────────────────────────────
  const STAGES = order ? getFilteredStages(order) : BASE_STAGES.filter((s) => s.alwaysShow)
  const actualStepIndex = STAGES.findIndex((s) => s.id === order?.current_stage)
  const isViewingCurrentStage = viewingStepIndex === actualStepIndex
  const pendingTasks = selectPendingTasks(order)

  const canUserCompleteTask = (task: WorkOrderTask): boolean => {
    if (!user) return false
    if (user.is_superuser) return true
    if (task.assigned_to === user.id) return true
    const userGroups = user.groups ?? []
    return userGroups.some((g: string) => {
      const groupName = g.toLowerCase()
      const gName = (task.data as any)?.candidate_group
      return (
        (task.assigned_group_name && task.assigned_group_name.toLowerCase() === groupName) ||
        (gName && typeof gName === 'string' && gName.toLowerCase() === groupName) ||
        g === task.assigned_group
      )
    })
  }

  const canApproveAll = pendingTasks.every(canUserCompleteTask)

  // ── data fetching ──────────────────────────────────────────────────────────
  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/production/orders/${orderId}/`)
      setOrder(res.data)
      const filteredStages = getFilteredStages(res.data)
      const currentIndex = filteredStages.findIndex((s) => s.id === res.data.current_stage)
      let resolvedIndex = currentIndex !== -1 ? currentIndex : 0
      if (targetStage) {
        const targetIndex = filteredStages.findIndex((s) => s.id === targetStage)
        if (targetIndex !== -1) resolvedIndex = targetIndex
      }
      setViewingStepIndex(resolvedIndex)
    } catch {
      toast.error('No se pudo cargar la información de la OT')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && orderId) fetchOrder()
    if (!open) resetStore()
  }, [open, orderId])

  // ── keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onOpenChange(false); return }
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setShowCheatsheet((v) => !v); return
      }
      if (!e.ctrlKey) return
      if (e.key === 'ArrowRight' && isViewingCurrentStage && order?.status !== 'FINISHED') {
        const nextStage = STAGES[viewingStepIndex + 1]
        if (!nextStage) return
        const blocked = pendingTasks.some((t) => !canUserCompleteTask(t)) ||
          (STAGES[viewingStepIndex]?.id === 'MATERIAL_APPROVAL' && order?.materials?.some((m: WorkOrderMaterial) => !m.is_available))
        if (!blocked) {
          nextStage.id === 'FINISHED' ? finishConfirm.requestConfirm(nextStage.id) : handleTransition(nextStage.id)
        }
      }
      if (e.key === 'ArrowLeft' && viewingStepIndex > 0) {
        setViewingStepIndex((v) => v - 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, viewingStepIndex, isViewingCurrentStage, order, pendingTasks])

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleTransition = async (nextStageId: string, data: Record<string, unknown> = {}) => {
    if (!order) return

    const nextIndex = STAGES.findIndex((s) => s.id === nextStageId)
    const currentIndex = STAGES.findIndex((s) => s.id === order.current_stage)
    const isMovingForward = nextIndex > currentIndex

    if (isMovingForward) {
      const unapprovable = pendingTasks.filter((t) => !canUserCompleteTask(t))
      if (unapprovable.length > 0) { toast.error('Existen tareas de aprobación pendientes asignadas a otros usuarios.'); return }
    }

    if (order.current_stage === 'MATERIAL_APPROVAL' && isMovingForward) {
      const missing = order.materials?.filter((m: WorkOrderMaterial) => !m.is_outsourced && !m.is_available) ?? []
      if (missing.length > 0) { toast.error(`Stock insuficiente para ${missing.length} componentes. Reponga stock para continuar.`); return }
    }

    if (order.current_stage === 'OUTSOURCING_ASSIGNMENT' && isMovingForward) {
      const pending = order.materials?.filter((m: WorkOrderMaterial) => m.is_outsourced && !m.purchase_order_number) ?? []
      if (pending.length > 0 && !showPOPreview) { setOutsourcedPending(pending); setShowPOPreview(true); return }
    }

    try {
      if (isMovingForward) {
        const toApprove = pendingTasks.filter(canUserCompleteTask)
        if (toApprove.length > 0) {
          await Promise.all(toApprove.map((t) => completeTask(t.id as any, taskNotes[t.id], taskFiles[t.id] ? [taskFiles[t.id]!] : undefined)))
        }
      }
      await mutations.transition({ nextStageId, data })
    } catch (err) {
      showApiError(err, 'Error al cambiar de etapa')
    }
  }

  const handleRectifyAndFinish = async () => {
    if (!order) return
    try {
      await mutations.rectify({
        materialAdjustments: rectificationAdjustments,
        outsourcedAdjustments: rectificationOutsourcedAdjustments,
        producedQuantity: rectificationProducedQty,
        notes: 'Rectificación desde wizard',
      })
      await mutations.transition({ nextStageId: 'FINISHED' })
    } catch (err) {
      showApiError(err, 'Error al rectificar y finalizar la OT')
    }
  }

  const handleAnnul = async () => {
    try {
      await mutations.annul('')
      setIsAnnulModalOpen(false)
    } catch (err) { showApiError(err, 'Error al anular la orden') }
  }

  const handleDelete = async () => {
    try {
      await mutations.deleteOrder()
      setIsDeleteModalOpen(false)
      onOpenChange(false)
    } catch (err) { showApiError(err, 'Error al eliminar la orden') }
  }

  const handleDuplicate = async () => {
    try {
      await mutations.duplicateOrder()
      setIsDuplicateModalOpen(false)
      // Opcional: cerrar wizard o notificar. toast ya está en la mutación.
    } catch (err) { showApiError(err, 'Error al duplicar la orden') }
  }

  // ── task callbacks (passed down to steps) ─────────────────────────────────
  const taskCallbacks = {
    canComplete: canUserCompleteTask,
    taskNotes,
    taskFiles,
    onNoteChange: setTaskNote,
    onFileChange: setTaskFile,
  }

  // ── render ─────────────────────────────────────────────────────────────────
  if (!order && loading) return null

  const stageData = order?.stage_data ?? {}
  const productName = order?.product_name ?? order?.sale_line?.product?.name ?? 'Producto'
  const orderHasMaterials = !!(order?.materials ?? []).some((m: WorkOrderMaterial) => !m.is_outsourced)
  const currentStageId = STAGES[viewingStepIndex]?.id

  return (
    <>
      <BaseModal
        open={open}
        onOpenChange={onOpenChange}
        size="2xl"
        hideScrollArea
        className="h-[90vh]"
        contentClassName="h-full"
        title={
          <WizardHeader
            order={order as WorkOrder}
            currentStageLabel={STAGES[viewingStepIndex]?.label}
            onEdit={() => setIsEditOpen(true)}
            onOpenCommandCenter={(id, type) => openHub({ orderId: id, type: type as any, onActionSuccess: fetchOrder })}
            onAnnul={() => setIsAnnulModalOpen(true)}
            onDelete={() => setIsDeleteModalOpen(true)}
            onDuplicate={() => setIsDuplicateModalOpen(true)}
            onSaveAsTemplate={() => { setTemplateName(''); setIsSaveTemplateOpen(true) }}
            isAnnuling={mutations.isAnnuling}
            isDeleting={mutations.isDeleting}
            isDuplicating={mutations.isDuplicating}
          />
        }
      >
        <div className="flex flex-1 overflow-hidden h-full min-h-0">
          <WizardProcessSidebar
            stages={STAGES}
            viewingStepIndex={viewingStepIndex}
            actualStepIndex={actualStepIndex}
            onStepClick={setViewingStepIndex}
            order={order as WorkOrder}
          />

          {/* Center content */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden relative">
            <div className="mb-6">
              <h3 className="text-lg font-semibold">{STAGES[viewingStepIndex]?.label}</h3>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 relative">
              {/* Mobile navigation */}
              <div className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-3 mb-4">
                <LabeledSelect
                  value={STAGES[viewingStepIndex]?.id}
                  onChange={(val) => {
                    const idx = STAGES.findIndex((s) => s.id === val)
                    if (idx !== -1) setViewingStepIndex(idx)
                  }}
                  placeholder="Seleccionar etapa"
                  options={STAGES.map((s, i) => {
                    const isPast = actualStepIndex > i
                    const isCurrent = actualStepIndex === i
                    return {
                      value: s.id,
                      disabled: !isPast && !isCurrent,
                      label: (
                        <div className="flex items-center gap-2">
                          <s.icon className="h-4 w-4" />
                          <span>{s.label}</span>
                          {isPast && <CheckCircle2 className="h-3 w-3 ml-2 text-success" />}
                        </div>
                      ),
                    }
                  }) as any}
                />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={viewingStepIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className={cn('space-y-6', !isViewingCurrentStage && 'pointer-events-none opacity-80')}
                >
                  {currentStageId === 'MATERIAL_ASSIGNMENT' && (
                    <MaterialAssignmentStep
                      order={order!}
                      isViewingCurrentStage={isViewingCurrentStage}
                      onMaterialSaved={fetchOrder}
                      onMaterialDeleted={fetchOrder}
                    />
                  )}
                  {currentStageId === 'MATERIAL_APPROVAL' && (
                    <MaterialApprovalStep order={order!} {...taskCallbacks} />
                  )}
                  {currentStageId === 'OUTSOURCING_ASSIGNMENT' && (
                    <OutsourcingAssignmentStep
                      order={order!}
                      isViewingCurrentStage={isViewingCurrentStage}
                      onMaterialSaved={fetchOrder}
                      onMaterialDeleted={fetchOrder}
                    />
                  )}
                  {currentStageId === 'PREPRESS' && (
                    <PrepressStep order={order!} stageData={stageData} {...taskCallbacks} />
                  )}
                  {currentStageId === 'PRESS' && (
                    <PressStep order={order!} {...taskCallbacks} />
                  )}
                  {currentStageId === 'POSTPRESS' && (
                    <PostpressStep order={order!} {...taskCallbacks} />
                  )}
                  {currentStageId === 'OUTSOURCING_VERIFICATION' && (
                    <OutsourcingVerificationStep order={order!} {...taskCallbacks} />
                  )}
                  {currentStageId === 'RECTIFICATION' && (
                    <div className="space-y-6">
                      <RectificationStep
                        order={order!}
                        onChange={(adjustments, producedQty, outsourcedAdj) => {
                          setRectificationAdjustments(adjustments)
                          setRectificationProducedQty(producedQty)
                          if (outsourcedAdj) setRectificationOutsourcedAdjustments(outsourcedAdj)
                        }}
                      />
                    </div>
                  )}
                  {currentStageId === 'FINISHED' && (
                    <FinishedStep
                      order={order!}
                      onUploadPhoto={mutations.uploadFinalPhoto}
                      isUploadingPhoto={mutations.isUploadingPhoto}
                      onPrintCopy={mutations.duplicateOrder}
                      isDuplicating={mutations.isDuplicating}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>



            <WizardStickyFooter
              isViewingCurrentStage={isViewingCurrentStage}
              onClose={() => onOpenChange(false)}
              pendingTasks={pendingTasks}
              canApproveAll={canApproveAll}
              order={order}
              viewingStepIndex={viewingStepIndex}
              actualStepIndex={actualStepIndex}
              stages={STAGES}
              transitioning={false}
              onTransition={handleTransition}
              onBackToCurrent={() => setViewingStepIndex(actualStepIndex)}
              onBack={() => {
                const prevStage = STAGES[actualStepIndex - 1]
                if (prevStage) { setPendingPrevStage(prevStage.id); setIsBackwardModalOpen(true) }
              }}
              isMaterialApprovalIncomplete={
                !!(currentStageId === 'MATERIAL_APPROVAL' && order?.materials?.some((m: WorkOrderMaterial) => !m.is_available))
              }
              hasMaterials={orderHasMaterials}
              isRectificationStep={currentStageId === 'RECTIFICATION'}
              onRectifyAndFinish={handleRectifyAndFinish}
            />
          </div>

          <WizardRightSidebar
            order={order!}
            viewingStepIndex={viewingStepIndex}
            productName={productName}
            stageData={stageData}
          />
        </div>
      </BaseModal>

      {/* Edit form */}
      {isEditOpen && order && (
        <WorkOrderForm
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          initialData={order as any}
          onSuccess={() => { setIsEditOpen(false); fetchOrder() }}
        />
      )}

      {/* PO Preview */}
      <BaseModal
        open={showPOPreview}
        onOpenChange={setShowPOPreview}
        size="md"
        title={<div className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Vista Previa de Órdenes de Compra</div>}
        description="Se generarán las siguientes Órdenes de Compra en borrador para los servicios tercerizados asignados."
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={() => setShowPOPreview(false)}>Cancelar y Revisar</Button>
            <Button onClick={() => {
              setShowPOPreview(false)
              const nextStage = STAGES[actualStepIndex + 1]?.id
              if (nextStage) handleTransition(nextStage)
            }}>
              Confirmar y Generar OC
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-4">
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">Proveedor</th>
                  <th className="p-2 text-left">Servicio</th>
                  <th className="p-2 text-right">Cantidad</th>
                  <th className="p-2 text-right">P. Bruto</th>
                  <th className="p-2 text-right">Total Bruto</th>
                </tr>
              </thead>
              <tbody>
                {outsourcedPending.map((m, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 font-medium">{m.supplier_name}</td>
                    <td className="p-2">{m.component_name}</td>
                    <td className="p-2 text-right">{m.quantity_planned}</td>
                    <td className="p-2 text-right">{(parseFloat(m.unit_price ?? '0') * vatMultiplier).toFixed(0)}</td>
                    <td className="p-2 text-right font-bold">
                      {(parseFloat(String(m.quantity_planned)) * parseFloat(m.unit_price ?? '0') * vatMultiplier).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </BaseModal>

      {/* Confirm modals */}
      <ActionConfirmModal
        open={isAnnulModalOpen}
        onOpenChange={setIsAnnulModalOpen}
        title="Anular Orden de Trabajo"
        variant="warning"
        onConfirm={handleAnnul}
        confirmText="Anular OT"
        description={
          <div className="space-y-3">
            <p>¿Está seguro de que desea <strong>ANULAR</strong> esta Orden de Trabajo?</p>
            <div className="bg-warning/10 border border-warning/20 p-3 rounded-md text-warning text-xs flex gap-3 font-medium">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <ul className="list-disc pl-4 space-y-1">
                <li>Se revertirán los movimientos de stock realizados.</li>
                <li>Se anularán los documentos internos vinculados.</li>
                <li>La OT quedará en estado ANULADA y no podrá procesarse más.</li>
              </ul>
            </div>
          </div>
        }
      />

      <ActionConfirmModal
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Borrar Orden de Trabajo"
        variant="destructive"
        onConfirm={handleDelete}
        confirmText="Eliminar permanentemente"
        description={
          <div className="space-y-3">
            <p>¿Está seguro de que desea <strong>ELIMINAR</strong> permanentemente esta Orden de Trabajo?</p>
            <p className="text-destructive font-semibold bg-destructive/10 p-2 rounded text-xs">
              Esta acción es irreversible y borrará todos los registros históricos de esta orden.
            </p>
          </div>
        }
      />

      <ActionConfirmModal
        open={isDuplicateModalOpen}
        onOpenChange={setIsDuplicateModalOpen}
        title="Duplicar Orden de Trabajo"
        variant="default"
        onConfirm={handleDuplicate}
        confirmText="Duplicar"
        description="Se creará una nueva OT en Borrador con los mismos materiales y configuración. No se vinculará a la Nota de Venta original."
      />

      <ActionConfirmModal
        open={isBackwardModalOpen}
        onOpenChange={setIsBackwardModalOpen}
        title="Retroceder Etapa"
        variant="warning"
        onConfirm={() => { if (pendingPrevStage) handleTransition(pendingPrevStage); setIsBackwardModalOpen(false) }}
        confirmText="Retroceder"
        description={
          <div className="space-y-3">
            <p>¿Está seguro de que desea retroceder a la etapa <strong>{STAGES.find((s) => s.id === pendingPrevStage)?.label}</strong>?</p>
            <div className="bg-warning/10 border border-warning/20 p-3 rounded-md text-warning text-xs flex gap-3 font-medium">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p>Si retrocede, todas las aprobaciones y tareas completadas en las etapas posteriores se reiniciarán y deberán realizarse nuevamente.</p>
            </div>
          </div>
        }
      />

      <ActionConfirmModal
        open={finishConfirm.isOpen}
        onOpenChange={(open) => { if (!open) finishConfirm.cancel() }}
        onConfirm={finishConfirm.confirm}
        title="Finalizar Producción"
        description="¿Estás seguro de finalizar la producción? Una vez finalizada la OT, no se puede modificar."
        confirmText="Finalizar"
      />

      <BaseModal
        open={isSaveTemplateOpen}
        onOpenChange={setIsSaveTemplateOpen}
        title="Guardar como plantilla"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se guardará la configuración de esta OT como plantilla reutilizable.
          </p>
          <Input
            placeholder="Nombre de la plantilla…"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsSaveTemplateOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={!templateName.trim() || isSavingTemplate}
              onClick={async () => {
                setIsSavingTemplate(true)
                try {
                  await api.post('/production/templates/save_from_order/', {
                    order_id: orderId,
                    name: templateName.trim(),
                  })
                  toast.success('Plantilla guardada correctamente.')
                  setIsSaveTemplateOpen(false)
                } catch {
                  toast.error('Error al guardar la plantilla.')
                } finally {
                  setIsSavingTemplate(false)
                }
              }}
            >
              {isSavingTemplate ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </BaseModal>

      <BaseModal
        open={showCheatsheet}
        onOpenChange={setShowCheatsheet}
        title="Atajos de teclado"
        size="sm"
      >
        <div className="space-y-2 text-sm">
          {[
            { keys: ['Ctrl', '→'], desc: 'Avanzar a la siguiente etapa' },
            { keys: ['Ctrl', '←'], desc: 'Ver etapa anterior (sin transicionar)' },
            { keys: ['Esc'], desc: 'Cerrar el wizard' },
            { keys: ['?'], desc: 'Mostrar/ocultar esta ayuda' },
          ].map(({ keys, desc }) => (
            <div key={desc} className="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
              <span className="text-muted-foreground text-xs">{desc}</span>
              <div className="flex gap-1 shrink-0">
                {keys.map((k) => (
                  <kbd key={k} className="px-2 py-0.5 text-[10px] font-mono font-bold bg-muted border border-border rounded">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </BaseModal>
    </>
  )
}
