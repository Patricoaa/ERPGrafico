"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useFiscalYears } from '../../hooks/useFiscalYears';
import { useAccountingPeriods } from '../../hooks/useAccountingPeriods';
import { FiscalYearCard } from './FiscalYearCard';
import { FiscalYearClosingWizard } from './FiscalYearClosingWizard';
import { NewFiscalYearModal } from './NewFiscalYearModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { AccountingPeriod, FiscalYearPreviewResult, FiscalYear } from '../../types';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useSelectedEntity } from '@/hooks/useSelectedEntity';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import { createActionsColumn, DataCell } from '@/components/ui/data-table-cells';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LayoutGrid, List, PlayCircle, ShieldAlert, Lock, LockOpen } from 'lucide-react';
import { ToolbarCreateButton, SmartSearchBar, useClientSearch } from '@/components/shared';
import { ClosuresSkeleton } from './ClosuresSkeleton';
import { fiscalYearSearchDef } from '../../searchDef';

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
        isLoading: isLoadingYr,
        isActionLoading: actionLoadingYr,
        refetch: fetchFiscalYears,
        previewClosing,
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
        clearUrlSelection();
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
        if (selectedFromUrl) {
            const year = selectedFromUrl.year;
            if (!previewModalOpen && activeYearToClose !== year) {
                setActiveYearToClose(year);
                setPreviewData(selectedFromUrl);
                setPreviewModalOpen(true);
            }
        }
    }, [selectedFromUrl, previewModalOpen, activeYearToClose]);

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

    const { filterFn } = useClientSearch<{ year: number; periods: AccountingPeriod[]; fiscalYear: FiscalYear | undefined; status: string }>(fiscalYearSearchDef)

    const [viewMode, setViewMode] = useState<string>(searchParams.get("view") ?? "card");

    const handleViewChange = (v: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('view', v);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
        setViewMode(v);
    };

    if (isLoadingYr || isLoadingPeriods) {
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
            cell: ({ row }) => <div className="text-muted-foreground">{row.original.periods.length} meses registrados</div>,
        },
        createActionsColumn<typeof groupedData[0]>({
            renderActions: (row) => {
                const status = row.fiscalYear?.status || 'OPEN';
                const isClosed = status === 'CLOSED';
                return (
                    <>
                        {!isClosed ? (
                            <DataCell.Action
                                icon={ShieldAlert}
                                title="Ejecutar Cierre"
                                onClick={() => handlePreviewClosing(row.year)}
                                disabled={row.periods.length === 0 || row.periods.some(p => p.status !== 'CLOSED')}
                            />
                        ) : (
                            <>
                                <DataCell.Action
                                    icon={LockOpen}
                                    title="Reabrir Ejercicio"
                                    className="text-warning"
                                    onClick={() => reopenFiscalYear(row.year)}
                                />
                                <DataCell.Action
                                    icon={PlayCircle}
                                    title="Generar Asiento Apertura"
                                    className="text-success"
                                    onClick={() => generateOpeningEntry(row.year)}
                                />
                            </>
                        )}
                    </>
                );
            }
        })
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <DataTable
                columns={columns}
                data={filterFn(groupedData.map(r => ({ ...r, status: r.fiscalYear?.status ?? 'OPEN' })))}
                isLoading={actionLoadingYr || actionLoadingPeriod}
                variant="standalone"
                leftAction={<SmartSearchBar searchDef={fiscalYearSearchDef} placeholder="Buscar ejercicio..." />}
                currentView={viewMode}
                onViewChange={handleViewChange}
                defaultPageSize={10}
                viewOptions={[
                    { label: "Lista", value: "list", icon: List },
                    { label: "Tarjeta", value: "card", icon: LayoutGrid }
                ]}
                createAction={
                    <ToolbarCreateButton 
                        href="/accounting/closures?modal=fy" 
                        label="Nuevo Año Fiscal" 
                    />
                }
                renderCustomView={viewMode === 'card' ? (table) => (
                    <div className="space-y-6 pt-4">
                        {table.getRowModel().rows.map(row => {
                            const { year, periods: yearPeriods, fiscalYear } = row.original;
                            return (
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
                            );
                        })}
                    </div>
                ) : undefined}
            />

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
