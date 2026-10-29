"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { AlertTriangle, Eye, Factory, FileText, Pencil, Plus, Keyboard, Printer, Link2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

import {
  ActionConfirmModal,
  BaseModal,
  Drawer,
  CancelButton,
  FormFooter,
  StatusBadge,
  DocumentActionsMenu,
  TabBar,
  TabBarContent,
  type DocumentActionItem,
} from '@/components/shared'
import { cn } from '@/lib/utils'
import { formatEntityDisplay, getDomainConceptTitle, getDomainConceptCode } from '@/lib/entity-registry'
import { showApiError } from '@/lib/errors'
import { useVatRate } from '@/hooks/useVatRate'
import { useAuth } from '@/contexts/AuthContext'
import { useGlobalModals } from '@/components/providers/GlobalModalProvider'
import { useOnEntityStackClose } from '@/hooks/useOnEntityStackClose'
import { DocumentRelationsTab, useDocumentRelations } from '@/features/documents'
import { useWorkOrderMutations, productionApi } from '../hooks'
import { completeTask } from '@/features/workflow'

import { WizardProcessSidebar } from './WizardProcessSidebar'
import { MobileStageDrawer } from './MobileStageDrawer'
import { WizardStickyFooter } from './WizardStickyFooter'
import { WizardRightSidebar, WizardDraftSidebar } from './WizardRightSidebar'
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
import { useWizardStore, selectPendingTasks, unmetRequirements } from './WorkOrderWizardStore'
import type { WorkOrder, WorkOrderMaterial, WorkOrderStage, WorkOrderTask, WizardMode } from '../types'
import type { WorkOrderInitialData } from '@/types/forms'
import { STAGES_ORDERED } from '../constants/stages'
import { getStepCapabilities } from '../lib/stepGovernance'
import { stageTaskType } from '../lib/stageTask'

import { OriginSelectionStep } from './steps/OriginSelectionStep'
import { SaleOrderProductStep } from './steps/SaleOrderProductStep'
import { ProductSelectionStep } from './steps/ProductSelectionStep'
import { ManufacturingConfigStep } from './steps/ManufacturingConfigStep'

// ── Constants ─────────────────────────────────────────────────────────────────

const RAIL_COLLAPSED_STORAGE_KEY = 'erpgrafico.production.railCollapsed'
const RIGHT_RAIL_COLLAPSED_STORAGE_KEY = 'erpgrafico.production.rightRailCollapsed'

const STEP_ORIGIN: WorkOrderStage = {
  id: 'ORIGIN_SELECTION',
  label: 'Origen de Fabricación',
  icon: Factory,
  alwaysShow: true,
  isCreationStep: true,
}

function getProductSelectionStage(otType: 'LINKED' | 'NONE' | null): WorkOrderStage {
  if (otType === 'LINKED') {
    return {
      id: 'SALE_ORDER_PRODUCT',
      label: `Selección de ${getDomainConceptTitle('ov')} y Producto`,
      icon: FileText,
      alwaysShow: true,
      isCreationStep: true,
    }
  }
  return {
    id: 'PRODUCT_SELECTION',
    label: otType === 'NONE' ? 'Selección de Producto (Stock)' : 'Selección de Producto',
    icon: Plus,
    alwaysShow: true,
    isCreationStep: true,
  }
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

  const virtualSteps: WorkOrderStage[] = [
    STEP_ORIGIN,
    getProductSelectionStage(otType),
    STEP_MFG_CONFIG,
  ]
  return [...virtualSteps, ...BASE_STAGES.filter((s) => s.alwaysShow)]
}

function getUnifiedStages(
  chosenOtType: 'LINKED' | 'NONE' | null,
  order: WorkOrder | null
): WorkOrderStage[] {
  const effectiveType = chosenOtType ?? (order?.sale_order ? 'LINKED' : 'NONE')
  const creationSteps: WorkOrderStage[] = [
    { ...STEP_ORIGIN, alwaysShow: true },
    { ...getProductSelectionStage(effectiveType), alwaysShow: true },
    { ...STEP_MFG_CONFIG, alwaysShow: true },
  ]

  // Build workflow steps (filtered if order is available, otherwise alwaysShow)
  const workflowStages = order
    ? [...getFilteredStages(order)]
    : [...BASE_STAGES.filter((s) => s.alwaysShow)]

  return [...creationSteps, ...workflowStages]
}

