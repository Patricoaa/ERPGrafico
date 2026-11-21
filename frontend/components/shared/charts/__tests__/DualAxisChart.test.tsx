import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"
import { DualAxisChart } from "../DualAxisChart"
import type { DualAxisSeries } from "../DualAxisChart"

const sampleSeries: DualAxisSeries[] = [
    {
        id: "price_list",
        label: "Precio de lista",
        axis: "left",
        type: "line",
        color: "#3b82f6",
        data: [{ x: "2026-01", y: 5000 }, { x: "2026-02", y: 5500 }],
    },
    {
        id: "sales_list",
        label: "Ventas Lista",
        axis: "right",
        type: "bar",
        color: "#10b981",
        data: [{ x: "2026-01", y: 100000 }, { x: "2026-02", y: 150000 }],
    },
]

const samplePeriods = ["2026-01", "2026-02"]

beforeAll(() => {
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
})

describe("DualAxisChart", () => {
    it("renders series legend and X axis period labels", () => {
        render(
            <DualAxisChart
                series={sampleSeries}
                periods={samplePeriods}
                leftAxisLabel="Precios ($)"
                rightAxisLabel="Ventas ($)"
            />,
        )

        expect(screen.getByText("Precio de lista")).toBeInTheDocument()
        expect(screen.getByText("Ventas Lista")).toBeInTheDocument()
        expect(screen.getByText("2026-01")).toBeInTheDocument()
        expect(screen.getByText("2026-02")).toBeInTheDocument()
        expect(screen.getByText(/Precios \(\$\)/)).toBeInTheDocument()
        expect(screen.getByText(/Ventas \(\$\)/)).toBeInTheDocument()
    })

    it("allows toggling series active state from legend buttons without segmented axis labels", () => {
        render(<DualAxisChart series={sampleSeries} periods={samplePeriods} />)

        const listBtn = screen.getByRole("button", { name: "Precio de lista" })
        expect(listBtn).toHaveAttribute("aria-pressed", "true")
        expect(screen.queryByText("(Y1)")).not.toBeInTheDocument()
        expect(screen.queryByText("(Y2)")).not.toBeInTheDocument()

        fireEvent.click(listBtn)
        expect(listBtn).toHaveAttribute("aria-pressed", "false")

        fireEvent.click(listBtn)
        expect(listBtn).toHaveAttribute("aria-pressed", "true")
    })

    it("renders with custom mode without exposing mode toggle buttons in UI", () => {
        render(<DualAxisChart series={sampleSeries} periods={samplePeriods} mode="line-line" />)

        expect(screen.queryByRole("button", { name: "Línea + Línea" })).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Línea + Columnas" })).not.toBeInTheDocument()
    })
})
