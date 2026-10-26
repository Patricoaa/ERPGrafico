import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { CardSurface, CardRail } from "./CardSurface"

describe("CardSurface selection semantics", () => {
    it("does not announce a navigable card as a toggle when `selected` is omitted", () => {
        render(<CardSurface role="button" onClick={() => {}}>Pedido</CardSurface>)
        const card = screen.getByRole("button", { name: "Pedido" })
        expect(card).not.toHaveAttribute("aria-pressed")
        expect(card).not.toHaveAttribute("aria-checked")
    })

    it("exposes aria-pressed for a selectable button card, selected or not", () => {
        const { rerender } = render(<CardSurface role="button" selected={false} onClick={() => {}}>Opción</CardSurface>)
        expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false")
        rerender(<CardSurface role="button" selected onClick={() => {}}>Opción</CardSurface>)
        expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true")
    })

    it("exposes aria-checked for a radio card", () => {
        render(<CardSurface role="radio" selected onClick={() => {}}>Opción</CardSurface>)
        expect(screen.getByRole("radio")).toHaveAttribute("aria-checked", "true")
    })
})

describe("CardRail", () => {
    it("is hidden from assistive tech by default", () => {
        const { container } = render(<CardRail tone="success">ok</CardRail>)
        expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
    })

    it("stays exposed when it is not decorative", () => {
        const { container } = render(<CardRail tone="primary" size="sm" decorative={false}>marca</CardRail>)
        const rail = container.firstElementChild
        expect(rail).not.toHaveAttribute("aria-hidden")
        expect(rail).toHaveClass("w-9")
    })
})

describe("CardSurface kind", () => {
    it("choice cards preview the ribbon on hover; item cards only show it once selected", () => {
        const { rerender } = render(<CardSurface kind="item" onClick={() => {}}>Pedido</CardSurface>)
        const card = screen.getByRole("button", { name: "Pedido" })
        expect(card).not.toHaveClass("ribbon-cmyk")
        expect(card).not.toHaveClass("ribbon-cmyk-hover")

        rerender(<CardSurface kind="item" selected onClick={() => {}}>Pedido</CardSurface>)
        expect(screen.getByRole("button", { name: "Pedido" })).toHaveClass("ribbon-cmyk")

        rerender(<CardSurface onClick={() => {}}>Pedido</CardSurface>)
        expect(screen.getByRole("button", { name: "Pedido" })).toHaveClass("ribbon-cmyk", "ribbon-cmyk-hover")
    })
})

describe("CardSurface keyboard", () => {
    it("activates on Enter from the card but not from a nested button", async () => {
        const onOpen = vi.fn()
        const onApprove = vi.fn()
        render(
            <CardSurface onClick={onOpen}>
                Tarea
                <button type="button" onClick={(e) => { e.stopPropagation(); onApprove() }}>Aprobar</button>
            </CardSurface>
        )
        await userEvent.tab()
        await userEvent.keyboard("{Enter}")
        expect(onOpen).toHaveBeenCalledTimes(1)

        await userEvent.tab()
        expect(screen.getByRole("button", { name: "Aprobar" })).toHaveFocus()
        await userEvent.keyboard("{Enter}")
        expect(onApprove).toHaveBeenCalledTimes(1)
        expect(onOpen).toHaveBeenCalledTimes(1)
    })
})
