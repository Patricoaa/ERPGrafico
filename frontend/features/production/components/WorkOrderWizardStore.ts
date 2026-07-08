"use client"

import { create } from 'zustand'
import type { WorkOrder, WorkOrderMaterial, WorkOrderTask, WizardStepMode } from '../types'
import type { ManufacturingData } from '@/components/shared'
import type { Contact } from '@/features/contacts'

interface WizardState {
  // ── data ─────────────────────────────────────────────────────────────────
  order: WorkOrder | null
  loading: boolean
  viewingStepIndex: number
  stepMode: WizardStepMode

  // ── creation flow state ───────────────────────────────────────────────
  chosenOtType: "LINKED" | "NONE" | null
  selectedSaleOrder: string | null
  selectedSaleLine: string | null
  selectedProduct: string | null
  productDescription: string
  mfgConfig: ManufacturingData | null
  selectedContact: Contact | null
  quantity: string
  uomId: string
  startDate: Date | null
  dueDate: Date | null
  internalNotes: string

  // ── implicit task approvals (shared across all approval tabs) ─────────
  taskNotes: Record<string | number, string>
  taskFiles: Record<string | number, File | null>

  // ── modals ────────────────────────────────────────────────────────────────
  isAnnulModalOpen: boolean
  isDeleteModalOpen: boolean
  isBackwardModalOpen: boolean
  pendingPrevStage: string | null
  showPOPreview: boolean
  outsourcedPending: WorkOrderMaterial[]

  // ── rectification ─────────────────────────────────────────────────────────
  rectificationAdjustments: { material_id: number; actual_quantity: number }[]
  rectificationOutsourcedAdjustments: { material_id: number; actual_quantity?: number; actual_unit_price?: number }[]
  rectificationProducedQty: number | null

  // ── actions ───────────────────────────────────────────────────────────────
  setOrder: (order: WorkOrder | null) => void
  setLoading: (loading: boolean) => void
  setViewingStepIndex: (index: number | ((prev: number) => number)) => void
  setStepMode: (mode: WizardStepMode) => void
  /** Atomic: sets index + mode in one render cycle. */
  navigateToStep: (index: number, mode?: WizardStepMode) => void

  setTaskNote: (taskId: string | number, note: string) => void
  setTaskFile: (taskId: string | number, file: File | null) => void

  setIsAnnulModalOpen: (open: boolean) => void
  setIsDeleteModalOpen: (open: boolean) => void
  setIsBackwardModalOpen: (open: boolean) => void
  setPendingPrevStage: (stage: string | null) => void
  setShowPOPreview: (show: boolean) => void
  setOutsourcedPending: (materials: WorkOrderMaterial[]) => void

  setRectificationAdjustments: (
    adjustments: { material_id: number; actual_quantity: number }[]
  ) => void
  setRectificationOutsourcedAdjustments: (
    adjustments: { material_id: number; actual_quantity?: number; actual_unit_price?: number }[]
  ) => void
  setRectificationProducedQty: (qty: number | null) => void

  // ── creation flow actions ───────────────────────────────────────────────
  setChosenOtType: (otType: "LINKED" | "NONE" | null) => void
  setSelectedSaleOrder: (saleOrderId: string | null) => void
  setSelectedSaleLine: (saleLineId: string | null) => void
  setSelectedProduct: (productId: string | null) => void
  setProductDescription: (desc: string) => void
  setMfgConfig: (config: ManufacturingData | null) => void
  setSelectedContact: (contact: Contact | null) => void
  setQuantity: (quantity: string) => void
  setUomId: (uomId: string) => void
  setStartDate: (date: Date | null) => void
  setDueDate: (date: Date | null) => void
  setInternalNotes: (notes: string) => void

  /** Reset all state (call when wizard closes) */
  reset: () => void
}

type WizardStateData = Omit<WizardState,
  | 'setOrder' | 'setLoading' | 'setViewingStepIndex' | 'setStepMode' | 'navigateToStep'
  | 'setTaskNote' | 'setTaskFile'
  | 'setIsAnnulModalOpen' | 'setIsDeleteModalOpen' | 'setIsBackwardModalOpen'
  | 'setPendingPrevStage' | 'setShowPOPreview' | 'setOutsourcedPending'
  | 'setRectificationAdjustments' | 'setRectificationOutsourcedAdjustments' | 'setRectificationProducedQty'
  | 'setChosenOtType' | 'setSelectedSaleOrder' | 'setSelectedSaleLine' | 'setSelectedProduct'
  | 'setProductDescription' | 'setMfgConfig' | 'setSelectedContact' | 'setQuantity' | 'setUomId'
  | 'setStartDate' | 'setDueDate' | 'setInternalNotes'
  | 'reset'
