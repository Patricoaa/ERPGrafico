import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RailControls, RailControlsProvider, ViewControlsSlot } from "../RailControls"

describe("RailControls", () => {
    it("renders the controls inside the slot, not inline", () => {
        render(
            <RailControlsProvider>
                <div data-testid="content"><RailControls><span>ctl</span></RailControls></div>
                <ViewControlsSlot />
            </RailControlsProvider>,
        )
        expect(within(screen.getByRole("group", { name: "Controles de vista" })).getByText("ctl")).toBeInTheDocument()
        expect(within(screen.getByTestId("content")).queryByText("ctl")).not.toBeInTheDocument()
    })

    it("renders the controls in every registered slot", () => {
        render(
            <RailControlsProvider>
                <ViewControlsSlot />
                <ViewControlsSlot />
                <RailControls><span>ctl</span></RailControls>
            </RailControlsProvider>,
        )
        const slots = screen.getAllByRole("group", { name: "Controles de vista" })
        expect(slots).toHaveLength(2)
        for (const slot of slots) expect(within(slot).getByText("ctl")).toBeInTheDocument()
    })

    it("renders inline without a provider", () => {
        render(<RailControls><span>ctl</span></RailControls>)
        expect(screen.getByText("ctl")).toBeInTheDocument()
    })

    it("renders inline while no slot is registered", () => {
        render(<RailControlsProvider><RailControls><span>ctl</span></RailControls></RailControlsProvider>)
        expect(screen.getByText("ctl")).toBeInTheDocument()
    })

    it("removes the controls from the slot when the block unmounts", () => {
        const tree = (withControls: boolean) => (
            <RailControlsProvider>
                <ViewControlsSlot />
                {withControls && <RailControls><span>ctl</span></RailControls>}
            </RailControlsProvider>
        )
        const { rerender } = render(tree(true))
        expect(screen.getByText("ctl")).toBeInTheDocument()
        rerender(tree(false))
        expect(screen.queryByText("ctl")).not.toBeInTheDocument()
    })
})
