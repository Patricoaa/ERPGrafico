import { render, fireEvent, waitFor } from "@testing-library/react"
import { screen } from "@testing-library/dom"
import { vi, describe, it, expect, beforeEach } from "vitest"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import api from "@/lib/api"
import { WorkOrderWizard } from "../WorkOrderWizard"

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

const renderManage = () =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <WorkOrderWizard mode={{ kind: "manage", orderId: 7 }} open onOpenChange={vi.fn()} />
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

        expect((await screen.findAllByText("Rectificación")).length).toBeGreaterThan(0)
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