function getFilteredStages(order: WorkOrder): WorkOrderStage[] {
  // The server owns the stage graph; its plan is what transitions accept.
  if (order.stage_plan?.length) {
    return BASE_STAGES.filter((stage) => order.stage_plan?.some((id) => id === stage.id))
  }
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
    // Always part of the flow: FINISHED is only reachable from RECTIFICATION
    if (stage.id === 'RECTIFICATION') return true
    return false
  })
}

const EDITABLE_STAGES = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS']

type RefValue = string | number | { id: string | number } | null | undefined

/** Id of a reference that may come expanded ({ id }) or as a plain id. */
function refId(value: RefValue): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  return String(typeof value === 'object' ? value.id : value)
}

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
  const { openEntity } = useGlobalModals()
  const { multiplier: vatMultiplier } = useVatRate()
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
  // localOrderId: null = create mode, number = manage mode
  const [localOrderId, setLocalOrderId] = useState<number | null>(
    mode.kind === 'manage' ? mode.orderId : null
  )
  const wasCreatingRef = useRef(false)
  // targetStage from the URL is only used for the initial navigation; subsequent
  // fetchOrder calls (after transitions) must navigate to the actual current_stage.
  const initialTargetUsedRef = useRef(false)
  const isCreating = localOrderId === null

  // ── mutations (all write ops via hook) ─────────────────────────────────────
  const mutations = useWorkOrderMutations(localOrderId ?? 0, { onSuccess: () => { fetchOrder(); onSuccess?.() } })

  // ── store ──────────────────────────────────────────────────────────────────
  const {
    order, loading, viewingStepIndex, stepMode,
    taskNotes, taskFiles, taskConfirmations,
    isAnnulModalOpen, isBackwardModalOpen, pendingPrevStage,
    showPOPreview, outsourcedPending,
    rectificationAdjustments, rectificationProducedQty, rectificationOutsourcedAdjustments,
    // Creation flow state
    chosenOtType, mfgConfig, selectedProduct,
    setOrder, setLoading, setViewingStepIndex, navigateToStep,
    setTaskNote, setTaskFile,
    setIsAnnulModalOpen, setIsBackwardModalOpen, setPendingPrevStage,
    setShowPOPreview, setOutsourcedPending,
    setRectificationAdjustments, setRectificationProducedQty, setRectificationOutsourcedAdjustments,
    // Creation flow actions
    setChosenOtType, setSelectedSaleOrder, setSelectedSaleLine, setSelectedProduct, setProductDescription, setMfgConfig,
    setSelectedContact, setQuantity, setUomId, setStartDate, setDueDate, setInternalNotes,
    setTaskConfirmation,
    reset: resetStore,
  } = useWizardStore()

  const [showCheatsheet, setShowCheatsheet] = useState(false)
  const [wizardTab, setWizardTab] = useState('stages')
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false)
  const [blockingWarning, setBlockingWarning] = useState<string | null>(null)
  const { data: relationsData } = useDocumentRelations('production.workorder', order?.id ?? null)

  // Restore the rail preferences after mount (avoids SSR/client hydration mismatch).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY) === '1') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a browser preference after mount to avoid an SSR/client hydration mismatch
        setRailCollapsed(true)
      }
      if (window.localStorage.getItem(RIGHT_RAIL_COLLAPSED_STORAGE_KEY) === '1') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a browser preference after mount to avoid an SSR/client hydration mismatch
        setRightRailCollapsed(true)
      }
    } catch {
      // Storage can be unavailable (private mode); keep the expanded default.
    }
  }, [])

  const toggleRail = useCallback(() => {
    setRailCollapsed((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Ignore storage failures; the in-memory preference still works.
      }
      return next
    })
  }, [])

  const toggleRightRail = useCallback(() => {
    setRightRailCollapsed((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem(RIGHT_RAIL_COLLAPSED_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Ignore storage failures; the in-memory preference still works.
      }
      return next
    })
  }, [])

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
  const currentStageId = STAGES[viewingStepIndex]?.id
  const isTerminalOrder = order?.status === 'FINISHED' || order?.status === 'CANCELLED'
  // A closed stage is read-only; its only action is "Reabrir etapa". Materials and services
  // stay adjustable in place while the server still allows it.
  const showStageNotice = !isCreating && !!order && !isViewingCurrentStage
  const viewedCaps = showStageNotice && order ? getStepCapabilities(currentStageId as string, order) : null
  const editableInline = !!viewedCaps?.canEdit
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

  // Approval tasks belonging specifically to the stage currently being viewed.
  // When viewing stages that have no approval tasks (or non-approval stages), this will be empty,
  // ensuring the approval collapsible only visualizes on its own stage.
  const viewedStageTasks = useMemo(() => {
    if (!currentStageId) return []
    const type = stageTaskType(currentStageId)
    return (order?.workflow_tasks ?? []).filter((t: WorkOrderTask) => t.task_type === type)
  }, [order, currentStageId])

  // All stage history entries of the order — for the segmented history timeline.
  const allStageHistory = useMemo(
    () => order?.stage_history ?? [],
    [order]
  )

  // Blocking reason shown next to "Siguiente" when mandatory approval fields are unfilled.
  const approvalBlockedReason = useMemo(() => {
    if (!isViewingCurrentStage) return undefined
    return pendingTasks
      .flatMap((t) => unmetRequirements(t, taskFiles, taskConfirmations).map((key) => t.requirements?.[key]))
      .find(Boolean) as string | undefined
  }, [isViewingCurrentStage, pendingTasks, taskFiles, taskConfirmations])

  // Actions rendered inside each step's StepHeader.rightContent — read/edit/reopen badge.
  const stageHeaderActions = useMemo((): ReactNode => {
    if (isCreating || !order || isViewingCurrentStage) return null
    if (isTerminalOrder) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
          <Eye className="h-3 w-3 shrink-0" aria-hidden />Solo lectura
        </span>
      )
    }
    if (!viewedCaps) return null
    const openRewind = () => { setPendingPrevStage(currentStageId as string); setIsBackwardModalOpen(true) }
    if (viewedCaps.canEdit) {
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-info/30 bg-info/10 px-2.5 py-1 text-xs font-medium text-info">
            <Pencil className="h-3 w-3 shrink-0" aria-hidden />Editable
          </span>
          {viewedCaps.canRewind && (
            <Button type="button" variant="outline" size="sm" onClick={openRewind} className="h-7 gap-1.5 text-xs">
              <RotateCcw className="h-3 w-3" aria-hidden />Reabrir
            </Button>
          )}
        </div>
      )
    }
    if (viewedCaps.canRewind) {
      return (
        <Button type="button" variant="outline" size="sm" onClick={openRewind} className="h-7 gap-1.5 text-xs">
          <RotateCcw className="h-3 w-3" aria-hidden />Reabrir etapa
        </Button>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground" title={viewedCaps.rewindBlockedReason}>
        <Eye className="h-3 w-3 shrink-0" aria-hidden />Solo lectura
      </span>
    )
  }, [isCreating, order, isViewingCurrentStage, isTerminalOrder, viewedCaps, currentStageId, setPendingPrevStage, setIsBackwardModalOpen])

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
      // targetStage (from the URL ?step= param) is only honoured on the first load.
      // Post-transition refreshes must follow the order to its new current_stage.
      const targetStage = !initialTargetUsedRef.current && mode.kind === 'manage' ? mode.targetStage : undefined
      if (targetStage) {
        resolvedIndex = stages.findIndex((s) => s.id === targetStage)
        initialTargetUsedRef.current = true
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
  // Al volver de la ficha de la orden (ADR-0083) se recarga la OT
  useOnEntityStackClose(() => { void fetchOrder() })

  // Local state follows the props during render (no effect needed); the zustand store must
  // not be touched here, since updating it while rendering warns, so it resets in an effect.
  const [prevMode, setPrevMode] = useState(mode)
  const [prevOpen, setPrevOpen] = useState(open)

  const isModeChanged = !prevMode ||
    mode.kind !== prevMode.kind ||
    (mode.kind === 'manage' && prevMode.kind === 'manage' && mode.orderId !== prevMode.orderId) ||
    (mode.kind === 'create' && prevMode.kind === 'create' && (mode.defaultOtType !== prevMode.defaultOtType || mode.defaultProductId !== prevMode.defaultProductId))

  if (isModeChanged || open !== prevOpen) {
    setPrevMode(mode)
    setPrevOpen(open)
    setLocalOrderId(open && mode.kind === 'manage' ? mode.orderId : null)
    // Reset so the new targetStage (from the URL) is honoured on re-open.
    initialTargetUsedRef.current = false
  }

  useEffect(() => {
    // chosenOtType of a managed OT is set by fetchOrder once the order loads
    if (!open || mode.kind !== 'create') return
    // Opened from a sale order ("Crear OT") or a product ("Fabricar"): start on the
    // selection step of that origin instead of asking for it again.
    const fromSaleOrder = !!refId(mode.initialData?.sale_order)
    const otType = fromSaleOrder ? 'LINKED' : (mode.defaultOtType || null)
    setChosenOtType(otType)
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
    setViewingStepIndex(fromSaleOrder || (otType === 'NONE' && mode.defaultProductId) ? 1 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, open])

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

  // Clear blocking warning when stage changes
  useEffect(() => {
    setBlockingWarning(null)
  }, [viewingStepIndex])

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
  const [approving, setApproving] = useState(false)
  const transitioning = loading || approving || mutations.isTransitioning || mutations.isRectifying

  // Moving forward requires the current stage's approvals (the server enforces it too).
  // Returns false when they could not be completed, after telling the user why.
  const approvePendingTasks = async (): Promise<boolean> => {
    const toApprove = pendingTasks.filter(canUserCompleteTask)
    if (toApprove.length === 0) return true

    // Read fresh state to avoid stale closure capturing the values at mount time.
    const { taskFiles: freshFiles, taskConfirmations: freshConfs, taskNotes: freshNotes } = useWizardStore.getState()

    // Pre-flight: reject immediately if any mandatory field is still empty.
    for (const t of toApprove) {
      const unmet = unmetRequirements(t, freshFiles, freshConfs)
      if (unmet.length > 0) {
        toast.error(t.requirements?.[unmet[0]] ?? 'Complete todos los campos requeridos de aprobación.')
        return false
      }
    }

    setApproving(true)
    try {
      await Promise.all(toApprove.map((t) => {
        const file = freshFiles[t.id]
        return completeTask(
          t.id as number,
          freshNotes[t.id],
          file ? [file] : undefined,
          freshConfs[t.id],
        )
      }))
      return true
    } catch (err) {
      showApiError(err, 'No se pudieron completar las aprobaciones de la etapa')
      return false
    } finally {
      setApproving(false)
    }
  }

  const handleTransition = async (nextStageId: string, data: Record<string, unknown> = {}, notes?: string) => {
    if (!order) return

    const nextIndex = STAGES.findIndex((s) => s.id === nextStageId)
    const currentIndex = STAGES.findIndex((s) => s.id === order.current_stage)
    const isMovingForward = nextIndex > currentIndex

    if (isMovingForward) {
      const unapprovable = pendingTasks.filter((t) => !canUserCompleteTask(t))
      if (unapprovable.length > 0) { setBlockingWarning('Existen tareas de aprobación pendientes asignadas a otros usuarios.'); return }
    }

    if (order.current_stage === 'MATERIAL_APPROVAL' && isMovingForward) {
      const missing = order.materials?.filter((m: WorkOrderMaterial) => !m.is_outsourced && !m.is_available) ?? []
      if (missing.length > 0) { setBlockingWarning(`Stock insuficiente para ${missing.length} componentes. Reponga stock para continuar.`); return }
    }

    if (order.current_stage === 'OUTSOURCING_ASSIGNMENT' && isMovingForward) {
      const pending = order.materials?.filter((m: WorkOrderMaterial) => m.is_outsourced && !m.purchase_order_number) ?? []
      if (pending.length > 0 && !showPOPreview) { setOutsourcedPending(pending); setShowPOPreview(true); return }
    }

    if (transitioning) return
    if (isMovingForward && !(await approvePendingTasks())) return
    try {
      const res = await mutations.transition({ nextStageId, data, notes })
      initialTargetUsedRef.current = true
      const targetStage = (res as { current_stage?: string })?.current_stage || nextStageId
      const targetIdx = STAGES.findIndex((s) => s.id === targetStage)
      if (targetIdx >= 0) {
        setViewingStepIndex(targetIdx)
      }
    } catch {
      // The mutation already showed the error
    }
  }

  // Closing never throws work away silently: Esc / the close button first leave an in-progress
  // edit, then ask before discarding a work order that is still being created.
  const [discardOpen, setDiscardOpen] = useState(false)
  const hasCreationDraft = isCreating && !!(selectedProduct || mfgConfig)
  const handleOpenChange = (next: boolean) => {
    if (next) { onOpenChange(true); return }
    if (stepMode === 'edit-in-place') { navigateToStep(viewingStepIndex, 'view'); return }
    if (hasCreationDraft) { setDiscardOpen(true); return }
    onOpenChange(false)
  }

  // ── keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setShowCheatsheet((v) => !v); return
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleRail()
        return
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        toggleRightRail()
        return
      }
      if (!e.ctrlKey) return
      if (e.key === 'ArrowRight' && isViewingCurrentStage && order?.status !== 'FINISHED' && order?.status !== 'CANCELLED') {
        // Same path as the footer button: it knows what is blocked and asks for confirmation.
        if (!order) return
        e.preventDefault()
        document.getElementById('wizard-next')?.click()
      }
      if (e.key === 'ArrowLeft' && viewingStepIndex > 0) {
        setViewingStepIndex((v) => v - 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, viewingStepIndex, isViewingCurrentStage, order, pendingTasks, toggleRail, toggleRightRail])

  const handleRectifyAndFinish = async () => {
    if (!order || transitioning) return
    const unapprovable = pendingTasks.filter((t) => !canUserCompleteTask(t))
    if (unapprovable.length > 0) { setBlockingWarning('Existen tareas de aprobación pendientes asignadas a otros usuarios.'); return }
    try {
      await mutations.rectify({
        materialAdjustments: rectificationAdjustments,
        outsourcedAdjustments: rectificationOutsourcedAdjustments,
        producedQuantity: rectificationProducedQty,
        notes: 'Rectificación desde wizard',
      })
      if (!(await approvePendingTasks())) return
      await mutations.transition({ nextStageId: 'FINISHED' })
    } catch {
      // The mutation already showed the error
    }
  }

  // Errors are shown by the mutations themselves; the handlers only keep the modal open.
  const handleAnnul = async (reason?: string) => {
    try {
      await mutations.annul(reason ?? '')
      setIsAnnulModalOpen(false)
    } catch { /* shown by the mutation */ }
  }

  const handleDuplicate = async () => {
    try {
      await mutations.duplicateOrder()
      setIsDuplicateModalOpen(false)
    } catch { /* shown by the mutation */ }
  }



  // ── render ─────────────────────────────────────────────────────────────────
  // An OT that exists but is not loaded yet (right after creating it, or while fetching)
  // has no data for the workflow steps, which all assume `order`.
  if (!order && (loading || !isCreating)) return null

  const stageData = order?.stage_data ?? {}
  const productName = order?.product_name ?? order?.sale_line?.product?.name ?? 'Producto'
  const orderHasMaterials = !!(order?.materials ?? []).some((m: WorkOrderMaterial) => !m.is_outsourced)

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={handleOpenChange}
        side="bottom"
        boundary="embedded"
        defaultSize="100%"
        resizable={false}
        fillContent
        contentClassName="p-0 flex flex-col overflow-hidden"
        icon={Factory}
        title={
          order
            ? formatEntityDisplay('production.workorder', order as unknown as Record<string, unknown>)
            : `Nueva ${getDomainConceptTitle('ot')}`
        }
        subtitle={
          order
            ? `${getDomainConceptTitle('ot')} · ${order.sale_customer_name || 'Manual'}`
            : 'Planificación de Producción'
        }
        headerActions={
          order ? (
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} variant="badge" />
              <DocumentActionsMenu
                primary={(() => {
                  // Only a linked OT has an order to open (a manual OT has none).
                  const saleOrderId = typeof order.sale_order === 'object' ? order.sale_order?.id : order.sale_order
                  if (!saleOrderId) return null
                  return {
                    id: 'view-order',
                    label: `Ver ${getDomainConceptCode('ov')}`,
                    onClick: () => openEntity('sales.saleorder', saleOrderId),
                  }
                })()}
                actions={(() => {
                  const items: DocumentActionItem[] = []

                  items.push({
                    id: 'duplicate',
                    label: 'Duplicar',
                    onClick: () => setIsDuplicateModalOpen(true),
                    disabled: mutations.isDuplicating,
                  })

                  // Same rule the server applies (limit stage, no consumptions)
                  if (order.status !== 'FINISHED' && order.status !== 'CANCELLED' && order.is_cancellable !== false && !order.has_consumptions) {
                    items.push({
                      id: 'annul',
                      label: 'Anular',
                      onClick: () => setIsAnnulModalOpen(true),
                      disabled: mutations.isAnnuling,
                      destructive: true,
                    })
                  }

                  return items
                })()}
              />
            </div>
          ) : undefined
        }
        footer={
          <WizardStickyFooter
            isViewingCurrentStage={isViewingCurrentStage}
            stepMode={stepMode}
            onCancelEdit={() => navigateToStep(viewingStepIndex, 'view')}
            onClose={() => onOpenChange(false)}
            pendingTasks={pendingTasks}
            approvalBlockedReason={approvalBlockedReason}
            canApproveAll={canApproveAll}
            order={order}
            viewingStepIndex={viewingStepIndex}
            actualStepIndex={actualStepIndex}
            stages={STAGES}
            transitioning={transitioning}
            onTransition={handleTransition}
            onBackToCurrent={() => setViewingStepIndex(actualStepIndex)}
            onBack={() => setViewingStepIndex(Math.max(0, viewingStepIndex - 1))}
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
            tabDisabled={wizardTab !== 'stages'}
          />
        }
      >
        <div className="flex flex-1 min-h-0 overflow-hidden">
        <TabBar
          items={order ? [
            { value: 'stages', label: 'Producción', icon: Factory },
            { value: 'relations', label: 'Relaciones', icon: Link2, badge: relationsData?.relations.length },
          ] : [{ value: 'stages', label: 'Producción', icon: Factory }]}
          value={wizardTab}
          onValueChange={setWizardTab}
          orientation="horizontal"
          variant="underline"
          className="flex-1 min-h-0"
          contentClassName="bg-transparent"
        >
          <TabBarContent
            value="stages"
            className="data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-hidden"
          >
          <div className="flex flex-1 min-h-0 overflow-hidden">
          <WizardProcessSidebar
            stages={STAGES}
            viewingStepIndex={viewingStepIndex}
            actualStepIndex={actualStepIndex}
            stepMode={stepMode}
            onStepClick={(index) => navigateToStep(index, 'view')}
            order={order}
            collapsed={railCollapsed}
            onToggleCollapsed={toggleRail}
          />

          {/* Center content */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex flex-1 flex-col min-h-0 px-6 relative">
              {/* Mobile navigation */}
              <div className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur p-3 mb-4">
                <MobileStageDrawer
                  stages={STAGES}
                  viewingStepIndex={viewingStepIndex}
                  actualStepIndex={actualStepIndex}
                  stepMode={stepMode}
                  order={order}
                  isCreating={isCreating}
                  chosenOtType={chosenOtType}
                  onStepClick={(index) => navigateToStep(index, 'view')}
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
                    stepMode === 'view' && !isViewingCurrentStage && !editableInline
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
                      locked={!isCreating}
                      headerActions={stageHeaderActions}
                      onChoose={(type) => {
                        if (type !== chosenOtType) {
                          // Switching origin invalidates everything chosen for the previous one
                          setSelectedSaleOrder(null)
                          setSelectedSaleLine(null)
                          setSelectedProduct(null)
                          setProductDescription('')
                          setMfgConfig(null)
                          setSelectedContact(null)
                          setQuantity('')
                          setUomId('')
                        }
                        setChosenOtType(type)
                        const idx = getCreateStages(type).findIndex(s => s.id === (type === "LINKED" ? 'SALE_ORDER_PRODUCT' : 'PRODUCT_SELECTION'))
                        setViewingStepIndex(idx >= 0 ? idx : 1)
                      }}
                    />
                  )}
                  {currentStageId === 'SALE_ORDER_PRODUCT' && chosenOtType === "LINKED" && (
                    <SaleOrderProductStep
                      headerActions={stageHeaderActions}
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
                      initialSaleOrderId={mode.kind === 'create' ? refId(mode.initialData?.sale_order) : (order?.sale_order ? String(typeof order.sale_order === 'object' ? order.sale_order?.id : order.sale_order) : undefined)}
                      initialSaleLineId={mode.kind === 'create' ? refId(mode.initialData?.sale_line) : (order?.sale_line ? String(order.sale_line.id) : undefined)}
                      readOnly={!isCreating}
                      readOnlyOrderInfo={!isCreating && order ? {
                        number: order.sale_order_number ?? (typeof order.sale_order === 'object' ? order.sale_order?.number : undefined),
                        customer_name: order.sale_customer_name,
                        date: order.sale_order_date,
                      } : undefined}
                      readOnlyLineInfo={!isCreating && order?.sale_line ? {
                        product_name: order.sale_line.product?.name ?? order.product_name,
                        description: order.sale_line.description,
                        quantity: order.sale_line.quantity,
                        uom_name: order.sale_line.uom?.name,
                      } : undefined}
                    />
                  )}
                  {currentStageId === 'PRODUCT_SELECTION' && chosenOtType === "NONE" && (
                    <ProductSelectionStep
                      headerActions={stageHeaderActions}
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
                      initialProductId={mode.kind === 'create' ? mode.defaultProductId : (order?.main_product_id ? String(order.main_product_id) : undefined)}
                    />
                  )}
                  {currentStageId === 'MFG_CONFIG' && (
                    <ManufacturingConfigStep
                      formId="wizard-basic-form"
                      initialData={isCreating ? undefined : (order as unknown as WorkOrderInitialData)}
                      headerActions={stageHeaderActions}
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
                    />
                  )}
                  {currentStageId === 'MATERIAL_ASSIGNMENT' && (
                    <MaterialAssignmentStep
                      order={order as WorkOrder}
                      isViewingCurrentStage={isViewingCurrentStage || editableInline}
                      onMaterialSaved={fetchOrder}
                      onMaterialDeleted={fetchOrder}
                      headerActions={stageHeaderActions}
                    />
                  )}
                  {currentStageId === 'MATERIAL_APPROVAL' && (
                    <MaterialApprovalStep order={order as WorkOrder} headerActions={stageHeaderActions} />
                  )}
                  {currentStageId === 'OUTSOURCING_ASSIGNMENT' && (
                    <OutsourcingAssignmentStep
                      order={order as WorkOrder}
                      isViewingCurrentStage={isViewingCurrentStage || editableInline}
                      onMaterialSaved={fetchOrder}
                      onMaterialDeleted={fetchOrder}
                      headerActions={stageHeaderActions}
                    />
                  )}
                  {currentStageId === 'PREPRESS' && (
                    <PrepressStep
                      order={order as WorkOrder}
                      stageData={stageData}
                      actionable={isViewingCurrentStage && !isTerminalOrder}
                      onRefresh={fetchOrder}
                      headerActions={stageHeaderActions}
                    />
                  )}
                  {currentStageId === 'PRESS' && (
                    <PressStep
                      order={order as WorkOrder}
                      actionable={isViewingCurrentStage && !isTerminalOrder}
                      onRefresh={fetchOrder}
                      headerActions={stageHeaderActions}
                    />
                  )}
                  {currentStageId === 'POSTPRESS' && (
                    <PostpressStep
                      order={order as WorkOrder}
                      actionable={isViewingCurrentStage && !isTerminalOrder}
                      onRefresh={fetchOrder}
                      headerActions={stageHeaderActions}
                    />
                  )}
                  {currentStageId === 'OUTSOURCING_VERIFICATION' && (
                    <OutsourcingVerificationStep order={order as WorkOrder} headerActions={stageHeaderActions} />
                  )}
                  {currentStageId === 'RECTIFICATION' && (
                    <div className="space-y-6">
                      <RectificationStep
                        order={order as WorkOrder}
                        headerActions={stageHeaderActions}
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
                      order={order as WorkOrder}
                      onUploadPhoto={mutations.uploadFinalPhoto}
                      isUploadingPhoto={mutations.isUploadingPhoto}
                      onPrintCopy={async () => setIsDuplicateModalOpen(true)}
                      isDuplicating={mutations.isDuplicating}
                      headerActions={stageHeaderActions}
                    />
                  )}
                </div>
            </div>

          </div>

          </div>
          </TabBarContent>

          {order && (
            <TabBarContent
              value="relations"
              className="mt-0 px-6 pt-4 pb-8 data-[state=active]:flex data-[state=active]:flex-1 data-[state=active]:flex-col data-[state=active]:min-h-0 overflow-y-auto scrollbar-thin"
            >
              <DocumentRelationsTab label="production.workorder" id={order.id} />
            </TabBarContent>
          )}
        </TabBar>

        {order ? (
          <WizardRightSidebar
            order={order}
            productName={productName}
            stageData={stageData}
            currentStageId={currentStageId as string}
            tasks={viewedStageTasks}
            allTasks={order.workflow_tasks}
            stageEntries={allStageHistory}
            canComplete={canUserCompleteTask}
            actionable={isViewingCurrentStage && !isTerminalOrder}
            taskNotes={taskNotes}
            taskFiles={taskFiles}
            taskConfirmations={taskConfirmations}
            onNoteChange={setTaskNote}
            onFileChange={setTaskFile}
            onConfirmationChange={setTaskConfirmation}
            collapsed={rightRailCollapsed}
            onToggleCollapse={toggleRightRail}
          />
        ) : currentStageId === 'MFG_CONFIG' ? (
          <WizardDraftSidebar />
        ) : null}
        </div>
      </Drawer>

      {/* PO Preview */}
      <BaseModal
        asDialog
        open={showPOPreview}
        onOpenChange={setShowPOPreview}
        icon={Factory}
        title="Vista Previa de Órdenes de Compra"
        description="Se generarán y confirmarán estas Órdenes de Compra (con su factura en borrador). Después ya no podrás reabrir la asignación de tercerizados de esta OT."
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
        title={`Anular ${getDomainConceptTitle('ot')}`}
        variant="warning"
        onConfirm={handleAnnul}
        confirmText={`Anular ${getDomainConceptCode('ot')}`}
        requireReason
        reasonLabel="Motivo de anulación"
        reasonPlaceholder="Explique por qué se anula esta OT..."
        description={
          <div className="space-y-3">
            <p>¿Está seguro de que desea <strong>ANULAR</strong> esta {getDomainConceptTitle('ot')}?</p>
            <div className="bg-warning/10 border border-warning/20 p-3 rounded-md text-warning text-xs flex gap-3 font-medium">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <ul className="list-disc pl-4 space-y-1">
                <li>Se anularán las Órdenes de Compra vinculadas que aún no se hayan recibido.</li>
                <li>Las aprobaciones pendientes de la OT se cancelarán.</li>
                <li>La OT quedará en estado ANULADA y no podrá procesarse más.</li>
              </ul>
            </div>
          </div>
        }
      />


      <ActionConfirmModal
        open={isDuplicateModalOpen}
        onOpenChange={setIsDuplicateModalOpen}
        title={`Duplicar ${getDomainConceptTitle('ot')}`}
        variant="default"
        onConfirm={handleDuplicate}
        confirmText="Duplicar"
        description={`Se creará una nueva ${getDomainConceptCode('ot')} en Borrador con los mismos materiales y configuración. No se vinculará a la ${getDomainConceptTitle('ov')} original.`}
      />

      <ActionConfirmModal
        open={isBackwardModalOpen}
        onOpenChange={setIsBackwardModalOpen}
        title="Reabrir etapa"
        variant="warning"
        requireReason
        reasonLabel="Motivo para reabrir"
        reasonPlaceholder="Ej.: el cliente cambió el diseño"
        onConfirm={(reason) => { if (pendingPrevStage) handleTransition(pendingPrevStage, {}, reason); setIsBackwardModalOpen(false) }}
        confirmText="Reabrir etapa"
        description={
          <div className="space-y-3">
            <p>La orden volverá a la etapa <strong>{STAGES.find((s) => s.id === pendingPrevStage)?.label}</strong> para que puedas modificarla.</p>
            <div className="bg-warning/10 border border-warning/20 p-3 rounded-md text-warning text-xs flex gap-3 font-medium">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <p>Las aprobaciones completadas desde esa etapa en adelante se reiniciarán y deberán aprobarse de nuevo.</p>
                <p>Los datos cargados (materiales, servicios y especificaciones) se conservan.</p>
              </div>
            </div>
          </div>
        }
      />

      <ActionConfirmModal
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Descartar la OT en creación"
        variant="warning"
        confirmText="Descartar"
        description="Aún no se ha creado la OT. Si cierras ahora, se perderá lo que cargaste."
        onConfirm={() => { setDiscardOpen(false); onOpenChange(false) }}
      />

      <ActionConfirmModal
        open={blockingWarning !== null}
        onOpenChange={(open) => { if (!open) setBlockingWarning(null) }}
        title="Validación de etapa"
        variant="warning"
        confirmText="Entendido"
        description={blockingWarning ?? ''}
        onConfirm={() => setBlockingWarning(null)}
      />

      <BaseModal
        asDialog
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
            { keys: ['Alt', 'B'], desc: 'Colapsar/expandir etapas' },
            { keys: ['Alt', 'I'], desc: 'Colapsar/expandir panel de información' },
            { keys: ['Esc'], desc: 'Cerrar el wizard' },
            { keys: ['?'], desc: 'Mostrar/ocultar esta ayuda' },
          ].map(({ keys, desc }) => (
            <div key={desc} className="flex items-center justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
              <span className="text-muted-foreground text-xs">{desc}</span>
              <div className="flex gap-1 shrink-0">
                {keys.map((k) => (
                  <kbd key={k} className="px-2 py-0.5 text-3xs font-mono font-bold bg-muted border border-border rounded">
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
