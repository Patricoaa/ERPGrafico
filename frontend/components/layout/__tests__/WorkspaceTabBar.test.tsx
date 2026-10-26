import { render, screen, within, fireEvent } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { FileText } from "lucide-react"

import { WorkspaceTabBar } from "../WorkspaceTabBar"
import type { NavigationConfig } from "@/components/providers/HeaderProvider"

const modals = vi.hoisted(() => ({
    tabs: [] as Array<{ key: string; kind: "entity" | "tool"; title: string; description: string; icon: unknown; active: boolean }>,
    activateTab: vi.fn(),
    closeTab: vi.fn(),
    openTool: vi.fn(),
}))

vi.mock("next/navigation", () => ({ usePathname: () => "/sales/dtes/orders" }))
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ hasPermission: () => true }) }))
vi.mock("@/components/providers/GlobalModalProvider", () => ({ useGlobalModals: () => modals }))

const navigation: NavigationConfig = {
    activeValue: "documents",
    subActiveValue: "orders",
    tabs: [{
        value: "documents", label: "Documentos", href: "/sales/dtes/orders",
        subTabs: [
            { value: "orders", label: "Órdenes de Venta", href: "/sales/dtes/orders" },
            { value: "dtes", label: "Documentos Tributarios", href: "/sales/dtes/invoices" },
        ],
    }],
}

const tab = (key: string, title: string, active = false) => ({ key, kind: "entity" as const, title, description: `Documento ${title}`, icon: FileText, active })

/** ADR-0101: barra de trabajo permanente (páginas del módulo + pestañas efímeras). */
describe("WorkspaceTabBar", () => {
    beforeEach(() => {
        modals.tabs = []
        modals.activateTab.mockReset(); modals.closeTab.mockReset(); modals.openTool.mockReset()
    })

    it("is always there: module pages as navigation, current page marked", () => {
        render(<WorkspaceTabBar navigation={navigation} />)
        const nav = screen.getByRole("navigation", { name: "Páginas del módulo" })
        expect(within(nav).getByRole("link", { name: "Órdenes de Venta" })).toHaveAttribute("aria-current", "page")
        expect(within(nav).getByRole("link", { name: "Documentos Tributarios" })).not.toHaveAttribute("aria-current")
        expect(screen.getByRole("tablist", { name: "Pestañas abiertas" })).toBeEmptyDOMElement()
    })

    it("lists the open documents as tabs, selects them and closes them", () => {
        modals.tabs = [tab("sales.saleorder:1", "OV-1"), tab("billing.invoice:9", "FAC-9", true)]
        render(<WorkspaceTabBar navigation={navigation} />)

        const tabs = screen.getAllByRole("tab")
        expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true"])
        expect(tabs[1]).toHaveAttribute("tabindex", "0")
        expect(tabs[0]).toHaveAttribute("tabindex", "-1")

        fireEvent.click(tabs[0])
        expect(modals.activateTab).toHaveBeenCalledWith("sales.saleorder:1")

        fireEvent.click(screen.getByRole("button", { name: "Cerrar FAC-9" }))
        expect(modals.closeTab).toHaveBeenCalledWith("billing.invoice:9")
    })

    it("moves focus with the arrow keys and closes the focused tab with Delete", () => {
        modals.tabs = [tab("a.b:1", "A-1", true), tab("a.b:2", "A-2")]
        render(<WorkspaceTabBar navigation={navigation} />)
        const [first, second] = screen.getAllByRole("tab")

        first.focus()
        fireEvent.keyDown(first, { key: "ArrowRight" })
        expect(second).toHaveFocus()
        fireEvent.keyDown(second, { key: "ArrowRight" })
        expect(first).toHaveFocus()

        fireEvent.keyDown(first, { key: "Delete" })
        expect(modals.closeTab).toHaveBeenCalledWith("a.b:1")
    })

    it("closes a tab with the middle button", () => {
        modals.tabs = [tab("a.b:1", "A-1", true)]
        render(<WorkspaceTabBar navigation={navigation} />)
        fireEvent(screen.getByRole("tab"), new MouseEvent("auxclick", { bubbles: true, button: 1 }))
        expect(modals.closeTab).toHaveBeenCalledWith("a.b:1")
    })

    it("opens the cost calculator from the bar and reflects when it is the active tab", () => {
        const { rerender } = render(<WorkspaceTabBar navigation={navigation} />)
        const button = screen.getByRole("button", { name: "Abrir Calculadora de Costos" })
        expect(button).toHaveAttribute("aria-pressed", "false")
        fireEvent.click(button)
        expect(modals.openTool).toHaveBeenCalledWith("cost-calculator")

        modals.tabs = [{ key: "tool:cost-calculator", kind: "tool", title: "Calculadora de Costos", description: "x", icon: FileText, active: true }]
        rerender(<WorkspaceTabBar navigation={navigation} />)
        expect(screen.getByRole("button", { name: "Abrir Calculadora de Costos" })).toHaveAttribute("aria-pressed", "true")
    })

    it("renders without module navigation (dashboard)", () => {
        render(<WorkspaceTabBar />)
        expect(screen.queryByRole("navigation", { name: "Páginas del módulo" })).toBeNull()
        expect(screen.getByRole("tablist", { name: "Pestañas abiertas" })).toBeInTheDocument()
    })
})
