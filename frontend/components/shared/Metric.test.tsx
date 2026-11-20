import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { Banknote } from "lucide-react"
import { Metric, MetricStrip, ChartCard, resolveMetricDelta } from "./index"

describe("resolveMetricDelta", () => {
    it("computes the percentage and marks an increase as good", () => {
        const d = resolveMetricDelta({ current: 112.5, previous: 100 })
        expect(d).toMatchObject({ direction: "up", tone: "success" })
        expect(d?.text).toBe("12,5 %")
    })

    it("flips the tone for inverse metrics (a cost that rises is bad)", () => {
        expect(resolveMetricDelta({ current: 108, previous: 100, inverse: true })).toMatchObject({ direction: "up", tone: "destructive" })
        expect(resolveMetricDelta({ current: 90, previous: 100, inverse: true })).toMatchObject({ direction: "down", tone: "success" })
    })

    it("reports no change as neutral", () => {
        expect(resolveMetricDelta({ current: 100, previous: 100 })).toMatchObject({ direction: "flat", tone: "neutral" })
    })

    it("has nothing to compare against a zero or invalid previous value", () => {
        expect(resolveMetricDelta({ current: 5, previous: 0 })).toBeNull()
        expect(resolveMetricDelta({ current: Number.NaN, previous: 3 })).toBeNull()
    })

    it("passes an explicit change through", () => {
        expect(resolveMetricDelta({ text: "+3 pts", direction: "up", tone: "info" })).toEqual({ text: "+3 pts", direction: "up", tone: "info" })
    })
})

describe("Metric", () => {
    it("renders label, value, unit and context", () => {
        render(<Metric label="Stock actual" value="320" unit="uds" context="Mínimo 400" />)
        expect(screen.getByText("Stock actual")).toBeInTheDocument()
        expect(screen.getByText("320")).toBeInTheDocument()
        expect(screen.getByText("uds")).toBeInTheDocument()
        expect(screen.getByText("Mínimo 400")).toBeInTheDocument()
    })

    it("uses the kpi-value token (mono, tabular) and steps down in narrow cells", () => {
        render(<Metric label="Ventas" value="$12.480.000" />)
        const value = screen.getByText("$12.480.000")
        expect(value).toHaveClass("kpi-value")
        expect(value.className).toContain("@max-[230px]:kpi-value-compact")
    })

    it("shows a dash when there is no value", () => {
        render(<Metric label="Remanente" value={null} unit="uds" context="Sin declaraciones previas" />)
        expect(screen.getByText("—")).toBeInTheDocument()
        expect(screen.queryByText("uds")).not.toBeInTheDocument()
    })

    it("announces the change with direction in its accessible name", () => {
        render(<Metric label="Ventas" value="10" delta={{ current: 112.5, previous: 100 }} />)
        expect(screen.getByLabelText(/^Sube 12,5/)).toBeInTheDocument()
    })

    it("exposes the definition through a keyboard-reachable button", async () => {
        const user = userEvent.setup()
        render(<Metric label="Margen" value="12 %" info="Utilidad sobre ventas." />)
        const trigger = screen.getByRole("button", { name: "Margen: qué mide" })
        await user.tab()
        expect(trigger).toHaveFocus()
        expect((await screen.findAllByText("Utilidad sobre ventas."))[0]).toBeInTheDocument()
    })

    it("renders the leading icon without announcing it", () => {
        const { container } = render(<Metric label="Saldo" value="1" lead={Banknote} tone="success" />)
        const svg = container.querySelector("svg[aria-hidden='true']")
        expect(svg).not.toBeNull()
    })

    it("is not interactive by default", () => {
        render(<Metric label="Ventas" value="1" />)
        expect(screen.queryByRole("button")).not.toBeInTheDocument()
        expect(screen.queryByRole("link")).not.toBeInTheDocument()
    })

    describe("filter mode", () => {
        it("exposes aria-pressed on the label button and the visible state", async () => {
            const onPress = vi.fn()
            const { rerender } = render(<Metric label="Sin conciliar" value="37" onPress={onPress} pressed={false} />)
            const control = screen.getByRole("button", { name: "Sin conciliar" })
            expect(control).toHaveAttribute("aria-pressed", "false")
            await userEvent.click(control)
            expect(onPress).toHaveBeenCalledTimes(1)
            rerender(<Metric label="Sin conciliar" value="37" onPress={onPress} pressed />)
            expect(screen.getByRole("button", { name: "Sin conciliar" })).toHaveAttribute("aria-pressed", "true")
            expect(screen.getByText("Filtrando")).toBeInTheDocument()
        })
    })

    describe("link mode", () => {
        it("renders the label as a link to the target", () => {
            render(<Metric label="Atrasadas" value="6" href="/production/orders?view=list" />)
            expect(screen.getByRole("link", { name: "Atrasadas" })).toHaveAttribute("href", "/production/orders?view=list")
        })
    })

    describe("visuals", () => {
        it("progress carries its numbers as a progressbar", () => {
            render(<Metric label="Conciliación" value="78" visual={{ kind: "progress", current: 412, max: 530, noun: "movimientos" }} />)
            const bar = screen.getByRole("progressbar")
            expect(bar).toHaveAttribute("aria-valuenow", "412")
            expect(bar).toHaveAttribute("aria-valuemax", "530")
            expect(screen.getByText(/de 530 movimientos/)).toBeInTheDocument()
        })

        it("spark needs a caption and exposes it as the image name", () => {
            render(<Metric label="Ventas de hoy" value="$418.200" visual={{ kind: "spark", data: [3, 5, 4, 7], caption: "Últimos 4 días · mín 3 · máx 7" }} />)
            expect(screen.getByRole("img", { name: "Últimos 4 días · mín 3 · máx 7" })).toBeInTheDocument()
        })

        it("facts render as a definition list", () => {
            render(<Metric label="Saldo insoluto" value="$4.250.000" visual={{ kind: "facts", items: [{ label: "Capital", value: "$6.000.000" }, { label: "Cuotas pagadas", value: "7 de 24" }] }} />)
            expect(screen.getByText("Capital").tagName).toBe("DT")
            expect(screen.getByText("7 de 24").tagName).toBe("DD")
        })

        it("hides the visual when there is no data to draw", () => {
            render(<Metric label="Conciliación" value={null} visual={{ kind: "progress", current: 0, max: 0 }} />)
            expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
        })
    })

    describe("states", () => {
        it("loading is announced and keeps no figure", () => {
            render(<Metric label="Ventas" value="10" loading />)
            const status = screen.getByRole("status", { name: "Cargando" })
            expect(status).toHaveAttribute("aria-busy", "true")
            expect(screen.queryByText("10")).not.toBeInTheDocument()
        })

        it("error replaces the figure with a dash and offers a retry", async () => {
            const onRetry = vi.fn()
            render(<Metric label="Margen neto" value="12" error={{ onRetry }} />)
            expect(screen.getByText("—")).toBeInTheDocument()
            expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar.")
            await userEvent.click(screen.getByRole("button", { name: "Reintentar" }))
            expect(onRetry).toHaveBeenCalledTimes(1)
        })
    })
})

