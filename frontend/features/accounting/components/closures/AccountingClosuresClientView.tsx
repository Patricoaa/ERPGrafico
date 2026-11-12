"use client";

import { useEntityPanelRoute } from "@/hooks/useEntityPanelRoute"
import { EntityPanelTab } from "@/components/providers"
import React, {useState, useMemo, useCallback} from 'react';
import { useFiscalYears } from '../../hooks/useFiscalYears';
import { useAccountingPeriods } from '../../hooks/useAccountingPeriods';
import { FiscalYearClosingWizard } from './FiscalYearClosingWizard';
import { NewFiscalYearDrawer } from './NewFiscalYearDrawer';
import { type AccountingPeriod, type TaxPeriod } from '../../types';
import { useTaxPeriods, useReopenPeriod as useReopenTaxPeriod, DeclarationWizard } from '@/features/tax';
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
    const { reopenPeriod: reopenTaxPeriod, isReopeningPeriod: isReopeningTaxPeriod } = useReopenTaxPeriod();
    const isLoadingTaxAction = isReopeningTaxPeriod;

    const [activeYearToClose] = useState<number | null>(null);
    const [declarationTarget, setDeclarationTarget] = useState<{ id?: number; year?: number; month?: number } | undefined>(undefined);
    const [declarationWizardOpen, setDeclarationWizardOpen] = useState(false);

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

    // The wizard stays open after registering/paying; the lists refresh whenever it closes
    // (Finalizar or leaving mid-way) so the row reflects the phase reached.
    const handleDeclarationOpenChange = useCallback((open: boolean) => {
        if (open) return;
        setDeclarationWizardOpen(false);
        setDeclarationTarget(undefined);
        refetchTaxPeriods();
        fetchPeriods();
    }, [refetchTaxPeriods, fetchPeriods]);

    const handleReopenTaxPeriod = useCallback(async (params: { id: number; reason?: string }) => {
        await reopenTaxPeriod(params);
        refetchTaxPeriods();
        fetchPeriods();
    }, [reopenTaxPeriod, refetchTaxPeriods, fetchPeriods]);

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
                onOpenChange={handleDeclarationOpenChange}
                periodId={declarationTarget?.id}
                year={declarationTarget?.year}
                month={declarationTarget?.month}
                onSuccess={() => handleDeclarationOpenChange(false)}
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
