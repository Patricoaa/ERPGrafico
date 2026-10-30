import { act, render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeAll } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { AdvancedManufacturingDrawer } from "../AdvancedManufacturingDrawer"

vi.mock("@/lib/api", () => ({
    default: { get: vi.fn().mockResolvedValue({ data: { results: [] } }), post: vi.fn(), patch: vi.fn() },
}))

beforeAll(() => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
    window.HTMLElement.prototype.scrollIntoView = function () {}
})

const product = { id: 1, name: "Tarjetas", product_type: "MANUFACTURABLE", has_bom: true, mfg_enable_press: true }

const renderDrawer = () =>
    render(
        <QueryClientProvider client={new QueryClient()}>
            <AdvancedManufacturingDrawer open onOpenChange={vi.fn()} product={product} onConfirm={vi.fn()} />
        </QueryClientProvider>,
    )

describe("AdvancedManufacturingDrawer — production rail", () => {
    it("lists the three planning steps in the shared stage rail, not a top nav", () => {
        renderDrawer()
        expect(screen.getByRole("list", { name: "Etapas" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /^Configuración de la OT, paso 1 de 3/ })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /^Asignación de Materiales, paso 2 de 3/ })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: /^Asignación de Tercerizados, paso 3 de 3/ })).toBeInTheDocument()
        expect(screen.queryByRole("navigation", { name: "Pasos de fabricación" })).not.toBeInTheDocument()
    })

    it("jumps ahead to an optional step from the rail once the configuration is valid", async () => {
        renderDrawer()
        // The drawer loads the product's phase defaults on the next frame.
        await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))))
        fireEvent.click(screen.getByRole("button", { name: /^Asignación de Materiales, paso 2/ }))
        expect(screen.getByRole("heading", { name: /Asignación de Materiales/ })).toBeInTheDocument()
        expect(screen.getByText("Sin materiales asignados")).toBeInTheDocument()
    })
})
