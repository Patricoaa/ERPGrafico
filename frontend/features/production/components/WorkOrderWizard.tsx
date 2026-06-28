"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { AlertTriangle, Package, FileText, Plus, CheckCircle2, Keyboard, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { ActionConfirmModal, BaseModal, Drawer, CancelButton, FormFooter, LabeledSelect, StatusBadge } from '@/components/shared'
import { cn, formatPlainDate } from '@/lib/utils'
import { formatEntityDisplay } from '@/lib/entity-registry'
import { showApiError } from '@/lib/errors'
import { useConfirmAction } from '@/hooks/useConfirmAction'
import { useVatRate } from '@/hooks/useVatRate'
import { useAuth } from '@/contexts/AuthContext'
import { useHubPanel } from '@/components/providers/HubPanelProvider'
import { useWorkOrderMutations, productionApi } from '../hooks'
import { completeTask } from '@/features/workflow'

import { WizardModeBanner } from './WizardModeBanner'
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
import type { WorkOrder, WorkOrderMaterial, WorkOrderStage, WorkOrderTask, WizardMode } from '../types'
import type { WorkOrderInitialData } from '@/types/forms'
import { STAGES_ORDERED } from '../constants/stages'

import { OriginSelectionStep } from './steps/OriginSelectionStep'
import { SaleOrderProductStep } from './steps/SaleOrderProductStep'
import { ProductSelectionStep } from './steps/ProductSelectionStep'
import { ManufacturingConfigStep } from './steps/ManufacturingConfigStep'

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_ORIGIN: WorkOrderStage = {
  id: 'ORIGIN_SELECTION',
  label: 'Origen de Fabricación',
  icon: Package,
  alwaysShow: true,
  isCreationStep: true,
}

const STEP_SALE_ORDER_PRODUCT: WorkOrderStage = {
  id: 'SALE_ORDER_PRODUCT',
  label: 'Selección de NV y Producto',
  icon: FileText,
  alwaysShow: true,
  isCreationStep: true,
}

const STEP_PRODUCT_SELECTION: WorkOrderStage = {
  id: 'PRODUCT_SELECTION',
  label: 'Selección de Producto',
  icon: Plus,
  alwaysShow: true,
  isCreationStep: true,
}

const STEP_MFG_CONFIG: WorkOrderStage = {
  id: 'MFG_CONFIG',
  label: 'Configurar Fabricación',
  icon: Printer,
  alwaysShow: true,
  isCreationStep: true,
}

const BASE_STAGES: WorkOrderStage[] = STAGES_ORDERED.filter(s => s.id !== 'CANCELLED')

function getCreateStages(otType: 'LINKED' | 'NONE' | null): WorkOrderStage[] {
  if (otType === null) return [STEP_ORIGIN]

  const virtualSteps: WorkOrderStage[] = [STEP_ORIGIN]
  if (otType === "LINKED") {
    virtualSteps.push(STEP_SALE_ORDER_PRODUCT)
  } else {
    virtualSteps.push(STEP_PRODUCT_SELECTION)
  }
  virtualSteps.push(STEP_MFG_CONFIG)
  return [...virtualSteps, ...BASE_STAGES.filter((s) => s.alwaysShow)]
}

function getUnifiedStages(
  chosenOtType: 'LINKED' | 'NONE' | null,
  order: WorkOrder | null
): WorkOrderStage[] {
  // Build completed creation steps
  const creationSteps: WorkOrderStage[] = [{ ...STEP_ORIGIN, alwaysShow: true }]
  if (chosenOtType === "LINKED") {
    creationSteps.push({ ...STEP_SALE_ORDER_PRODUCT, alwaysShow: true })
  } else if (chosenOtType === "NONE") {
    creationSteps.push({ ...STEP_PRODUCT_SELECTION, alwaysShow: true })
  }
  creationSteps.push({ ...STEP_MFG_CONFIG, alwaysShow: true })

  // Build workflow steps (filtered if order is available, otherwise alwaysShow)
  const workflowStages = order
    ? [...getFilteredStages(order)]
    : [...BASE_STAGES.filter((s) => s.alwaysShow)]

  return [...creationSteps, ...workflowStages]
}

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

const EDITABLE_STAGES = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS']

// ── Props ─────────────────────────────────────────────────────────────────────

