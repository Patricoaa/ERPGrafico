import { render, fireEvent, waitFor } from "@testing-library/react"
import { screen } from "@testing-library/dom"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import api from "@/lib/api"
import { WorkOrderWizard } from "../WorkOrderWizard"
import type { StageId } from "../../constants/stages"

// Regressions of the OT flow audit: the wizard must follow the server's stage plan,
// approve before every forward move, and never offer actions that point nowhere.

let currentOrder: Record<string, unknown> = {}
const callOrder: string[] = []

vi.mock("@/lib/api", () => ({
    default: {
        get: vi.fn().mockImplementation((url: string) => {
            if (url.includes("/production/orders/")) return Promise.resolve({ data: currentOrder })
            return Promise.resolve({ data: { results: [], lines: [], relations: [] } })
        }),
        post: vi.fn().mockImplementation((url: string) => {
            callOrder.push(url)
            return Promise.resolve({ data: {} })
        }),
        patch: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
    },
}))

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/production/orders",
}))

vi.mock("@/contexts/AuthContext", () => ({
    useAuth: () => ({ user: { id: 1, name: "Test User", is_superuser: true, groups: [] }, token: "t" }),
}))

const modals = {
    openEntity: vi.fn(), closeEntity: vi.fn(), goBackEntity: vi.fn(), setEntityDisplay: vi.fn(),
    registerSheet: vi.fn(), unregisterSheet: vi.fn(), isSubModalActive: false,
    getSheetOffset: () => 0, getSheetIndex: () => 0, isSheetCollapsed: () => false,
    expandedSheetWidth: 0, totalSheetsWidth: 0,
}
vi.mock("@/components/providers/GlobalModalProvider", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/components/providers/GlobalModalProvider")>()
    return { ...actual, useGlobalModals: () => modals, useGlobalModalActions: () => modals }
})

global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.HTMLElement.prototype.scrollIntoView = function () {}
window.HTMLElement.prototype.hasPointerCapture = function () { return false }
window.HTMLElement.prototype.releasePointerCapture = function () {}

const baseOrder = {
    id: 7,
    number: "7",
    display_id: "OT-7",
    status: "IN_PROGRESS",
    stage_data: {},
    materials: [],
    workflow_tasks: [],
    requires_prepress: false,
    requires_press: false,
    requires_postpress: false,
}

const renderManage = (targetStage?: StageId) =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <WorkOrderWizard mode={{ kind: "manage", orderId: 7, targetStage }} open onOpenChange={vi.fn()} />
        </QueryClientProvider>
    )

