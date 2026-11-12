"use client"

import { ArrowRight, HandCoins, Percent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModalContentSkeleton, SummaryNote, SummarySection } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { cn } from "@/lib/utils"
import { useProfitDistributionImpact } from "../hooks"

const num = (v: string | undefined) => Number(v) || 0

/**
 * Paso previo a la ejecución: todo lo que provocará la distribución — reparto por socio,
 * retiros provisorios que se absorben y cambio de participación (%) por reinversión/retención.
 */
export function DistributionImpactStep({ resolutionId }: { resolutionId: number }) {
    const { impact, isLoading, isError, refetch } = useProfitDistributionImpact(resolutionId)

    if (isLoading) return <ModalContentSkeleton fields={4} />
    if (isError || !impact) {
        return (
            <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
                <span>No se pudieron calcular los impactos de la distribución.</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>Reintentar</Button>
            </div>
        )
    }

    const { totals, partners, is_profit: isProfit } = impact
    const offsetTotal = num(totals.provisional_offset)
    const absorbing = partners.filter(p => num(p.provisional_withdrawals_offset) > 0)
    const changed = partners.filter(p => p.percentage_changes)

    return (
        <div className="space-y-6">
            <SummarySection title="Impactos de la distribución">
                {offsetTotal > 0 && (
                    <SummaryNote>
                        <strong className="text-foreground">Absorción de retiros provisorios:</strong>{" "}
                        se descontarán {formatCurrency(offsetTotal)} del bruto de {absorbing.length === 1 ? "1 socio" : `${absorbing.length} socios`} ({absorbing.map(p => p.partner_name).join(", ")}).
                        Solo el neto queda disponible para dividendos, reinversión o retención.
                    </SummaryNote>
                )}
                {isProfit && num(totals.reinvest) + num(totals.retained) > 0 && (
                    <SummaryNote tone="success">
                        Se capitalizan {formatCurrency(num(totals.reinvest))} por reinversión y se retienen {formatCurrency(num(totals.retained))}: aumenta el patrimonio de los socios beneficiados.
                    </SummaryNote>
                )}
                {isProfit && num(totals.dividend) > 0 && (
                    <SummaryNote tone="success">Se generan {formatCurrency(num(totals.dividend))} en «Dividendos por Pagar».</SummaryNote>
                )}
                {impact.percentages_change ? (
                    <SummaryNote>
                        <strong className="text-foreground">Cambian los porcentajes de participación</strong> de {changed.length} de {partners.length} socios al ejecutar.
                    </SummaryNote>
                ) : (
                    <SummaryNote tone="success">Los porcentajes de participación no cambian.</SummaryNote>
                )}
            </SummarySection>

            <div className="border rounded-sm overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground tracking-wider border-b">
                        <tr>
                            <th className="px-4 py-3">Socio</th>
                            <th className="px-3 py-3 text-right">Bruto</th>
                            <th className="px-3 py-3 text-right">
                                <span className="inline-flex items-center gap-1"><HandCoins className="h-3.5 w-3.5" aria-hidden />Retiros absorbidos</span>
                            </th>
                            <th className="px-3 py-3 text-right">Neto</th>
                            {isProfit ? (
                                <>
                                    <th className="px-3 py-3 text-right">Dividendos</th>
                                    <th className="px-3 py-3 text-right">Reinversión</th>
                                    <th className="px-3 py-3 text-right">Retenido</th>
                                </>
                            ) : (
                                <th className="px-3 py-3 text-right">Pérdida absorbida</th>
                            )}
                            <th className="px-4 py-3 text-right">
                                <span className="inline-flex items-center gap-1"><Percent className="h-3.5 w-3.5" aria-hidden />Participación</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {partners.map(p => {
                            const offset = num(p.provisional_withdrawals_offset)
                            const delta = num(p.percentage_after) - num(p.percentage_before)
                            return (
                                <tr key={p.partner} className="hover:bg-muted/30">
                                    <td className="px-4 py-3 font-semibold text-foreground">{p.partner_name}</td>
                                    <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(num(p.gross_amount))}</td>
                                    <td className={cn("px-3 py-3 text-right font-mono tabular-nums", offset > 0 ? "text-warning font-semibold" : "text-muted-foreground")}>
                                        {offset > 0 ? (
                                            <div className="flex flex-col items-end">
                                                <span>-{formatCurrency(offset)}</span>
                                                <span className="text-3xs font-normal text-muted-foreground">saldo {formatCurrency(num(p.provisional_balance_before))} → {formatCurrency(num(p.provisional_balance_after))}</span>
                                            </div>
                                        ) : "—"}
                                    </td>
                                    <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">{formatCurrency(num(p.net_amount))}</td>
                                    {isProfit ? (
                                        <>
                                            <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(num(p.dividend))}</td>
                                            <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(num(p.reinvest))}</td>
                                            <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(num(p.retained))}</td>
                                        </>
                                    ) : (
                                        <td className="px-3 py-3 text-right font-mono tabular-nums">{formatCurrency(num(p.loss))}</td>
                                    )}
                                    <td className="px-4 py-3 text-right tabular-nums">
                                        {p.percentage_changes ? (
                                            <span className="inline-flex items-center justify-end gap-1.5">
                                                <span className="text-muted-foreground">{p.percentage_before}%</span>
                                                <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                                                <span className="font-bold text-foreground">{p.percentage_after}%</span>
                                                <span className={cn("text-3xs font-semibold", delta > 0 ? "text-success" : "text-destructive")}>
                                                    ({delta > 0 ? "+" : ""}{delta.toFixed(2)})
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">{p.percentage_before}% (sin cambio)</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
