"use client";

import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { EntityPanelTab } from "@/components/providers"
import React, {useState, useMemo, useCallback} from 'react';
import { useFiscalYears } from '../../hooks/useFiscalYears';
import { useAccountingPeriods } from '../../hooks/useAccountingPeriods';
import { FiscalYearClosingWizard } from './FiscalYearClosingWizard';
import { NewFiscalYearDrawer } from './NewFiscalYearDrawer';
import { type AccountingPeriod, type TaxPeriod } from '../../types';
import { useTaxPeriods, useClosePeriod as useCloseTaxPeriod, useReopenPeriod as useReopenTaxPeriod, useCreateTaxPayment, DeclarationWizard, F29PaymentModal, F29CloseModal } from '@/features/tax';
import type { TaxDeclaration, TaxPaymentData } from '@/features/tax';
import { AccountingPeriodCloseChecklistModal } from './AccountingPeriodCloseChecklist';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSelectedFiscalYearPreview } from '../../hooks/useSelectedFiscalYearPreview';
import { EmptyState, ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from '@/components/shared';
import { Collection, useEntityCollection } from '@/components/entity-view';
import { closureEntity, closureViews } from '../../entity-view/closure.entity';
import { buildClosureTree } from '../../utils/closureTree';
import { useReopenConfirm } from '../../hooks/useReopenConfirm';
import { closureActions, type ClosureActionsCtx } from './closureActions';
import { fiscalYearUnifiedSearchDef } from '../../unifiedSearchDef';
import { toast } from 'sonner';

interface AccountingClosuresClientViewProps {
    externalOpen?: boolean;
    onExternalOpenChange?: (open: boolean) => void;
}

export function AccountingClosuresClientView({ externalOpen, onExternalOpenChange }: AccountingClosuresClientViewProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const {
        fiscalYears,
        isLoading: isLoadingYr,
        isActionLoading: actionLoadingYr,
        refetch: fetchFiscalYears,
        closeFiscalYear,
        reopenFiscalYear
    } = useFiscalYears();

    const { entity: selectedFromUrl, clearSelection: clearUrlSelection } = useSelectedFiscalYearPreview();

    const {
        periods,
        isLoading: isLoadingPeriods,
        isActionLoading: actionLoadingPeriod,
        refetch: fetchPeriods,
        closePeriod,
        reopenPeriod,
        createPeriod
    } = useAccountingPeriods();

    const { taxPeriods: taxPeriodsRaw, isLoading: isLoadingTax, refetch: refetchTaxPeriods } = useTaxPeriods();
    const taxPeriods: TaxPeriod[] = useMemo(
        () => ((taxPeriodsRaw as { results?: TaxPeriod[] })?.results ?? []) as TaxPeriod[],
        [taxPeriodsRaw]
    );
    const { closePeriod: closeTaxPeriod, isClosingPeriod: isClosingTaxPeriod } = useCloseTaxPeriod();
    const { reopenPeriod: reopenTaxPeriod, isReopeningPeriod: isReopeningTaxPeriod } = useReopenTaxPeriod();
    const isLoadingTaxAction = isClosingTaxPeriod || isReopeningTaxPeriod;

    const [activeYearToClose] = useState<number | null>(null);
    const [declarationTarget, setDeclarationTarget] = useState<{ id?: number; year?: number; month?: number } | undefined>(undefined);
    const [declarationWizardOpen, setDeclarationWizardOpen] = useState(false);

    // Payment state
    const [paymentPeriodId, setPaymentPeriodId] = useState<number | null>(null);
    const [paymentDeclaration, setPaymentDeclaration] = useState<TaxDeclaration | null>(null);
    const { createTaxPayment } = useCreateTaxPayment();

    // F29 Close state
    const [closeF29PeriodId, setCloseF29PeriodId] = useState<number | null>(null);
    const [closeF29Declaration, setCloseF29Declaration] = useState<TaxDeclaration | null>(null);

    // Checklist state before closing accounting period
    const [pendingClosePeriodId, setPendingClosePeriodId] = useState<number | null>(null);
    const [pendingClosePeriodInfo, setPendingClosePeriodInfo] = useState<{ year: number; month: number } | null>(null);
    const [checklistOpen, setChecklistOpen] = useState(false);
    const [isClosingPeriod, setIsClosingPeriod] = useState(false);

    const isLoading = isLoadingYr || isLoadingPeriods || isLoadingTax;

    // Nuevo año fiscal: ?modal=new o externalOpen. Solo creación: ?selected es el preview de cierre.
    const newFYPanel = useEntityPanelRoute({ actions: [], external: { open: externalOpen, onOpenChange: onExternalOpenChange } });

    // Derivado de URL: abrir preview wizard si hay ?selected= con datos
    const previewModalOpen = !!selectedFromUrl;
    const previewData = selectedFromUrl ?? null;

    const clearSelection = () => {
        clearUrlSelection();
    };

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
            clearSelection();
            fetchPeriods();
            refetchTaxPeriods();
        }
    };

    const handleOpenDeclaration = useCallback((params: { id?: number; year: number; month: number }) => {
        setDeclarationTarget(params);
        setDeclarationWizardOpen(true);
    }, []);

    const handleDeclarationSuccess = useCallback(() => {
        setDeclarationWizardOpen(false);
        setDeclarationTarget(undefined);
        refetchTaxPeriods();
        fetchPeriods();
    }, [refetchTaxPeriods, fetchPeriods]);

    const handleCloseTaxPeriod = useCallback(async (id: number) => {
        const taxPeriod = taxPeriods.find(p => p.id === id)
        if (taxPeriod?.declaration_summary) {
            setCloseF29PeriodId(id)
            setCloseF29Declaration({
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
    }, [taxPeriods]);

    const handleConfirmCloseTaxPeriod = useCallback(async () => {
        if (!closeF29PeriodId) return
        const key = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0
                const v = c === 'x' ? r : (r & 0x3) | 0x8
                return v.toString(16)
            })
        await closeTaxPeriod({ id: closeF29PeriodId, idempotencyKey: key });
        refetchTaxPeriods();
        fetchPeriods();
        setCloseF29PeriodId(null);
        setCloseF29Declaration(null);
    }, [closeF29PeriodId, closeTaxPeriod, refetchTaxPeriods, fetchPeriods]);

    const handleReopenTaxPeriod = useCallback(async (params: { id: number; reason?: string }) => {
        await reopenTaxPeriod(params);
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
            await createTaxPayment({
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
            toast.success("Pago F29 registrado con éxito")
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

    const search = useUnifiedSearch(fiscalYearUnifiedSearchDef)

    const filteredGrouped = useMemo(() => {
        let result = groupedData
        if (search.filters.status) result = result.filter(g => (g.fiscalYear?.status || 'OPEN') === search.filters.status)
        return search.filterFn(result.map(r => ({ ...r, status: r.fiscalYear?.status ?? 'OPEN' })))
    }, [groupedData, search.filters.status, search.filterFn, search])

    // Fiscal year → its 12 months (tree, §6.19). Pages of 10 years, each with all its months.
    const closureRows = useMemo(() => buildClosureTree(filteredGrouped), [filteredGrouped])
    const collection = useEntityCollection(
        closureEntity,
        // A running action (close, reopen, declare…) marks the table busy, as the former view did.
        { rows: closureRows, isRefetching: actionLoadingYr || actionLoadingPeriod || isLoadingTaxAction, isFiltered: search.isFiltered },
        { pagination: { mode: 'client', pageSize: 10 } },
    )

    // Reopen confirmations (they lived in each month card): one per period type, for the whole tree.
    const { confirmAndExecute: confirmReopenPeriod, dialog: reopenPeriodDialog } = useReopenConfirm(reopenPeriod, { periodType: 'contable' })
    const { confirmAndExecute: confirmReopenTaxPeriod, dialog: reopenTaxPeriodDialog } = useReopenConfirm(handleReopenTaxPeriod, { periodType: 'tributario (F29)' })

    if (groupedData.length === 0) {
        return (
            <div className="pt-8">
                <EmptyState
                    context="finance"
                    title="Aún no hay periodos contables"
                    description="Los periodos y cierres se activan automáticamente al registrar el primer asiento contable."
                />
                <EntityPanelTab label="accounting.fiscalyear" {...newFYPanel.tab}>
                    {(open) => (
                        <NewFiscalYearDrawer
                            isOpen={open}
                            onClose={newFYPanel.close}
                            onConfirm={handleCreateFY}
                            isLoading={actionLoadingPeriod}
                            existingYears={fiscalYears.map(fy => fy.year)}
                            hasOpenPeriods={periods.some(p => p.status === 'OPEN')}
                        />
                    )}
                </EntityPanelTab>
            </div>
        );
    }

    const actionsCtx: ClosureActionsCtx = {
        onCloseYear: handlePreviewClosing,
        // Errors are reported by the mutation; the promise must not go unhandled.
        onReopenYear: (year) => { void Promise.resolve(reopenFiscalYear(year)).catch(() => undefined) },
        onCreatePeriod: (year, month) => { void createPeriod({ year, month }) },
        onClosePeriod: handleClosePeriodWithChecklist,
        onReopenPeriod: confirmReopenPeriod,
        onOpenDeclaration: handleOpenDeclaration,
        onPayF29: handlePayF29,
        onCloseTaxPeriod: (id) => { void handleCloseTaxPeriod(id) },
        onReopenTaxPeriod: confirmReopenTaxPeriod,
        isPeriodActionLoading: actionLoadingPeriod,
        isTaxActionLoading: isLoadingTaxAction,
        isFiscalYearLoading: actionLoadingYr,
    }
    const createAction = <ToolbarCreateButton href="/accounting/closures?modal=fy" label="Nuevo Ejercicio Fiscal" />

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root collection={collection} actions={closureActions.forCollection(actionsCtx)}>
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar config={fiscalYearUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar ejercicio..." />
                </Collection.Toolbar>
                <Collection.View table={closureViews.table} onResetFilters={search.clearAll} />
            </Collection.Root>
            {reopenPeriodDialog}
            {reopenTaxPeriodDialog}

            <FiscalYearClosingWizard
                isOpen={previewModalOpen}
                onClose={() => {
                    clearSelection();
                }}
                onConfirm={handleConfirmClosing}
                year={activeYearToClose || (selectedFromUrl?.year ?? 0)}
                preview={previewData}
                isLoading={!previewData && previewModalOpen}
            />

            <DeclarationWizard
                isOpen={declarationWizardOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeclarationWizardOpen(false);
                        setDeclarationTarget(undefined);
                    }
                }}
                periodId={declarationTarget?.id}
                year={declarationTarget?.year}
                month={declarationTarget?.month}
                onSuccess={handleDeclarationSuccess}
            />

            <EntityPanelTab label="accounting.fiscalyear" {...newFYPanel.tab}>
                {(open) => (
                    <NewFiscalYearDrawer
                        isOpen={open}
                        onClose={newFYPanel.close}
                        onConfirm={handleCreateFY}
                        isLoading={actionLoadingPeriod}
                        existingYears={fiscalYears.map(fy => fy.year)}
                        hasOpenPeriods={periods.some(p => p.status === 'OPEN')}
                    />
                )}
            </EntityPanelTab>

            {/* F29 Close Modal */}
            {closeF29Declaration && (
                <F29CloseModal
                    isOpen={closeF29PeriodId !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setCloseF29PeriodId(null)
                            setCloseF29Declaration(null)
                        }
                    }}
                    onConfirm={handleConfirmCloseTaxPeriod}
                    declaration={closeF29Declaration}
                    isClosing={isClosingTaxPeriod}
                />
            )}

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
