import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { CardLead } from "./CardLead"

describe("CardLead", () => {
    it("is a clipped rounded-sm 40px square by default", () => {
        const { container } = render(<CardLead>x</CardLead>)
        expect(container.firstElementChild).toHaveClass("rounded-sm", "overflow-hidden", "relative", "w-10", "h-10")
    })

    it("supports the dense size and the stretch layout", () => {
        const { container } = render(<><CardLead size="sm">a</CardLead><CardLead stretch>b</CardLead></>)
        expect(container.children[0]).toHaveClass("w-8", "h-8")
        expect(container.children[1]).toHaveClass("self-stretch")
        expect(container.children[1]).not.toHaveClass("h-10")
    })

    it("lets the caller override the tone", () => {
        const { container } = render(<CardLead className="bg-success/10 text-success">x</CardLead>)
        expect(container.firstElementChild).toHaveClass("bg-success/10")
        expect(container.firstElementChild).not.toHaveClass("bg-muted")
    })
})