describe("MetricStrip", () => {
    it("groups its cells under an accessible name and drops each cell's own surface", () => {
        render(
            <MetricStrip label="Indicadores del producto">
                <Metric label="Ventas totales" value="1.240" />
                <Metric label="Stock actual" value="320" />
            </MetricStrip>,
        )
        const group = screen.getByRole("group", { name: "Indicadores del producto" })
        expect(group).toHaveClass("surface-panel")
        const cell = screen.getByText("Ventas totales").closest("div[class*='bg-card']")
        expect(cell).not.toBeNull()
        expect(cell?.className).not.toContain("surface-panel")
    })
})

describe("ChartCard", () => {
    it("renders header, legend and the chart", () => {
        render(
            <ChartCard title="Ingresos vs costos" subtitle="Últimos 12 meses" legend={[{ label: "Ingresos" }, { label: "Costos" }]} delta={{ current: 112.5, previous: 100 }}>
                <div>grafico</div>
            </ChartCard>,
        )
        expect(screen.getByRole("heading", { name: "Ingresos vs costos" })).toBeInTheDocument()
        expect(screen.getByText("Ingresos")).toBeInTheDocument()
        expect(screen.getByText("grafico")).toBeInTheDocument()
    })

    it("shows the empty text instead of the chart", () => {
        render(<ChartCard title="Demanda" empty="Sin ventas en el período"><div>grafico</div></ChartCard>)
        expect(screen.getByText("Sin ventas en el período")).toBeInTheDocument()
        expect(screen.queryByText("grafico")).not.toBeInTheDocument()
    })

    it("loading marks the card busy and hides the chart", () => {
        const { container } = render(<ChartCard title="Demanda" loading><div>grafico</div></ChartCard>)
        expect(container.querySelector("[aria-busy='true']")).not.toBeNull()
        expect(screen.queryByText("grafico")).not.toBeInTheDocument()
    })

    it("error offers a retry", async () => {
        const onRetry = vi.fn()
        render(<ChartCard title="Demanda" error={{ onRetry }}><div>grafico</div></ChartCard>)
        await userEvent.click(screen.getByRole("button", { name: "Reintentar" }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })
})
