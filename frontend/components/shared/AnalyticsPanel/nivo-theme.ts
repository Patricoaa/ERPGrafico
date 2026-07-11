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
    innerRadius: 0.4,
    padAngle: 4,
    cornerRadius: 6,
    activeOuterRadiusOffset: 8,
    activeInnerRadiusOffset: 4,
    borderWidth: 3,
    borderColor: { theme: "background" },
    enableArcLinkLabels: false,
    enableArcLabels: true,
    arcLabelsRadiusOffset: 0.7,
    arcLabelsSkipAngle: 15,
}

export const barDefaults = {
    padding: 0.25,
    borderRadius: 6,
    enableGridX: false,
    enableGridY: false,
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

function desaturateHex(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    const factor = 0.55
    const nr = Math.round(r + factor * (gray - r))
    const ng = Math.round(g + factor * (gray - g))
    const nb = Math.round(b + factor * (gray - b))
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`
}

export function getCssChartColors(variant?: "pie"): string[] {
    if (typeof window === "undefined") {
        const fallback = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"]
        return variant === "pie" ? fallback.map(desaturateHex) : fallback
    }
    const style = getComputedStyle(document.documentElement)
    const vars = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"]
    return vars.map((v) => {
        const val = style.getPropertyValue(v).trim()
        if (variant === "pie" && val.startsWith("oklch(")) {
            return val.replace(
                /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/,
                (_, l: string, c: string, h: string) =>
                    `oklch(${l} ${(parseFloat(c) * 0.55).toFixed(3)} ${h})`,
            )
        }
        return val || "#000"
    })
}

// ── Card presets (centralized aesthetics for StatCard context) ──

export const cardBarDefaults = {
    margin: { top: 8, right: 8, bottom: 24, left: 40 },
    padding: 0.3,
    borderRadius: 6,
    enableGridX: false,
    enableGridY: false,
}

export const cardLineDefaults = {
    margin: { top: 8, right: 8, bottom: 24, left: 40 },
    lineWidth: 2,
    pointSize: 0,
    enableArea: true,
    areaOpacity: 0.06,
    enablePointLabel: false,
    useMesh: true,
    crosshairType: "cross" as const,
}

export const cardPieDefaults = {
    margin: { top: 8, right: 8, bottom: 8, left: 8 },
    innerRadius: 0.55,
    padAngle: 1.5,
    cornerRadius: 4,
    borderWidth: 1.5,
    borderColor: { theme: "background" },
    enableArcLinkLabels: false,
    enableArcLabels: true,
    arcLabelsRadiusOffset: 0.65,
    arcLabelsSkipAngle: 12,
    arcLabelsFont: { fontWeight: 700 as const },
}

export const cardLegend = {
    anchor: "bottom" as const,
    direction: "row" as const,
    translateY: 20,
    itemWidth: 72,
    itemHeight: 12,
    itemsSpacing: 8,
    symbolSize: 6,
    symbolShape: "circle" as const,
}