>

const INITIAL: WizardStateData = {
  order: null,
  loading: true,
  viewingStepIndex: 0,
  stepMode: 'view',
  // Creation flow state
  chosenOtType: null,
  selectedSaleOrder: null,
  selectedSaleLine: null,
  selectedProduct: null,
  productDescription: "",
  mfgConfig: null,
  selectedContact: null,
  quantity: "",
  uomId: "",
  startDate: null,
  dueDate: null,
  internalNotes: "",
  // Other state
  taskNotes: {},
  taskFiles: {},
  isAnnulModalOpen: false,
  isDeleteModalOpen: false,
  isBackwardModalOpen: false,
  pendingPrevStage: null,
  showPOPreview: false,
  outsourcedPending: [],
  rectificationAdjustments: [],
  rectificationOutsourcedAdjustments: [],
  rectificationProducedQty: null,
}

export const useWizardStore = create<WizardState>((set) => ({
  ...INITIAL,

  setOrder: (order) => set({ order }),
  setLoading: (loading) => set({ loading }),
  // Navigating to a different step always resets the mode to 'view'.
  // Callers that need 'edit-in-place' or 'rewind' must call setStepMode afterwards.
  setViewingStepIndex: (index) =>
    set((s) => ({
      viewingStepIndex: typeof index === 'function' ? index(s.viewingStepIndex) : index,
      stepMode: 'view',
    })),
  setStepMode: (mode) => set({ stepMode: mode }),
  navigateToStep: (index, mode = 'view') => set({ viewingStepIndex: index, stepMode: mode }),

  setTaskNote: (taskId, note) =>
    set((s) => ({ taskNotes: { ...s.taskNotes, [taskId]: note } })),
  setTaskFile: (taskId, file) =>
    set((s) => ({ taskFiles: { ...s.taskFiles, [taskId]: file } })),

  setIsAnnulModalOpen: (open) => set({ isAnnulModalOpen: open }),
  setIsDeleteModalOpen: (open) => set({ isDeleteModalOpen: open }),
  setIsBackwardModalOpen: (open) => set({ isBackwardModalOpen: open }),
  setPendingPrevStage: (stage) => set({ pendingPrevStage: stage }),
  setShowPOPreview: (show) => set({ showPOPreview: show }),
  setOutsourcedPending: (materials) => set({ outsourcedPending: materials }),

  setRectificationAdjustments: (adjustments) => set({ rectificationAdjustments: adjustments }),
  setRectificationOutsourcedAdjustments: (adjustments) => set({ rectificationOutsourcedAdjustments: adjustments }),
  setRectificationProducedQty: (qty) => set({ rectificationProducedQty: qty }),

  // ── creation flow actions ───────────────────────────────────────────────
  setChosenOtType: (otType) => set({ chosenOtType: otType }),
  setSelectedSaleOrder: (saleOrderId) => set({ selectedSaleOrder: saleOrderId }),
  setSelectedSaleLine: (saleLineId) => set({ selectedSaleLine: saleLineId }),
  setSelectedProduct: (productId) => set({ selectedProduct: productId }),
  setProductDescription: (desc) => set({ productDescription: desc }),
  setMfgConfig: (config) => set({ mfgConfig: config }),
  setSelectedContact: (contact) => set({ selectedContact: contact }),
  setQuantity: (quantity) => set({ quantity }),
  setUomId: (uomId) => set({ uomId }),
  setStartDate: (date) => set({ startDate: date }),
  setDueDate: (date) => set({ dueDate: date }),
  setInternalNotes: (notes) => set({ internalNotes: notes }),

  reset: () => set(INITIAL),
}))

// ── Derived selectors (avoid re-render if only unrelated slice changes) ────────

export const selectPendingTasks = (order: WorkOrder | null): WorkOrderTask[] =>
  order?.workflow_tasks?.filter(
    (t: WorkOrderTask) => t.status === 'PENDING' || t.status === 'IN_PROGRESS'
  ) ?? []
