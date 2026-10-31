import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LabeledSwitch } from "./LabeledSwitch"

const presets = [
    { color: "primary", ring: "primary" },
    { color: "success", ring: "success" },
    { color: "warning", ring: "warning" },
    { color: "destructive", ring: "destructive" },
    { color: "info", ring: "info" },
] as const

describe("LabeledSwitch color presets", () => {
    it.each(presets)("keeps the container transparent and tints its ring for $color", ({ color, ring }) => {
        const { rerender } = render(
            <LabeledSwitch label="Disponible" checked={false} onCheckedChange={() => {}} color={color} />
        )
        const fieldset = screen.getByText("Disponible").closest("fieldset")
        expect(fieldset).not.toBeNull()
        expect(fieldset).toHaveClass("bg-transparent", "border-dashed", `ring-${ring}/10`)

        rerender(<LabeledSwitch label="Disponible" checked onCheckedChange={() => {}} color={color} />)
        expect(fieldset).toHaveClass("bg-transparent", "border-solid", `border-${ring}/30`, `ring-${ring}/20`)
    })
})