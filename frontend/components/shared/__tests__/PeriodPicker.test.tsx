import { describe, expect, it, vi } from "vitest"
import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { DateRange } from "react-day-picker"
import { PeriodPicker, ReportToolbar } from "@/components/shared"
import { comparisonPresets, periodLabel, presetsOf, thisMonth, type Period } from "@/lib/date-presets"

describe("period helpers (ADR-0160)", () => {
    it("labels a period by its preset, else as a short range", () => {
        expect(periodLabel(thisMonth(), presetsOf(["this_month"]))).toBe("Este mes")
        expect(periodLabel({ from: "2026-01-01", to: "2026-11-26" })).toBe("1 ene – 26 nov 2026")
        expect(periodLabel({ from: "2025-12-01", to: "2026-01-31" })).toBe("1 dic 2025 – 31 ene 2026")
    })

    it("offers the previous period of the same length and the same dates a year earlier", () => {
        const [previous, yearBefore] = comparisonPresets({ from: "2026-03-01", to: "2026-03-31" })
        expect(previous.getValue()).toEqual({ from: "2026-01-29", to: "2026-02-28" })
        expect(yearBefore.getValue()).toEqual({ from: "2025-03-01", to: "2025-03-31" })
    })
})

function Harness({ initial, onChange }: { initial: Period | null; onChange: (p: Period | null) => void }) {
    const [value, setValue] = React.useState(initial)
    return (
        <PeriodPicker
            name="Período"
            value={value}
            presets={presetsOf(["this_month", "this_year"])}
            onChange={(next) => {
                setValue(next)
                onChange(next)
            }}
        />
    )
}

describe("PeriodPicker", () => {
    it("names the chosen preset and applies a preset with one click", async () => {
        const user = userEvent.setup()
        const onChange = vi.fn<(p: Period | null) => void>()
        render(<Harness initial={thisMonth()} onChange={onChange} />)
        expect(screen.getByRole("button", { name: "Período: Este mes" })).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: "Período: Este mes" }))
        await user.click(screen.getByRole("radio", { name: "Este año" }))
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(screen.getByRole("button", { name: "Período: Este año" })).toBeInTheDocument()
    })

    it("applies typed dates when the popover closes and discards them on Escape", async () => {
        const user = userEvent.setup()
        const onChange = vi.fn<(p: Period | null) => void>()
        render(<Harness initial={{ from: "2026-01-01", to: "2026-01-31" }} onChange={onChange} />)
        const trigger = screen.getByRole("button", { name: /^Período:/ })

        await user.click(trigger)
        await user.clear(screen.getByLabelText("Período hasta"))
        await user.type(screen.getByLabelText("Período hasta"), "2026-02-15")
        await user.keyboard("{Escape}")
        expect(onChange).not.toHaveBeenCalled()

        await user.click(trigger)
        await user.clear(screen.getByLabelText("Período hasta"))
        await user.type(screen.getByLabelText("Período hasta"), "2026-02-15")
        await user.click(document.body)
        expect(onChange).toHaveBeenLastCalledWith({ from: "2026-01-01", to: "2026-02-15" })
    })
})

describe("ReportToolbar (ADR-0160 §2)", () => {
    it("turns comparison on by choosing a relative period and off with «Quitar»", async () => {
        const user = userEvent.setup()
        const onShow = vi.fn<(show: boolean) => void>()
        const onComp = vi.fn<(range: DateRange | undefined) => void>()
        const { rerender } = render(
            <ReportToolbar
                headerFormat="year"
                onHeaderFormatChange={vi.fn()}
                date={{ from: new Date(2026, 2, 1), to: new Date(2026, 2, 31) }}
                onDateChange={vi.fn()}
                showComparison={false}
                onShowComparisonChange={onShow}
                compDate={undefined}
                onCompDateChange={onComp}
                showMapeo={false}
            />,
        )
        const bar = screen.getByRole("toolbar", { name: "Herramientas del informe" })
        expect(within(bar).getByRole("button", { name: "Período: 1 mar – 31 mar 2026" })).toBeInTheDocument()
        expect(within(bar).getByRole("button", { name: "Encabezado de columnas: Año" })).toBeInTheDocument()

        await user.click(within(bar).getByRole("button", { name: "Comparar con" }))
        await user.click(screen.getByRole("radio", { name: "Mismo período del año anterior" }))
        expect(onShow).toHaveBeenLastCalledWith(true)
        expect(onComp).toHaveBeenLastCalledWith({ from: new Date(2025, 2, 1), to: new Date(2025, 2, 31) })

        rerender(
            <ReportToolbar
                headerFormat="year"
                onHeaderFormatChange={vi.fn()}
                date={{ from: new Date(2026, 2, 1), to: new Date(2026, 2, 31) }}
                onDateChange={vi.fn()}
                showComparison
                onShowComparisonChange={onShow}
                compDate={{ from: new Date(2025, 2, 1), to: new Date(2025, 2, 31) }}
                onCompDateChange={onComp}
                showMapeo={false}
            />,
        )
        await user.click(within(bar).getByRole("button", { name: "Comparar con: Mismo período del año anterior" }))
        await user.click(screen.getByRole("button", { name: "Quitar" }))
        expect(onShow).toHaveBeenLastCalledWith(false)
    })
})
