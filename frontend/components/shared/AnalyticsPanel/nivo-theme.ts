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
