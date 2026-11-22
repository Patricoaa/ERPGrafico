"use client"

import { useMemo } from "react"
import { ChartSection } from "@/components/shared"
import { getChartPalette } from "@/lib/chart-colors"
import { formatMoney, formatQuantity } from "@/lib/money"
import type { CostsBomLine } from "./costs.types"

const percent = (value: number) => `${value.toFixed(1)} %`

/** Below this share a segment is too narrow to carry its label (it keeps the tooltip). */
const MIN_LABEL_SHARE = 9

const quantity = (line: CostsBomLine) =>
    `${formatQuantity(line.qty_display)} ${line.qty_display === 1 ? line.uom_singular : line.uom_plural}`

/** "Composición de la LdM": stacked bar of each component's share of the unit cost, with its figures below. */
export function LdmComposition({ lines }: { lines: CostsBomLine[] }) {
    const palette = useMemo(() => getChartPalette(), [])
    const ranked = useMemo(() => [...lines].sort((a, b) => b.cost - a.cost), [lines])
    const color = (index: number) => palette[index % palette.length]

    return (
        <ChartSection title="Composición de la LdM">
            <div className="flex flex-col gap-4">
                <div
                    role="img"
                    aria-label={`Composición del costo de la LdM: ${ranked.map((l) => `${l.name} ${percent(l.share_pct)}`).join(", ")}`}
                    className="flex h-6 w-full gap-px overflow-hidden rounded-md bg-muted"
                >
                    {ranked.map((line, index) => (
                        <span
                            key={line.component_id}
                            title={`${line.name} · ${percent(line.share_pct)}`}
                            className="grid h-full min-w-px place-content-center overflow-hidden text-3xs font-semibold tabular-nums text-background"
                            style={{ width: `${line.share_pct}%`, backgroundColor: color(index) }}
                        >
                            {line.share_pct >= MIN_LABEL_SHARE && percent(line.share_pct)}
                        </span>
                    ))}
                </div>
                <ul className="flex flex-col divide-y divide-border/60">
                    {ranked.map((line, index) => (
                        <li key={line.component_id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-1.5 text-xs">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color(index) }} aria-hidden="true" />
                                <span className="truncate font-medium">{line.name}</span>
                                <span className="shrink-0 text-muted-foreground">× {quantity(line)}</span>
                                {line.is_outsourced && <span className="shrink-0 text-3xs uppercase tracking-wider text-muted-foreground">Tercerizado</span>}
                            </span>
                            <span className="tabular-nums text-muted-foreground">{formatMoney(line.cost)}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </ChartSection>
    )
}
