"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useFiscalYears } from '../../hooks/useFiscalYears';
import { useAccountingPeriods } from '../../hooks/useAccountingPeriods';
import { FiscalYearCard } from './FiscalYearCard';
import { FiscalYearClosingWizard } from './FiscalYearClosingWizard';
import { NewFiscalYearDrawer } from './NewFiscalYearDrawer';
import { type AccountingPeriod, type FiscalYearPreviewResult, type FiscalYear, type TaxPeriod } from '../../types';
import { useTaxPeriods } from '@/features/tax/hooks/useTaxQueries';
import { useClosePeriod as useCloseTaxPeriod, useReopenPeriod as useReopenTaxPeriod } from '@/features/tax/hooks/useTaxMutations';
import { DeclarationWizard } from '@/features/tax';

import { F29PaymentModal } from '@/features/tax';
import { useCreateTaxPayment } from '@/features/tax/hooks/useTaxMutations';
import type { TaxDeclaration, TaxPaymentData } from '@/features/tax/types';
import { AccountingPeriodCloseChecklistModal } from './AccountingPeriodCloseChecklist';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSelectedEntity } from '@/hooks/useSelectedEntity';
import { DataTableView, EmptyState, StatusBadge } from '@/components/shared';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/shared';
import { fiscalYearActions, type FiscalYearActionsCtx } from './fiscalYearActions';
import { ToolbarCreateButton, SmartSearchBar, useClientSearch, useSegmentation, SegmentationBar } from '@/components/shared';
import { ClosuresSkeleton } from './ClosuresSkeleton';
import { fiscalYearSearchDef } from '../../searchDef';
import { fiscalYearSegDef } from '../../segmentationDef';

interface AccountingClosuresClientViewProps {
    externalOpen?: boolean;
    onExternalOpenChange?: (open: boolean) => void;
}

