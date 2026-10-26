import { render, screen, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { FileText } from "lucide-react"

import { WorkspaceTabBar } from "../WorkspaceTabBar"

const modals = vi.hoisted(() => ({
    tabs: [] as Array<{ key: string; kind: "entity" | "tool"; title: string; description: string; icon: unknown; active: boolean }>,
    activateTab: vi.fn(),
    closeTab: vi.fn(),
    showPage: vi.fn(),
}))

vi.mock("@/components/providers/GlobalModalProvider", () => ({ useGlobalModals: () => modals }))

const page = { title: "Órdenes de Venta", description: "Pedidos de clientes", icon: FileText }
const tab = (key: string, title: string, active = false) => ({ key, kind: "entity" as const, title, description: `Documento ${title}`, icon: FileText, active })

/** ADR-0101: la barra de trabajo es el primer panel; todas las pestañas comparten estilo. */
describe("WorkspaceTabBar", () => {
    beforeEach(() => {
        modals.tabs = []
        modals.activateTab.mockReset(); modals.closeTab.mockReset(); modals.showPage.mockReset()
    })

    it("always shows the page chosen in the rail as the first tab, active when nothing else is open", () => {
        render(<WorkspaceTabBar page={page} />)
        const [pageTab] = screen.getAllByRole("tab")
        expect(pageTab).toHaveTextContent("Órdenes de Venta")
        expect(pageTab).toHaveAttribute("aria-selected", "true")
        expect(screen.getByRole("heading", { level: 1, name: "Órdenes de Venta" })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: /Cerrar Órdenes de Venta/ })).toBeNull()
    })

    it("lists the open documents after it; the page tab goes back to the list without closing them", () => {
        modals.tabs = [tab("sales.saleorder:1", "OV-1"), tab("billing.invoice:9", "FAC-9", true)]
        render(<WorkspaceTabBar page={page} />)

        const tabs = screen.getAllByRole("tab")
        expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "false", "true"])
        expect(tabs[2]).toHaveAttribute("tabindex", "0")
        expect(tabs[0]).toHaveAttribute("tabindex", "-1")

        fireEvent.click(tabs[1])
        expect(modals.activateTab).toHaveBeenCalledWith("sales.saleorder:1")

        fireEvent.click(tabs[0])
        expect(modals.showPage).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole("button", { name: "Cerrar FAC-9" }))
        expect(modals.closeTab).toHaveBeenCalledWith("billing.invoice:9")
    })

    it("has no module navigation links nor a permanent calculator button", () => {
        render(<WorkspaceTabBar page={page} />)
        expect(screen.queryByRole("link")).toBeNull()
        expect(screen.queryByRole("button", { name: /Calculadora/ })).toBeNull()
    })

    it("moves focus with the arrow keys and closes the focused document tab with Delete", () => {
        modals.tabs = [tab("a.b:1", "A-1", true), tab("a.b:2", "A-2")]
        render(<WorkspaceTabBar page={page} />)
        const [first, second] = screen.getAllByRole("tab")

        first.focus()
        fireEvent.keyDown(first, { key: "Delete" })
        expect(modals.closeTab).not.toHaveBeenCalled() // la pestaña de la página no se cierra

        fireEvent.keyDown(first, { key: "ArrowRight" })
        expect(second).toHaveFocus()
        fireEvent.keyDown(second, { key: "Delete" })
        expect(modals.closeTab).toHaveBeenCalledWith("a.b:1")
    })

    it("closes a tab with the middle button", () => {
        modals.tabs = [tab("a.b:1", "A-1", true)]
        render(<WorkspaceTabBar page={page} />)
        fireEvent(screen.getAllByRole("tab")[1], new MouseEvent("auxclick", { bubbles: true, button: 1 }))
        expect(modals.closeTab).toHaveBeenCalledWith("a.b:1")
    })

    it("hosts the view's actions and breadcrumbs on the right and the nav button on the left", () => {
        render(
            <WorkspaceTabBar
                page={page}
                breadcrumbs={[{ label: "Banco", href: "/banks/1" }, { label: "Cartola" }]}
                actions={<span>Nuevo</span>}
                leading={<span>Menú</span>}
            />
        )
        expect(screen.getByRole("link", { name: "Banco" })).toHaveAttribute("href", "/banks/1")
        expect(screen.getByText("Cartola")).toBeInTheDocument()
        expect(screen.getByText("Nuevo")).toBeInTheDocument()
        expect(screen.getByText("Menú")).toBeInTheDocument()
    })

    it("shows a skeleton while the view has not published its header", () => {
        render(<WorkspaceTabBar page={null} />)
        expect(screen.getAllByRole("tab")).toHaveLength(1)
    })
})