interface WorkOrderWizardProps {
  mode: WizardMode
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (workOrderId?: number) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkOrderWizard({ mode, open, onOpenChange, onSuccess }: WorkOrderWizardProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { openHub } = useHubPanel()
  const { multiplier: vatMultiplier } = useVatRate()
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
  // localOrderId: null = create mode, number = manage mode
  const [localOrderId, setLocalOrderId] = useState<number | null>(
    mode.kind === 'manage' ? mode.orderId : null
  )
  const wasCreatingRef = useRef(false)
  const isCreating = localOrderId === null

  // ── mutations (all write ops via hook) ─────────────────────────────────────
  const mutations = useWorkOrderMutations(localOrderId ?? 0, { onSuccess: () => { fetchOrder(); onSuccess?.() } })

  // ── store ──────────────────────────────────────────────────────────────────
  const {
    order, loading, viewingStepIndex, stepMode,
    taskNotes, taskFiles,
    isAnnulModalOpen, isDeleteModalOpen, isBackwardModalOpen, pendingPrevStage,
    showPOPreview, outsourcedPending,
    rectificationAdjustments, rectificationProducedQty, rectificationOutsourcedAdjustments,
    // Creation flow state
    chosenOtType, selectedSaleOrder, selectedSaleLine, selectedProduct, mfgConfig,
    selectedContact, quantity, uomId, startDate, dueDate, internalNotes,
    setOrder, setLoading, setViewingStepIndex, navigateToStep,
    setTaskNote, setTaskFile,
    setIsAnnulModalOpen, setIsDeleteModalOpen, setIsBackwardModalOpen, setPendingPrevStage,
    setShowPOPreview, setOutsourcedPending,
    setRectificationAdjustments, setRectificationProducedQty, setRectificationOutsourcedAdjustments,
    // Creation flow actions
    setChosenOtType, setSelectedSaleOrder, setSelectedSaleLine, setSelectedProduct, setProductDescription, setMfgConfig,
    setSelectedContact, setQuantity, setUomId, setStartDate, setDueDate, setInternalNotes,
    reset: resetStore,
  } = useWizardStore()

  const [showCheatsheet, setShowCheatsheet] = useState(false)

  // ── derived ────────────────────────────────────────────────────────────────
  const STAGES = useMemo(
    () => isCreating
      ? getCreateStages(chosenOtType)
      : getUnifiedStages(chosenOtType, order),
    [isCreating, chosenOtType, order]
  )
  const actualStepIndex = isCreating
    ? viewingStepIndex
    : STAGES.findIndex((s) => s.id === order?.current_stage)
  const isViewingCurrentStage = viewingStepIndex === actualStepIndex
  const pendingTasks = selectPendingTasks(order)
  const isBasicInfoEditable = !isCreating && EDITABLE_STAGES.includes(order?.current_stage ?? '')

  const canUserCompleteTask = (task: WorkOrderTask): boolean => {
    if (!user) return false
    if (user.is_superuser) return true
    if (task.assigned_to === user.id) return true
    const userGroups = user.groups ?? []
    return userGroups.some((g: string) => {
      const groupName = g.toLowerCase()
      const gName = (task.data as Record<string, unknown>)?.candidate_group
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
    if (!localOrderId) return
    setLoading(true)
    try {
      const orderData = await productionApi.getWorkOrder(localOrderId)
      const orderRecord = orderData as unknown as Record<string, unknown>
      setOrder(orderData as unknown as WorkOrder)

      // Infer order type from data so STAGES stays consistent
      const inferredType = orderRecord.sale_order ? "LINKED" as const : "NONE" as const
      setChosenOtType(inferredType)

      // Resolve index using the same STAGES the component uses
      const stages = getUnifiedStages(inferredType, orderData as unknown as WorkOrder)
      let resolvedIndex = -1
      const targetStage = mode.kind === 'manage' ? mode.targetStage : undefined
      if (targetStage) {
        resolvedIndex = stages.findIndex((s) => s.id === targetStage)
      }
      if (resolvedIndex === -1) {
        resolvedIndex = stages.findIndex((s) => s.id === (orderData as unknown as WorkOrder).current_stage)
      }
      setViewingStepIndex(resolvedIndex >= 0 ? resolvedIndex : 1)
    } catch {
      toast.error('No se pudo cargar la información de la OT')
    } finally {
      setLoading(false)
    }
  }

  // Synchronize state with props during render to avoid useEffect setStates
  const [prevMode, setPrevMode] = useState(mode)
  const [prevOpen, setPrevOpen] = useState(open)

  if (mode !== prevMode || open !== prevOpen) {
    setPrevMode(mode)
    setPrevOpen(open)
    setLocalOrderId(open && mode.kind === 'manage' ? mode.orderId : null)
    if (open) {
      if (mode.kind === 'create') {
        const defaultType = mode.defaultOtType || null
        setChosenOtType(defaultType)
        // Reset creation flow state
        setSelectedSaleOrder(null)
        setSelectedSaleLine(null)
        setSelectedProduct(null)
        setMfgConfig(null)
        setSelectedContact(null)
        setQuantity("")
        setUomId("")
        setStartDate(null)
        setDueDate(null)
        setInternalNotes("")

        if (defaultType === "LINKED") {
          setViewingStepIndex(0) // ORIGIN_SELECTION
        } else if (defaultType === "NONE") {
          setViewingStepIndex(0) // ORIGIN_SELECTION (will go to PRODUCT_SELECTION after)
        } else {
          setViewingStepIndex(0) // ORIGIN_SELECTION
        }
      } else {
        // chosenOtType gets set by fetchOrder after the order loads
      }
    }
  }

  useEffect(() => {
    if (open) {
      if (localOrderId) {
        fetchOrder()
      } else {
        setLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, localOrderId])

  useEffect(() => {
    return () => {
      resetStore()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync viewing stage to URL step query param
  useEffect(() => {
    if (localOrderId === null) return
    const stage = STAGES[viewingStepIndex]?.id
    if (!stage) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('selected') !== String(localOrderId)) return
    if (url.searchParams.get('step') === stage) return
    url.searchParams.set('step', stage)
    router.replace(url.pathname + url.search, { scroll: false })
  }, [viewingStepIndex, localOrderId, STAGES, router])

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
          await Promise.all(toApprove.map((t) => {
            const file = taskFiles[t.id]
            return completeTask(t.id as number, taskNotes[t.id], file ? [file] : undefined)
          }))
        }
      }
      await mutations.transition({ nextStageId, data })
    } catch (err) {
      showApiError(err, 'Error al cambiar de etapa')
    }
  }

  const finishConfirm = useConfirmAction<string>(async (stageId) => { handleTransition(stageId) })

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
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        side="bottom"
        boundary="embedded"
        defaultSize="100%"
        resizable={false}
        contentClassName="p-0 flex flex-col h-full overflow-hidden"
        icon={Package}
        title={
          order
            ? `Gestión de Orden de Trabajo`
            : 'Crear Orden de Trabajo'
        }
        subtitle={
          order
            ? `${formatEntityDisplay('production.workorder', order as unknown as Record<string, unknown>)} · ${order.sale_customer_name || 'Manual'} · ${formatPlainDate(order.created_at)}`
            : 'Planificación de Producción • Nueva OT'
        }
        description={STAGES[viewingStepIndex]?.label}
        headerActions={
          <div className="flex items-center gap-2">
            {order && (
              <>
                <StatusBadge
                  status={order.status}
                />
                {order.status === 'IN_PROGRESS' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const saleOrderId = typeof order.sale_order === 'object' ? order.sale_order?.id : order.sale_order
                      const id = saleOrderId ?? order.id
                      const type = saleOrderId ? 'sale' : 'purchase'
                      openHub({ orderId: id, type: type as 'sale' | 'purchase', onActionSuccess: fetchOrder })
                    }}
                  >
                    Centro de Comando
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDuplicateModalOpen(true)}
                  title="Duplicar"
                  disabled={mutations.isDuplicating}
                >
                  Duplicar
                </Button>
                {order.status !== 'FINISHED' && order.status !== 'CANCELLED' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAnnulModalOpen(true)}
                    title="Anular"
                    disabled={mutations.isAnnuling}
                    className="text-warning hover:text-warning"
                  >
                    Anular
                  </Button>
                )}
                {order.status === 'DRAFT' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsDeleteModalOpen(true)}
                    title="Eliminar"
                    disabled={mutations.isDeleting}
                    className="text-destructive hover:text-destructive"
                  >
                    Eliminar
                  </Button>
                )}
              </>
            )}
          </div>
        }
        footer={
          <WizardStickyFooter
            isViewingCurrentStage={isViewingCurrentStage}
            stepMode={stepMode}
            onCancelEdit={() => navigateToStep(viewingStepIndex, 'view')}
            onClose={() => onOpenChange(false)}
            pendingTasks={pendingTasks}
            canApproveAll={canApproveAll}
            order={order}
            viewingStepIndex={viewingStepIndex}
            actualStepIndex={actualStepIndex}
            stages={STAGES}
            transitioning={loading}
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
            isCreating={isCreating}
            isBasicInfoEditable={isBasicInfoEditable}
            chosenOtType={chosenOtType}
            onStepChange={setViewingStepIndex}
          />
        }
      >
        <div className="flex h-full min-h-0 overflow-hidden">
          <WizardProcessSidebar
            stages={STAGES}
            viewingStepIndex={viewingStepIndex}
            actualStepIndex={actualStepIndex}
            stepMode={stepMode}
            onStepClick={(index, mode) => {
              if (mode === 'rewind') {
                // Trigger backward transition modal without moving the viewing index yet
                const targetStage = STAGES[index]
                if (targetStage) {
                  setPendingPrevStage(targetStage.id)
                  setIsBackwardModalOpen(true)
                }
              } else {
                navigateToStep(index, mode)
              }
            }}
            order={order}
          />

          {/* Center content */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="px-6 pt-6 mb-4 flex-shrink-0">
              <WizardModeBanner mode={stepMode} isViewingCurrentStage={isViewingCurrentStage} />
            </div>

            <div className="flex flex-1 flex-col min-h-0 px-6 relative">
              {/* Mobile navigation */}
              <div className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur p-3 mb-4">
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
                    let disabled = !isPast && !isCurrent
                    if (isCreating) {
                      disabled = s.id !== 'ORIGIN_SELECTION' && chosenOtType === null
                    }
                    return {
                      value: s.id,
                      disabled,
                      label: (
                        <div className="flex items-center gap-2">
                          <s.icon className="h-4 w-4" />
                          <span>{s.label}</span>
                          {isPast && <CheckCircle2 className="h-3 w-3 ml-2 text-success" />}
                        </div>
                      ),
                    }
                  }) as Parameters<typeof LabeledSelect>[0]['options']}
                />
              </div>

              <div
                  key={viewingStepIndex}
                  className={cn(
                    'flex flex-col flex-1 min-h-0 overflow-y-auto space-y-6 pb-6',
                    'animate-in fade-in slide-in-from-right-2 ease-premium duration-200 fill-mode-both',
                    // Lock creation steps (other than MFG_CONFIG which has its own summary)
                    // once the OT has been created — they become read-only history.
                    !isCreating && (
                      currentStageId === 'ORIGIN_SELECTION'
                      || currentStageId === 'SALE_ORDER_PRODUCT'
                      || currentStageId === 'PRODUCT_SELECTION'
                    ) && 'pointer-events-none opacity-70',
                    // Disable interaction only in view mode for closed workflow steps (not edit-in-place)
                    stepMode === 'view' && !isViewingCurrentStage
                      && currentStageId !== 'ORIGIN_SELECTION'
                      && currentStageId !== 'SALE_ORDER_PRODUCT'
                      && currentStageId !== 'PRODUCT_SELECTION'
                      && currentStageId !== 'MFG_CONFIG'
                      && 'pointer-events-none opacity-70'
                  )}
                >
                  {currentStageId === 'ORIGIN_SELECTION' && (
                    <OriginSelectionStep
                      selected={chosenOtType}
                      onChoose={(type) => {
                        setChosenOtType(type)
                        const idx = getCreateStages(type).findIndex(s => s.id === (type === "LINKED" ? 'SALE_ORDER_PRODUCT' : 'PRODUCT_SELECTION'))
                        setViewingStepIndex(idx >= 0 ? idx : 1)
                      }}
                    />
                  )}
                  {currentStageId === 'SALE_ORDER_PRODUCT' && chosenOtType === "LINKED" && (
                    <SaleOrderProductStep
                      onChooseProduct={(otType, productId, quantity, uomId, productDescription, saleOrderId, saleLineId) => {
                        setChosenOtType(otType)
                        setSelectedSaleOrder(saleOrderId ?? null)
                        setSelectedSaleLine(saleLineId ?? null)
                        setSelectedProduct(productId)
                        setQuantity(quantity)
                        setUomId(uomId)
                        setProductDescription(productDescription)
                        const idx = getCreateStages("LINKED").findIndex(s => s.id === 'MFG_CONFIG')
                        setViewingStepIndex(idx >= 0 ? idx : 1)
                      }}
                      initialOtType={chosenOtType}
                    />
                  )}
                  {currentStageId === 'PRODUCT_SELECTION' && chosenOtType === "NONE" && (
                    <ProductSelectionStep
                      onChooseProduct={(otType, productId, quantity, uomId, productDescription) => {
                        setChosenOtType(otType)
                        setSelectedProduct(productId)
                        setQuantity(quantity)
                        setUomId(uomId)
                        setProductDescription(productDescription)
                        const idx = getCreateStages("NONE").findIndex(s => s.id === 'MFG_CONFIG')
                        setViewingStepIndex(idx >= 0 ? idx : 1)
                      }}
                      initialOtType={chosenOtType}
                    />
                  )}
                  {currentStageId === 'MFG_CONFIG' && (
                    <ManufacturingConfigStep
                      formId="wizard-basic-form"
                      initialData={isCreating ? (mode.kind === 'create' ? mode.initialData : undefined) : (order as unknown as WorkOrderInitialData)}
                      onSuccess={(workOrderId) => {
                        if (isCreating) {
                          wasCreatingRef.current = true
                          setLocalOrderId(workOrderId)
                          // Navigate to MATERIAL_ASSIGNMENT immediately in unified stages
                          const unifiedStages = getUnifiedStages(chosenOtType, null)
                          const matIdx = unifiedStages.findIndex(s => s.id === 'MATERIAL_ASSIGNMENT')
                          setViewingStepIndex(matIdx >= 0 ? matIdx : 0)

                          // Sync URL transition create -> manage
                          const url = new URL(window.location.href)
                          url.searchParams.delete('new')
                          url.searchParams.delete('modal')
                          url.searchParams.delete('type')
                          url.searchParams.delete('product_id')
                          url.searchParams.set('selected', String(workOrderId))
                          url.searchParams.set('step', 'MATERIAL_ASSIGNMENT')
                          router.replace(url.pathname + url.search, { scroll: false })

                          onSuccess?.(workOrderId)
                        } else {
                          fetchOrder()
                          onSuccess?.(workOrderId)
                        }
                      }}
                      onRestartComplete={() => {
                        // Navigate to create mode — URL change naturally switches wizard from manage → create
                        const url = new URL(window.location.href)
                        url.searchParams.delete('selected')
                        url.searchParams.delete('step')
                        url.searchParams.set('new', '1')
                        url.searchParams.set('type', order?.sale_order ? 'sale' : 'stock')
                        router.push(url.pathname + url.search)
                      }}
                      onCorrectionComplete={(newOrderId) => {
                        // Navigate to the newly created order
                        const url = new URL(window.location.href)
                        url.searchParams.delete('new')
                        url.searchParams.delete('type')
                        url.searchParams.delete('product_id')
                        url.searchParams.set('selected', String(newOrderId))
                        url.searchParams.delete('step')
                        router.push(url.pathname + url.search)
                      }}
                    />
                  )}
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
                </div>
            </div>
          </div>

          {order && (
            <WizardRightSidebar
              order={order}
              viewingStepIndex={viewingStepIndex}
              productName={productName}
              stageData={stageData}
            />
          )}
        </div>
      </Drawer>

      {/* PO Preview */}
      <BaseModal
        open={showPOPreview}
        onOpenChange={setShowPOPreview}
        icon={Package}
        title="Vista Previa de Órdenes de Compra"
        description="Se generarán las siguientes Órdenes de Compra en borrador para los servicios tercerizados asignados."
        size="md"
        footer={
          <FormFooter
            actions={
              <>
                <CancelButton onClick={() => setShowPOPreview(false)}>Cancelar y Revisar</CancelButton>
                <Button onClick={() => {
                  setShowPOPreview(false)
                  const nextStage = STAGES[actualStepIndex + 1]?.id
                  if (nextStage) handleTransition(nextStage)
                }}>
                  Confirmar y Generar OC
                </Button>
              </>
            }
          />
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
        open={showCheatsheet}
        onOpenChange={setShowCheatsheet}
        icon={Keyboard}
        title="Atajos de teclado"
        description="Combinaciones rápidas para optimizar su flujo de trabajo."
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