export function AccountingClosuresClientView({ externalOpen, onExternalOpenChange }: AccountingClosuresClientViewProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const {
        data: fiscalYears,
        isLoading: isLoadingYr,
        isActionLoading: actionLoadingYr,
        refetch: fetchFiscalYears,
        closeFiscalYear,
        reopenFiscalYear,
        generateOpeningEntry
    } = useFiscalYears();

    const { entity: selectedFromUrl, clearSelection: clearUrlSelection } = useSelectedEntity<FiscalYearPreviewResult>({
        endpoint: '/accounting/fiscal-years'
    });

    const {
        data: periods,
        isLoading: isLoadingPeriods,
        isActionLoading: actionLoadingPeriod,
        refetch: fetchPeriods,
        closePeriod,
        reopenPeriod,
        createPeriod
    } = useAccountingPeriods();

    const { data: taxPeriodsRaw, isLoading: isLoadingTax, refetch: refetchTaxPeriods } = useTaxPeriods();
    const taxPeriods: TaxPeriod[] = useMemo(
        () => ((taxPeriodsRaw as { results?: TaxPeriod[] })?.results ?? []) as TaxPeriod[],
        [taxPeriodsRaw]
    );
    const closeTaxPeriod = useCloseTaxPeriod();
    const reopenTaxPeriod = useReopenTaxPeriod();
    const isLoadingTaxAction = closeTaxPeriod.isPending || reopenTaxPeriod.isPending;

    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [newFYModalOpen, setNewFYModalOpen] = useState(false);
    const [previewData, setPreviewData] = useState<FiscalYearPreviewResult | null>(null);
    const [activeYearToClose, setActiveYearToClose] = useState<number | null>(null);
    const [declarationPeriodId, setDeclarationPeriodId] = useState<number | undefined>(undefined);
    const [declarationWizardOpen, setDeclarationWizardOpen] = useState(false);

    // Payment state
    const [paymentPeriodId, setPaymentPeriodId] = useState<number | null>(null);
    const [paymentDeclaration, setPaymentDeclaration] = useState<TaxDeclaration | null>(null);
    const createTaxPayment = useCreateTaxPayment();

    // Checklist state before closing accounting period
    const [pendingClosePeriodId, setPendingClosePeriodId] = useState<number | null>(null);
    const [pendingClosePeriodInfo, setPendingClosePeriodInfo] = useState<{ year: number; month: number } | null>(null);
    const [checklistOpen, setChecklistOpen] = useState(false);
    const [isClosingPeriod, setIsClosingPeriod] = useState(false);

    const isLoading = isLoadingYr || isLoadingPeriods || isLoadingTax;

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
        clearUrlSelection();
    };

    useEffect(() => {
        if (selectedFromUrl) {
            const year = selectedFromUrl.year;
            if (!previewModalOpen && activeYearToClose !== year) {
                requestAnimationFrame(() => {
                    setActiveYearToClose(year);
                    setPreviewData(selectedFromUrl);
                    setPreviewModalOpen(true);
                })
            }
        }
    }, [selectedFromUrl, previewModalOpen, activeYearToClose]);

    const handleCreateFY = async (year: number) => {
        try {
            await createPeriod({ year, month: 1 });
            fetchPeriods();
            fetchFiscalYears();
            return true;
        } catch {
            return false;
        }
    };

    const groupedData = useMemo(() => {
        const acctGrouped = new Map<number, AccountingPeriod[]>();
        const taxGrouped = new Map<number, TaxPeriod[]>();

        periods.forEach(p => {
            const arr = acctGrouped.get(p.year) ?? [];
            arr.push(p);
            acctGrouped.set(p.year, arr);
        });

        taxPeriods.forEach(p => {
            const arr = taxGrouped.get(p.year) ?? [];
            arr.push(p);
            taxGrouped.set(p.year, arr);
        });

        const allYears = new Set([...acctGrouped.keys(), ...taxGrouped.keys(), ...fiscalYears.map(fy => fy.year)]);

        return Array.from(allYears)
            .map(year => {
                const sortedPeriods = (acctGrouped.get(year) ?? []).sort((a, b) => a.month - b.month);
                const sortedTaxPeriods = (taxGrouped.get(year) ?? []).sort((a, b) => a.month - b.month);
                const fyModel = fiscalYears.find(fy => fy.year === year);
                return { year, periods: sortedPeriods, taxPeriods: sortedTaxPeriods, fiscalYear: fyModel };
            })
            .sort((a, b) => b.year - a.year);
    }, [periods, taxPeriods, fiscalYears]);

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
            fetchPeriods();
            refetchTaxPeriods();
        }
    };

    const handleOpenDeclaration = useCallback((id: number) => {
        setDeclarationPeriodId(id);
        setDeclarationWizardOpen(true);
    }, []);

    const handleDeclarationSuccess = useCallback(() => {
        setDeclarationWizardOpen(false);
        setDeclarationPeriodId(undefined);
        refetchTaxPeriods();
        fetchPeriods();
    }, [refetchTaxPeriods, fetchPeriods]);

    const handleCloseTaxPeriod = useCallback(async (id: number) => {
        const key = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0
                const v = c === 'x' ? r : (r & 0x3) | 0x8
                return v.toString(16)
            })
        await closeTaxPeriod.mutateAsync({ id, idempotencyKey: key });
        refetchTaxPeriods();
        fetchPeriods();
    }, [closeTaxPeriod, refetchTaxPeriods, fetchPeriods]);

    const handleReopenTaxPeriod = useCallback(async (params: { id: number; reason?: string }) => {
        await reopenTaxPeriod.mutateAsync(params);
        refetchTaxPeriods();
        fetchPeriods();
    }, [reopenTaxPeriod, refetchTaxPeriods, fetchPeriods]);

    const handlePayF29 = useCallback((periodId: number) => {
        const taxPeriod = taxPeriods.find(p => p.id === periodId)
        if (taxPeriod?.declaration_summary) {
            setPaymentPeriodId(periodId)
            setPaymentDeclaration({
                id: taxPeriod.declaration_summary.id,
                vat_to_pay: taxPeriod.declaration_summary.vat_to_pay,
                total_paid: taxPeriod.declaration_summary.total_paid,
                is_fully_paid: taxPeriod.declaration_summary.is_fully_paid,
                payments: taxPeriod.declaration_summary.payments || [],
                folio_number: taxPeriod.declaration_summary.folio_number,
                tax_period_display: `${taxPeriod.month_display} ${taxPeriod.year}`,
                tax_period_year: taxPeriod.year,
                tax_period_month: taxPeriod.month,
                ppm_amount: 0,
                withholding_tax: 0,
                vat_credit_carryforward: 0,
                vat_correction_amount: 0,
                second_category_tax: 0,
                loan_retention: 0,
                ila_tax: 0,
                vat_withholding: 0,
                tax_rate: 0,
            })
        }
    }, [taxPeriods])

    const handlePaymentConfirm = useCallback(async (data: TaxPaymentData) => {
        if (!paymentDeclaration) return
        try {
            const dateString = new Date().toISOString().split('T')[0]
            await createTaxPayment.mutateAsync({
                declaration: paymentDeclaration.id,
                payment_date: data.documentDate || dateString,
                amount: data.amount,
                payment_method: data.paymentMethod,
                reference: data.reference || '',
                treasury_account: data.treasury_account_id,
                notes: `Pago F29 - ${paymentDeclaration.tax_period_display}`,
            })
            setPaymentPeriodId(null)
            setPaymentDeclaration(null)
            refetchTaxPeriods()
            fetchPeriods()
        } catch {
            // error handled by mutation
        }
    }, [paymentDeclaration, createTaxPayment, refetchTaxPeriods, fetchPeriods])

    const handleClosePeriodWithChecklist = useCallback(async (periodId: number) => {
        const period = periods.find(p => p.id === periodId)
        if (!period) return
        setPendingClosePeriodId(periodId)
        setPendingClosePeriodInfo({ year: period.year, month: period.month })
        setChecklistOpen(true)
    }, [periods])

    const handleChecklistConfirmed = useCallback(async () => {
        if (!pendingClosePeriodId) return
        setIsClosingPeriod(true)
        try {
            await closePeriod(pendingClosePeriodId)
            setChecklistOpen(false)
            setPendingClosePeriodId(null)
            setPendingClosePeriodInfo(null)
        } catch {
            // error handled by mutation
        } finally {
            setIsClosingPeriod(false)
        }
    }, [pendingClosePeriodId, closePeriod])

    const { filterFn, isFiltered: isTextFiltered, clearAll: clearText } = useClientSearch<{ year: number; periods: AccountingPeriod[]; taxPeriods: TaxPeriod[]; fiscalYear: FiscalYear | undefined; status: string }>(fiscalYearSearchDef)
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(fiscalYearSegDef)
    const isFiltered = isTextFiltered || isSegFiltered

    const filteredGrouped = useMemo(() => {
        let result = groupedData
        if (segFilters.status) result = result.filter(g => (g.fiscalYear?.status || 'OPEN') === segFilters.status)
        return filterFn(result.map(r => ({ ...r, status: r.fiscalYear?.status ?? 'OPEN' })))
    }, [groupedData, segFilters.status, filterFn])

    if (isLoading) {
        return <ClosuresSkeleton />;
    }

    if (groupedData.length === 0) {
        return (
            <div className="pt-8">
                <EmptyState
                    context="finance"
                    title="Aún no hay periodos contables"
                    description="Los periodos y cierres se activan automáticamente al registrar el primer asiento contable."
                />
                <NewFiscalYearDrawer
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

    const fiscalYearActionsCtx: FiscalYearActionsCtx = {
        onExecuteClosing: (year) => handlePreviewClosing(year),
        onReopen: (year) => reopenFiscalYear(year),
        onGenerateOpening: (year) => generateOpeningEntry(year),
    }

    const columns: ColumnDef<typeof groupedData[0]>[] = [
        {
            accessorKey: "year",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Ejercicio" />,
            cell: ({ row }) => <div className="font-bold">{row.getValue("year")}</div>,
        },
        {
            id: "status",
            accessorFn: (row) => row.fiscalYear?.status || 'OPEN',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                let token: "success" | "warning" | "info" | "generic" = "generic";
                let label = status;
                if (status === 'OPEN') { token = 'success'; label = 'Abierto'; }
                else if (status === 'CLOSING') { token = 'warning'; label = 'En Cierre'; }
                else if (status === 'CLOSED') { token = 'info'; label = 'Cerrado'; }

                return <StatusBadge status={token} label={label} />;
            },
        },
        {
            id: "periods",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Periodos" />,
            cell: ({ row }) => {
                const acctCount = row.original.periods.length;
                const taxCount = row.original.taxPeriods.length;
                return <div className="text-muted-foreground">F29: {taxCount} · Contable: {acctCount}</div>;
            },
        },
        fiscalYearActions.column(fiscalYearActionsCtx) as ColumnDef<typeof groupedData[0]>
    ];

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="accounting.fiscalyear"
                    columns={columns}
                    data={filteredGrouped}
                    isLoading={actionLoadingYr || actionLoadingPeriod || isLoadingTaxAction}
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={fiscalYearSearchDef} placeholder="Buscar ejercicio..." className="w-full" />}
                    segmentation={<SegmentationBar def={fiscalYearSegDef} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    defaultPageSize={10}
                    createAction={
                        <ToolbarCreateButton
                            href="/accounting/closures?modal=fy"
                            label="Nuevo Ejercicio Fiscal"
                        />
                    }
                    renderCustomView={(table) => (
                        <div className="space-y-6 pt-4">
                            {table.getRowModel().rows.map(row => {
                                const { year, periods: yearPeriods, taxPeriods: yearTaxPeriods, fiscalYear } = row.original;
                                return (
                                    <FiscalYearCard
                                        key={`year-${year}`}
                                        year={year}
                                        fiscalYear={fiscalYear}
                                        periods={yearPeriods}
                                        taxPeriods={yearTaxPeriods}
                                        onClosePeriod={handleClosePeriodWithChecklist}
                                        onReopenPeriod={reopenPeriod}
                                        isPeriodActionLoading={actionLoadingPeriod}
                                        onCloseTaxPeriod={handleCloseTaxPeriod}
                                        onReopenTaxPeriod={handleReopenTaxPeriod}
                                        onOpenDeclaration={handleOpenDeclaration}
                                        isTaxActionLoading={isLoadingTaxAction}
                                        onPreviewClosing={handlePreviewClosing}
                                        onReopenFiscalYear={reopenFiscalYear}
                                        onGenerateOpening={generateOpeningEntry}
                                        isFiscalYearLoading={actionLoadingYr}
                                        onPayF29={handlePayF29}
                                    />
                                );
                            })}
                        </div>
                    )}
                />
            </div>

            <FiscalYearClosingWizard
                isOpen={previewModalOpen}
                onClose={() => {
                    setPreviewModalOpen(false);
                    clearSelection();
                }}
                onConfirm={handleConfirmClosing}
                year={activeYearToClose || 0}
                preview={previewData}
                isLoading={!previewData && previewModalOpen}
            />

            <DeclarationWizard
                isOpen={declarationWizardOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeclarationWizardOpen(false);
                        setDeclarationPeriodId(undefined);
                    }
                }}
                periodId={declarationPeriodId}
                onSuccess={handleDeclarationSuccess}
            />

            <NewFiscalYearDrawer
                isOpen={newFYModalOpen}
                onClose={handleCloseNewFY}
                onConfirm={handleCreateFY}
                isLoading={actionLoadingPeriod}
                existingYears={fiscalYears.map(fy => fy.year)}
                hasOpenPeriods={periods.some(p => p.status === 'OPEN')}
            />

            {/* F29 Payment Modal */}
            {paymentDeclaration && (
                <F29PaymentModal
                    isOpen={paymentPeriodId !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setPaymentPeriodId(null)
                            setPaymentDeclaration(null)
                        }
                    }}
                    declaration={paymentDeclaration}
                    onConfirmPayment={handlePaymentConfirm}
                />
            )}

            {/* Accounting Period Pre-Close Checklist */}
            <AccountingPeriodCloseChecklistModal
                isOpen={checklistOpen}
                periodId={pendingClosePeriodId ?? 0}
                year={pendingClosePeriodInfo?.year ?? 0}
                month={pendingClosePeriodInfo?.month ?? 0}
                onClose={() => {
                    setChecklistOpen(false)
                    setPendingClosePeriodId(null)
                    setPendingClosePeriodInfo(null)
                }}
                onConfirm={handleChecklistConfirmed}
                isLoading={isClosingPeriod}
            />
        </div>
    );
}
