import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { DrawerLayout, type DrawerLayoutTab } from "../DrawerLayout"

const tabs: DrawerLayoutTab[] = [
    { value: "general", label: "General", content: <p>Contenido general</p> },
    { value: "variants", label: "Variantes", forceMount: true, content: <p>Contenido variantes</p> },
]

const getPanel = (name: string) => screen.getByRole("tabpanel", { name })

describe("DrawerLayout + forceMount", () => {
    it("keeps the force-mounted panel in the DOM but hides it while inactive", () => {
        render(<DrawerLayout tabs={tabs} activeTab="general" onTabChange={() => {}} />)

        const activePanel = getPanel("General")
        const mountedPanel = getPanel("Variantes")

        // forceMount mantiene el panel montado (conserva su estado local)…
        expect(screen.getByText("Contenido variantes")).toBeInTheDocument()
        expect(activePanel.getAttribute("data-state")).toBe("active")
        expect(mountedPanel.getAttribute("data-state")).toBe("inactive")

        // …pero Radix no le pone el atributo `hidden`, así que DrawerLayout debe
        // ocultarlo por CSS. Sin esta clase el contenido del panel inactivo se
        // renderiza dentro del workspace del tab activo.
        expect(mountedPanel.className).toContain("data-[state=inactive]:hidden")
        expect(activePanel.className).toContain("data-[state=inactive]:hidden")
    })

    it("shows the force-mounted panel when it becomes the active tab", () => {
        render(<DrawerLayout tabs={tabs} activeTab="variants" onTabChange={() => {}} />)

        expect(getPanel("Variantes").getAttribute("data-state")).toBe("active")
        // Los paneles sin `forceMount` se desmontan al quedar inactivos.
        expect(screen.queryByRole("tabpanel", { name: "General" })).toBeNull()
    })
})
