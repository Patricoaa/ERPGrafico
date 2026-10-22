import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { Receipt } from "lucide-react"
import { ChoiceCard, ChoiceGroup } from "./ChoiceCard"

describe("ChoiceCard", () => {
    it("renders title, description, meta and badge", () => {
        render(<ChoiceCard selected={false} onSelect={() => {}} title="Boleta Electrónica" description="Consumidor final" meta="SII 39" badge="Código 39" icon={Receipt} />)
        expect(screen.getByRole("radio", { name: /Boleta Electrónica/ })).toBeInTheDocument()
        expect(screen.getByText("Consumidor final")).toBeInTheDocument()
        expect(screen.getByText("SII 39")).toBeInTheDocument()
        expect(screen.getByText("Código 39")).toBeInTheDocument()
    })

    it("exposes the selected state and marks it for screen readers", () => {
        render(<ChoiceCard selected onSelect={() => {}} title="Factura" />)
        expect(screen.getByRole("radio")).toHaveAttribute("aria-checked", "true")
        expect(screen.getByText("Seleccionado")).toBeInTheDocument()
    })

    it("calls onSelect on click", async () => {
        const onSelect = vi.fn()
        render(<ChoiceCard selected={false} onSelect={onSelect} title="Factura" />)
        await userEvent.click(screen.getByRole("radio"))
        expect(onSelect).toHaveBeenCalledTimes(1)
    })

    it("ignores clicks and leaves the tab order when disabled", async () => {
        const onSelect = vi.fn()
        render(<ChoiceCard selected={false} onSelect={onSelect} disabled title="Despacho inmediato" description="Requiere fabricación" />)
        const card = screen.getByRole("radio")
        expect(card).toHaveAttribute("aria-disabled", "true")
        expect(card).toHaveAttribute("tabindex", "-1")
        await userEvent.click(card)
        expect(onSelect).not.toHaveBeenCalled()
    })
})

function Harness({ activation }: { activation?: "select" | "focus" }) {
    const [value, setValue] = useState("a")
    return (
        <ChoiceGroup label="Entrega" activation={activation}>
            {["a", "b", "c"].map((id) => (
                <ChoiceCard key={id} selected={value === id} onSelect={() => setValue(id)} disabled={id === "b"} title={`Opción ${id}`} />
            ))}
        </ChoiceGroup>
    )
}

describe("ChoiceGroup", () => {
    it("is a named radiogroup", () => {
        render(<Harness />)
        expect(screen.getByRole("radiogroup", { name: "Entrega" })).toBeInTheDocument()
    })

    it("arrow keys move to the next enabled option and select it", async () => {
        render(<Harness />)
        screen.getByRole("radio", { name: /Opción a/ }).focus()
        await userEvent.keyboard("{ArrowRight}")
        expect(screen.getByRole("radio", { name: /Opción c/ })).toHaveFocus()
        expect(screen.getByRole("radio", { name: /Opción c/ })).toHaveAttribute("aria-checked", "true")
    })

    it("activation=focus moves focus without selecting", async () => {
        render(<Harness activation="focus" />)
        screen.getByRole("radio", { name: /Opción a/ }).focus()
        await userEvent.keyboard("{ArrowRight}")
        expect(screen.getByRole("radio", { name: /Opción c/ })).toHaveFocus()
        expect(screen.getByRole("radio", { name: /Opción a/ })).toHaveAttribute("aria-checked", "true")
    })
})
