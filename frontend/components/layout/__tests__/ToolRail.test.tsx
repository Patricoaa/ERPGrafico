import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ToolRail } from "../ToolRail"

const mocks = vi.hoisted(() => ({
    pathname: "/sales/docs",
    moduleSettings: null as null | { moduleId: string; settings: { label: string; open: () => void } },
}))

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }))
vi.mock("@/components/providers/HeaderProvider", () => ({ useHeader: () => ({ moduleSettings: mocks.moduleSettings }) }))

function renderRail(props: Partial<React.ComponentProps<typeof ToolRail>> = {}) {
    const handlers = { onTogglePanel: vi.fn(), onSearchOpen: vi.fn() }
    render(<ToolRail activePanel={null} pendingTasksCount={0} {...handlers} {...props} />)
    return handlers
}

describe("ToolRail", () => {
    beforeEach(() => {
        mocks.pathname = "/sales/docs"
        mocks.moduleSettings = null
    })

    it("muestra Buscar, Calculadora y Bandeja en ese orden", () => {
        renderRail()
        const buttons = screen.getAllByRole("button").map(b => b.getAttribute("aria-label"))
        expect(buttons).toEqual(["Buscar (Ctrl K)", "Calculadora de Costos", "Bandeja de entrada"])
    })

    it("Buscar abre el buscador", () => {
        const { onSearchOpen } = renderRail()
        fireEvent.click(screen.getByRole("button", { name: "Buscar (Ctrl K)" }))
        expect(onSearchOpen).toHaveBeenCalled()
    })

    it("alterna paneles y marca el activo", () => {
        const { onTogglePanel } = renderRail({ activePanel: "calculator" })
        expect(screen.getByRole("button", { name: "Calculadora de Costos" })).toHaveAttribute("aria-pressed", "true")
        expect(screen.getByRole("button", { name: "Bandeja de entrada" })).toHaveAttribute("aria-pressed", "false")
        fireEvent.click(screen.getByRole("button", { name: "Bandeja de entrada" }))
        expect(onTogglePanel).toHaveBeenCalledWith("inbox")
    })

    it("muestra el ⚙ del módulo activo y abre su configuración", () => {
        const open = vi.fn()
        mocks.moduleSettings = { moduleId: "sales", settings: { label: "Configuración de Ventas", open } }
        renderRail()
        fireEvent.click(screen.getByRole("button", { name: "Configuración de Ventas" }))
        expect(open).toHaveBeenCalled()
    })

    it("oculta el ⚙ si la configuración publicada es de otro módulo", () => {
        mocks.moduleSettings = { moduleId: "sales", settings: { label: "Configuración de Ventas", open: vi.fn() } }
        mocks.pathname = "/settings"
        renderRail()
        expect(screen.queryByRole("button", { name: "Configuración de Ventas" })).toBeNull()
    })

    it("insignia de pendientes: 99+ sobre 99 y nada en cero", () => {
        const { unmount } = render(<ToolRail activePanel={null} pendingTasksCount={120} onTogglePanel={vi.fn()} onSearchOpen={vi.fn()} />)
        expect(screen.getByText("99+")).toBeInTheDocument()
        unmount()
        renderRail({ pendingTasksCount: 0 })
        expect(screen.queryByText("0")).toBeNull()
    })

    it("variante fila para el menú móvil", () => {
        renderRail({ variant: "row" })
        expect(screen.getByRole("toolbar", { name: "Herramientas" })).toHaveAttribute("aria-orientation", "horizontal")
    })
})
