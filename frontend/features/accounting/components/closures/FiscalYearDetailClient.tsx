"use client"

import React, { useState, useMemo } from "react"
import { notFound, useRouter } from "next/navigation"
import { EntityDetailPage } from "@/components/shared"
import { FiscalYearCard } from "./FiscalYearCard"
import { FiscalYearClosingWizard } from "./FiscalYearClosingWizard"
import { useFiscalYears } from "../../hooks/useFiscalYears"
import { useAccountingPeriods } from "../../hooks/useAccountingPeriods"
import { FiscalYearPreviewResult } from "../../types"

interface FiscalYearDetailClientProps {
    fiscalYearId: string
}

export function FiscalYearDetailClient({ fiscalYearId }: FiscalYearDetailClientProps) {
    const {
        data: fiscalYears,
        isActionLoading: actionLoadingYr,
        previewClosing,
        closeFiscalYear,
        reopenFiscalYear,
        generateOpeningEntry,
        refetch: fetchFiscalYears
    } = useFiscalYears()

    const {
        data: allPeriods,
        isActionLoading: actionLoadingPeriod,
        closePeriod,
        reopenPeriod,
        refetch: fetchPeriods
    } = useAccountingPeriods()

    const router = useRouter()
    const [previewModalOpen, setPreviewModalOpen] = useState(false)
    const [previewData, setPreviewData] = useState<FiscalYearPreviewResult | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)

    const fiscalYear = useMemo(() => {
        return fiscalYears.find((fy) => fy.id.toString() === fiscalYearId.toString())
    }, [fiscalYears, fiscalYearId])

    const periods = useMemo(() => {
        if (!fiscalYear) return []
        return allPeriods.filter(p => p.year === fiscalYear.year).sort((a, b) => a.month - b.month)
    }, [allPeriods, fiscalYear])

    if (!fiscalYear) {
        return notFound()
    }

    const handlePreviewClosing = async (year: number) => {
        setPreviewLoading(true)
        setPreviewModalOpen(true)
        const data = await previewClosing(year)
        setPreviewData(data)
        setPreviewLoading(false)
    }

    const handleConfirmClosing = async () => {
        if (fiscalYear) {
            await closeFiscalYear(fiscalYear.year)
            setPreviewModalOpen(false)
            fetchPeriods()
            fetchFiscalYears()
        }
    }

    return (
        <EntityDetailPage
            entityType="fiscal_year"
            title="Año Fiscal"
            displayId={fiscalYear.year.toString()}
            icon="calendar"
            breadcrumb={[
                { label: "Cierres Contables", href: "/accounting/closures" },
                { label: `Ejercicio ${fiscalYear.year}`, href: `/accounting/closures/${fiscalYearId}` }
            ]}
            instanceId={fiscalYear.id}
            readonly={true} // FiscalYear is mostly readonly/action-driven
        >
            <div className="max-w-5xl mx-auto h-full space-y-6">
                <FiscalYearCard
                    year={fiscalYear.year}
                    fiscalYear={fiscalYear}
                    periods={periods}
                    onClosePeriod={closePeriod}
                    onReopenPeriod={reopenPeriod}
                    isPeriodActionLoading={actionLoadingPeriod !== null}
                    onPreviewClosing={handlePreviewClosing}
                    onReopenFiscalYear={reopenFiscalYear}
                    onGenerateOpening={generateOpeningEntry}
                    isFiscalYearLoading={actionLoadingYr}
                />

                <FiscalYearClosingWizard
                    isOpen={previewModalOpen}
                    onClose={() => setPreviewModalOpen(false)}
                    onConfirm={handleConfirmClosing}
                    year={fiscalYear.year}
                    preview={previewData}
                    isLoading={previewLoading}
                />
            </div>
        </EntityDetailPage>
    )
}