describe("WorkOrderWizard — audit regressions", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        callOrder.length = 0
    })

    it("follows the server stage plan: an OT without materials still reaches Rectificación", async () => {
        currentOrder = {
            ...baseOrder,
            current_stage: "OUTSOURCING_ASSIGNMENT",
            stage_plan: ["MATERIAL_ASSIGNMENT", "OUTSOURCING_ASSIGNMENT", "RECTIFICATION", "FINISHED"],
            next_stage: "RECTIFICATION",
        }
        renderManage()

        // The rail opens folded (numbers only): the stage is found by its row's accessible name.
        expect(await screen.findByRole("button", { name: /^Rectificación, paso/ })).toBeInTheDocument()
        // The button leads to the next planned stage, not straight to "Finalizar"
        expect(screen.getByRole("button", { name: "Siguiente Etapa" })).toBeInTheDocument()
    })

    it("does not offer 'Ver orden' for an OT without a sale order", async () => {
        currentOrder = { ...baseOrder, current_stage: "PRESS", requires_press: true, sale_order: null }
        renderManage()

        await screen.findAllByText("Impresión")
        expect(screen.queryByText(/Ver orden/)).not.toBeInTheDocument()
    })

    it("approves the rectification task before finishing", async () => {
        currentOrder = {
            ...baseOrder,
            current_stage: "RECTIFICATION",
            stage_plan: ["MATERIAL_ASSIGNMENT", "OUTSOURCING_ASSIGNMENT", "RECTIFICATION", "FINISHED"],
            next_stage: "FINISHED",
            workflow_tasks: [
                { id: 55, status: "PENDING", task_type: "OT_RECTIFICATION_APPROVAL", assigned_to: 1, data: {} },
            ],
        }
        renderManage()

        fireEvent.click(await screen.findByRole("button", { name: "Rectificar y Finalizar Producción" }))
        fireEvent.click(await screen.findByRole("button", { name: "Continuar" }))

        await waitFor(() => expect(callOrder.some((c) => c.endsWith("/transition/"))).toBe(true))
        const taskIdx = callOrder.findIndex((c) => c.includes("tasks/55/complete"))
        const transitionIdx = callOrder.findIndex((c) => c.endsWith("/transition/"))
        expect(taskIdx).toBeGreaterThanOrEqual(0)
        expect(taskIdx).toBeLessThan(transitionIdx)
    })

    it("follows the order to its new stage after advancing", async () => {
        const plan = ["MATERIAL_ASSIGNMENT", "OUTSOURCING_ASSIGNMENT", "RECTIFICATION", "FINISHED"]
        currentOrder = { ...baseOrder, current_stage: "OUTSOURCING_ASSIGNMENT", stage_plan: plan, next_stage: "RECTIFICATION" }
        vi.mocked(api.post).mockImplementation((url: string) => {
            callOrder.push(url)
            // The server moved the order: the reload after the transition returns the new stage.
            currentOrder = { ...currentOrder, current_stage: "RECTIFICATION", next_stage: "FINISHED" }
            return Promise.resolve({ data: {} })
        })
        // Opened from a URL with ?step=OUTSOURCING_ASSIGNMENT (the wizard keeps that param in sync).
        renderManage("OUTSOURCING_ASSIGNMENT")

        fireEvent.click(await screen.findByRole("button", { name: "Siguiente Etapa" }))
        fireEvent.click(await screen.findByRole("button", { name: "Continuar" }))

        // The step header now shows the new stage, without touching the rail.
        expect(await screen.findByRole("heading", { name: /Rectificación/ })).toBeInTheDocument()
    })

    it("keeps the reopen modal open when the transition API call fails", async () => {
        // Order is at PRESS with PREPRESS as a past reopenable stage (no blockers).
        currentOrder = {
            ...baseOrder,
            current_stage: "PRESS",
            requires_press: true,
            requires_prepress: true,
            stage_plan: ["MATERIAL_ASSIGNMENT", "MATERIAL_APPROVAL", "PREPRESS", "PRESS", "RECTIFICATION", "FINISHED"],
            next_stage: "RECTIFICATION",
            side_effects: {
                has_confirmed_pos: false,
                has_stock_movements: false,
                completed_tasks_count: 0,
                manually_edited_materials_count: 0,
                rewind_blockers: [],
                rewind_blockers_by_stage: {
                    MATERIAL_ASSIGNMENT: [], MATERIAL_APPROVAL: [], PREPRESS: [],
                },
            },
        }
        // Mock: transition always fails
        vi.mocked(api.post).mockRejectedValue(new Error("Server error"))

        renderManage()
        // Navigate to PREPRESS (a past stage) via the rail
        fireEvent.click(await screen.findByRole("button", { name: /Pre-Impresión, paso/ }))
        // The reopen button should appear in the stage header
        const reopenBtn = await screen.findByRole("button", { name: /Reabrir etapa/ })
        fireEvent.click(reopenBtn)
        // Modal opens — fill reason and confirm
        const reasonInput = await screen.findByRole("textbox")
        fireEvent.change(reasonInput, { target: { value: "Ajuste de diseño" } })
        fireEvent.click(screen.getByRole("button", { name: /Reabrir etapa/ }))
        // Modal must remain open after the API failure
        await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument())
    })

    it("does not fire a second transition while the first is in flight", async () => {
        let release: (value: { data: object }) => void = () => {}
        vi.mocked(api.post).mockImplementation((url: string) => {
            callOrder.push(url)
            return new Promise((resolve) => { release = resolve })
        })
        currentOrder = {
            ...baseOrder,
            current_stage: "OUTSOURCING_ASSIGNMENT",
            stage_plan: ["MATERIAL_ASSIGNMENT", "OUTSOURCING_ASSIGNMENT", "RECTIFICATION", "FINISHED"],
            next_stage: "RECTIFICATION",
        }
        renderManage()

        const next = await screen.findByRole("button", { name: "Siguiente Etapa" })
        fireEvent.click(next)
        fireEvent.click(await screen.findByRole("button", { name: "Continuar" }))
        await waitFor(() => expect(screen.getByRole("button", { name: "Siguiente Etapa" })).toBeDisabled())
        release({ data: {} })
    })
})
