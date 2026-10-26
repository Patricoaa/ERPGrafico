import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { SelectionRing } from "./SelectionRing"

describe("SelectionRing", () => {
    it("shows a check mark (not the CMYK ring) when selected", () => {
        const { container } = render(<SelectionRing checked ariaLabel="Seleccionar fila" />)
        const box = screen.getByRole("checkbox", { name: "Seleccionar fila" })
        expect(box).toHaveAttribute("aria-checked", "true")
        expect(box.querySelector("svg")).not.toBeNull()
        expect(container.querySelector(".bg-primary")).not.toBeNull()
        expect(container.querySelector("[class*='cmyk']")).toBeNull()
    })

    it("is an empty circle when not selected and a minus when partial", () => {
        const { rerender } = render(<SelectionRing checked={false} />)
        expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false")
        expect(screen.getByRole("checkbox").querySelector("svg")).toBeNull()
        rerender(<SelectionRing checked="indeterminate" />)
        expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed")
        expect(screen.getByRole("checkbox").querySelector("svg")).not.toBeNull()
    })

    it("toggles with click and keyboard", async () => {
        const onChange = vi.fn()
        render(<SelectionRing checked={false} onCheckedChange={onChange} />)
        await userEvent.click(screen.getByRole("checkbox"))
        expect(onChange).toHaveBeenLastCalledWith(true)
        screen.getByRole("checkbox").focus()
        await userEvent.keyboard(" ")
        expect(onChange).toHaveBeenCalledTimes(2)
    })
})
