"use client"

import { create } from 'zustand'
import type { WorkOrder, WorkOrderMaterial, WorkOrderTask } from '../types'

interface WizardState {
  // ── data ─────────────────────────────────────────────────────────────────
  order: WorkOrder | null
  loading: boolean
  viewingStepIndex: number

  // ── implicit task approvals (shared across all approval tabs) ─────────────
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

  /** Reset all state (call when wizard closes) */
  reset: () => void
}

const INITIAL: Omit<WizardState, keyof Omit<WizardState, 'order' | 'loading' | 'viewingStepIndex' | 'taskNotes' | 'taskFiles' | 'isAnnulModalOpen' | 'isDeleteModalOpen' | 'isBackwardModalOpen' | 'pendingPrevStage' | 'showPOPreview' | 'outsourcedPending' | 'rectificationAdjustments' | 'rectificationOutsourcedAdjustments' | 'rectificationProducedQty'>> = {
  order: null,
  loading: true,
  viewingStepIndex: 0,
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
  setViewingStepIndex: (index) =>
    set((s) => ({
      viewingStepIndex: typeof index === 'function' ? index(s.viewingStepIndex) : index,
    })),

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

  reset: () => set(INITIAL),
}))

// ── Derived selectors (avoid re-render if only unrelated slice changes) ────────

export const selectPendingTasks = (order: WorkOrder | null): WorkOrderTask[] =>
  order?.workflow_tasks?.filter(
    (t: WorkOrderTask) => t.status === 'PENDING' || t.status === 'IN_PROGRESS'
  ) ?? []
