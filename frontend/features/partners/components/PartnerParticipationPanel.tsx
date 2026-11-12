"use client"

import { useMemo } from "react"
import { getChartPalette } from "@/lib/chart-colors"
import { ChartLegend, PieChart } from "@/components/shared"
import { usePartners, netEquityPercentages, type Partner } from "@/features/contacts"

/** Distribución del capital entre los socios, con la participación del socio de la ficha destacada. */
export function PartnerParticipationPanel({ partner }: { partner: Partner }) {
    const { partners } = usePartners()
    const pct = useMemo(() => netEquityPercentages(partners ?? []), [partners])
    const data = useMemo(() => {
        const palette = getChartPalette()
        return (partners ?? [])
            .filter(p => (Number(p.partner_net_equity) || 0) > 0)
            .map((p, i) => ({
                id: p.name,
                value: parseFloat(pct[p.id] ?? "0") || 0,
                color: p.id === partner.id ? "var(--primary)" : palette[i % palette.length],
            }))
    }, [partners, pct, partner.id])
    const own = data.find(d => d.id === partner.name)?.value ?? 0

    return (
        <div className="flex flex-col">
            <div className="h-52">
                <PieChart
                    data={data}
                    activeId={partner.name}
                    activeOuterRadiusOffset={14}
                    activeInnerRadiusOffset={8}
                    innerRadius={0.55}
                    padAngle={1.5}
                    cornerRadius={4}
                    borderWidth={1.5}
                    borderColor={{ theme: "background" }}
                    enableArcLabels={false}
                    enableArcLinkLabels={false}
                    legends={[]}
                    margin={{ top: 12, right: 20, bottom: 12, left: 20 }}
                    centerLabel={{ value: `${own}%`, label: "Participación" }}
                    ariaLabel={`Distribución del capital: ${partner.name} participa con ${own}%`}
                    renderTooltip={(datum) => (
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: datum.color }} />
                            <span className="font-medium">{String(datum.label ?? datum.id)}</span>
                            <span className="text-sm font-normal">{datum.value.toFixed(1)}%</span>
                        </div>
                    )}
                />
            </div>
            <div className="flex min-h-10 items-center justify-center pt-2">
                <ChartLegend items={data.map(d => ({ label: String(d.id), color: d.color }))} />
            </div>
        </div>
    )
}
