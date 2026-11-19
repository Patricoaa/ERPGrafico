import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import { DensityScope } from "../DensityScope"

describe("DensityScope (ADR-0142)", () => {
    it("sets data-density and data-input on a display:contents wrapper", () => {
        render(
            <DensityScope density="comfortable" input="touch">
                <p>contenido</p>
            </DensityScope>,
        )
        const wrapper = screen.getByText("contenido").parentElement
        expect(wrapper?.getAttribute("data-density")).toBe("comfortable")
        expect(wrapper?.getAttribute("data-input")).toBe("touch")
        expect(wrapper?.className).toContain("contents")
    })

    it("omits the attributes it is not given so the subtree inherits them", () => {
        render(
            <DensityScope>
                <p>hijo</p>
            </DensityScope>,
        )
        const wrapper = screen.getByText("hijo").parentElement
        expect(wrapper?.hasAttribute("data-density")).toBe(false)
        expect(wrapper?.hasAttribute("data-input")).toBe(false)
    })
})
