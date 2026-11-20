import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Banknote, Box, ShoppingCart, Truck, BarChart3 } from "lucide-react"
import { Metric } from "./Metric"
import { MetricStrip } from "./MetricStrip"
import { ChartCard } from "./ChartCard"

const meta = {
    title: "Shared/Metric",
    component: Metric,
    args: { label: "Ingresos por ventas", value: "$12.480.000" },
    // Width comes from `parameters.width` (default one card column) so wide stories can override it.
    decorators: [(Story, { parameters }) => <div style={{ width: typeof parameters.width === "string" ? parameters.width : "18rem", maxWidth: "100%" }}><Story /></div>],
} satisfies Meta<typeof Metric>
export default meta
type Story = StoryObj<typeof meta>

export const Simple: Story = { args: { label: "Órdenes activas", value: "38", context: "En piso de planta" } }

export const WithComparison: Story = {
    args: {
        info: "Monto de ventas confirmadas en el período, sin impuestos.",
        lead: Banknote, tone: "success",
        delta: { current: 12480000, previous: 11090000 },
        context: <>vs <b>$11.090.000</b> · mes anterior</>,
    },
}

/** A cost that goes up is bad: `inverse` flips the tone. */
export const CostRising: Story = {
    args: { label: "Volumen de compras", value: "$7.320.000", lead: Truck, tone: "destructive", delta: { current: 7320000, previous: 6765000, inverse: true }, context: <>vs <b>$6.765.000</b> · mes anterior</> },
}

export const Health: Story = {
    args: { label: "Razón corriente", value: "1,82", health: { status: "success", label: "Saludable" }, context: "Activo corriente ÷ pasivo corriente" },
}

export const InflowOutflow: Story = {
    render: () => (
        <div className="grid gap-3">
            <Metric label="Valor total de ingresos" value="$18.904.500" lead={ArrowDownLeft} tone="success" context={<><b>214</b> transacciones en el período</>} />
            <Metric label="Valor total de egresos" value="$12.611.300" lead={ArrowUpRight} tone="destructive" context={<><b>167</b> transacciones en el período</>} />
        </div>
    ),
}

export const FilterMode: Story = {
    render: () => (
        <div className="grid gap-3">
            <Metric label="Sin conciliar" value="37" context="Movimientos por procesar" onPress={() => {}} pressed />
            <Metric label="Conciliadas" value="493" context="Movimientos con documento asociado" onPress={() => {}} pressed={false} />
        </div>
    ),
}

export const Link: Story = {
    args: { label: "Atrasadas", value: "6", lead: AlertTriangle, tone: "destructive", href: "/production/orders?view=list", context: "Requieren atención" },
}

export const Progress: Story = {
    args: { label: "Conciliación automática", value: "78", unit: "%", tone: "success", context: "Última corrida hace 4 min", visual: { kind: "progress", current: 412, max: 530, noun: "movimientos" } },
}

export const Trend: Story = {
    args: {
        label: "Ventas de hoy", value: "$418.200", context: <>Promedio 14 días: <b>$412.000</b></>,
        visual: { kind: "spark", data: [352, 389, 341, 405, 428, 392, 310, 367, 441, 498, 462, 521, 476, 418], caption: "Últimos 14 días · mín $310.400 · máx $521.900" },
    },
}

export const Facts: Story = {
    args: { label: "Saldo insoluto", value: "$4.250.000", lead: Banknote, context: "Préstamo de capital de trabajo", visual: { kind: "facts", items: [{ label: "Capital", value: "$6.000.000" }, { label: "Cuotas pagadas", value: "7 de 24" }] } },
}

export const NoData: Story = { args: { label: "Remanente anterior", value: null, context: "Sin declaraciones previas en el período" } }
export const Failed: Story = { args: { label: "Margen neto", value: null, error: { onRetry: () => {} } } }
export const Loading: Story = { args: { loading: true } }

/** The value steps down a scale step when the cell is narrower than 230px (container query). */
export const NarrowCell: Story = {
    parameters: { width: "12rem" },
    args: { label: "Valoración actual", value: "$8.470.000", lead: Banknote },
}

export const Strip: Story = {
    parameters: { width: "56rem" },
    render: () => (
        <MetricStrip label="Indicadores del producto">
            <Metric label="Ventas totales" value="1.240" unit="uds" lead={ShoppingCart} delta={{ current: 1240, previous: 1137 }} context={<>vs <b>1.137</b> · año anterior</>} />
            <Metric label="Unidades compradas" value="1.560" unit="uds" lead={Truck} context={<>Costo ponderado <b>$5.430</b></>} />
            <Metric label="Valoración actual" value="$8.470.000" lead={Banknote} context="A costo promedio" />
            <Metric label="Stock actual" value="320" unit="uds" lead={Box} health={{ status: "warning", label: "Bajo el mínimo" }} context={<>Mínimo configurado: <b>400</b></>} />
        </MetricStrip>
    ),
}

export const Chart: Story = {
    parameters: { width: "40rem" },
    render: () => (
        <ChartCard title="Ingresos vs costos" subtitle="Últimos 12 meses · millones de pesos" lead={BarChart3} tone="info" legend={[{ label: "Ingresos", color: "var(--chart-1)" }, { label: "Costos", color: "var(--chart-2)" }]} delta={{ current: 18.9, previous: 16.8 }}>
            <div className="grid size-full place-content-center text-xs text-muted-foreground">Aquí va el gráfico (BarChart / LineChart)</div>
        </ChartCard>
    ),
}
