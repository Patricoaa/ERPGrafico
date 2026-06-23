export const nivoTheme = {
    axis: {
        ticks: {
            text: { fontSize: 10, fontFamily: "inherit", fill: "hsl(var(--muted-foreground))" },
            line: { strokeWidth: 0 },
        },
    },
    grid: {
        line: { stroke: "transparent", strokeWidth: 0 },
    },
    labels: {
        text: { fontSize: 10, fontFamily: "inherit" },
    },
    legends: {
        text: { fontSize: 10, fontFamily: "inherit" },
    },
}

export const pieDefaults = {
    innerRadius: 0.6,
    padAngle: 2,
    cornerRadius: 4,
    activeOuterRadiusOffset: 8,
    borderWidth: 2,
    borderColor: { theme: "background" },
    enableArcLinkLabels: false,
    enableArcLabels: true,
    arcLabelsRadiusOffset: 0.6,
    arcLabelsSkipAngle: 15,
    arcLabelsTextColor: "#fff",
}

export const barDefaults = {
    padding: 0.25,
    borderRadius: 6,
    enableGridX: false,
    enableGridY: true,
}

export const lineDefaults = {
    curve: "monotoneX" as const,
    lineWidth: 3,
    pointSize: 6,
    pointBorderWidth: 2,
    pointBorderColor: { from: "serieColor" },
    enableArea: true,
    areaOpacity: 0.08,
    enablePointLabel: false,
    useMesh: true,
    crosshairType: "cross" as const,
}

export const premiumTooltipClass =
    "bg-popover text-popover-foreground border border-border rounded-md px-3 py-2 text-xs shadow-floating whitespace-nowrap"

export function getCssChartColors(): string[] {
    if (typeof window === "undefined") {
        return ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]
    }
    const style = getComputedStyle(document.documentElement)
    const vars = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"]
    return vars.map((v) => {
        const val = style.getPropertyValue(v).trim()
        return val || "#000"
    })
}
