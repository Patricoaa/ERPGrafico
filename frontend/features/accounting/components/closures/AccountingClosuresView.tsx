"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useFiscalYears } from '../../hooks/useFiscalYears';
import { useAccountingPeriods } from '../../hooks/useAccountingPeriods';
import { FiscalYearCard } from './FiscalYearCard';
import { FiscalYearClosingWizard } from './FiscalYearClosingWizard';
import { NewFiscalYearModal } from './NewFiscalYearModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { AccountingPeriod, FiscalYearPreviewResult } from '../../types';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface AccountingClosuresViewProps {
    externalOpen?: boolean;
    onExternalOpenChange?: (open: boolean) => void;
}

export function AccountingClosuresView({ externalOpen, onExternalOpenChange }: AccountingClosuresViewProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const {
        data: fiscalYears,
        isActionLoading: actionLoadingYr,
        refetch: fetchFiscalYears,
        previewClosing,
        closeFiscalYear,
        reopenFiscalYear,
        generateOpeningEntry
    } = useFiscalYears();

    const {
        data: periods,
        isActionLoading: actionLoadingPeriod,
        refetch: fetchPeriods,
        closePeriod,
        reopenPeriod,
        createPeriod
    } = useAccountingPeriods();

    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [newFYModalOpen, setNewFYModalOpen] = useState(false);
    const [previewData, setPreviewData] = useState<FiscalYearPreviewResult | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [activeYearToClose, setActiveYearToClose] = useState<number | null>(null);

    useEffect(() => {
        if (externalOpen) {
            requestAnimationFrame(() => setNewFYModalOpen(true));
        }
    }, [externalOpen]);

    const handleCloseNewFY = () => {
        setNewFYModalOpen(false);
        onExternalOpenChange?.(false);

        const params = new URLSearchParams(searchParams.toString());
        params.delete("modal");
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const clearSelection = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('selected');
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    };

    const fetchPreviewData = async (year: number) => {
        setActiveYearToClose(year);
        setPreviewLoading(true);
        setPreviewModalOpen(true);
        const data = await previewClosing(year);
        setPreviewData(data);
        setPreviewLoading(false);
    };

    useEffect(() => {
        const selectedId = searchParams.get('selected');
        if (selectedId) {
            const year = parseInt(selectedId);
            if (!previewModalOpen && activeYearToClose !== year) {
                fetchPreviewData(year);
            }
        }
    }, [searchParams, previewModalOpen, activeYearToClose]);

    const handleCreateFY = async (year: number) => {
        // We initialize the year by creating the first month (January)
        const success = await createPeriod(year, 1);
        if (success) {
            fetchPeriods();
            fetchFiscalYears();
        }
        return success;
    };

    const groupedData = useMemo(() => {
        const grouped = new Map<number, AccountingPeriod[]>();

        // Group periods by year
        periods.forEach(p => {
            if (!grouped.has(p.year)) {
                grouped.set(p.year, []);
            }
            grouped.get(p.year)!.push(p);
        });

        // Add any fiscal years that might not have periods (rare)
        fiscalYears.forEach(fy => {
            if (!grouped.has(fy.year)) {
                grouped.set(fy.year, []);
            }
        });

        // Convert to array sorted by year descending
        return Array.from(grouped.entries())
            .map(([year, yearPeriods]) => {
                // Sort periods by month ascending
                const sortedPeriods = [...yearPeriods].sort((a, b) => a.month - b.month);
                const fyModel = fiscalYears.find(fy => fy.year === year);

                return {
                    year,
                    periods: sortedPeriods,
                    fiscalYear: fyModel
                };
            })
            .sort((a, b) => b.year - a.year);
    }, [periods, fiscalYears]);

    const handlePreviewClosing = (year: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('selected', String(year));
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleConfirmClosing = async () => {
        if (activeYearToClose) {
            await closeFiscalYear(activeYearToClose);
            setPreviewModalOpen(false);
            setActiveYearToClose(null);
            clearSelection();
            // Re-fetch periods to update their UI as well if needed
            fetchPeriods();
        }
    };

    if (groupedData.length === 0) {
        return (
            <div className="pt-8">
                <EmptyState
                    context="finance"
                    title="Aún no hay periodos contables"
                    description="Los periodos y cierres se activan automáticamente al registrar el primer asiento contable."
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {groupedData.map(({ year, periods: yearPeriods, fiscalYear }) => (
                <FiscalYearCard
                    key={`year-${year}`}
                    year={year}
                    fiscalYear={fiscalYear}
                    periods={yearPeriods}
                    onClosePeriod={closePeriod}
                    onReopenPeriod={reopenPeriod}
                    isPeriodActionLoading={actionLoadingPeriod}
                    onPreviewClosing={handlePreviewClosing}
                    onReopenFiscalYear={reopenFiscalYear}
                    onGenerateOpening={generateOpeningEntry}
                    isFiscalYearLoading={actionLoadingYr}
                />
            ))}

            <FiscalYearClosingWizard
                isOpen={previewModalOpen}
                onClose={() => {
                    setPreviewModalOpen(false);
                    clearSelection();
                }}
                onConfirm={handleConfirmClosing}
                year={activeYearToClose || 0}
                preview={previewData}
                isLoading={previewLoading}
            />

            <NewFiscalYearModal
                isOpen={newFYModalOpen}
                onClose={handleCloseNewFY}
                onConfirm={handleCreateFY}
                isLoading={actionLoadingPeriod}
                existingYears={fiscalYears.map(fy => fy.year)}
                hasOpenPeriods={periods.some(p => p.status === 'OPEN')}
            />
        </div>
    );
}
