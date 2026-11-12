"use client"

import { formatCurrency } from "@/lib/money"
import React, { useState, useEffect, Suspense, lazy, useMemo } from 'react';
import { SkeletonShell, CancelButton, SubmitButton, BaseModal, GenericWizard, SummarySection, SummaryRow, SummaryNote, type WizardStep } from '@/components/shared';
import { Button } from '@/components/ui/button';

import { PendingChecklistSection, type PendingChecklistItem } from '@/features/tax';

import {
    Scale,
    Settings2,
    PieChart,
    Wallet,
} from 'lucide-react';
import { type FiscalYearPreviewResult } from '../../types';

// Lazy load FinancialStatementsReport
const FinancialStatementsReport = lazy(() => import('@/features/finance/components/FinancialStatementsReport').then(m => ({ default: m.FinancialStatementsReport })));

interface FiscalYearClosingWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    year: number;
    preview: FiscalYearPreviewResult | null;
    isLoading: boolean;
}

export function FiscalYearClosingWizard({
    isOpen,
    onClose,
    onConfirm,
    year,
    preview,
    isLoading
}: FiscalYearClosingWizardProps) {
    const [showTrialBalance, setShowTrialBalance] = useState(false);
    const [showIncomeStatement, setShowIncomeStatement] = useState(false);
    const [isClosed, setIsClosed] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => {
                setIsClosed(false);
                setShowTrialBalance(false);
                setShowIncomeStatement(false);
            });
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        try {
            await onConfirm();
        } catch {
            // El hook de cierre ya mostró el error; el wizard sigue abierto para reintentar.
            return;
        }
        setIsClosed(true);
    };

    const netResult = parseFloat(preview?.net_result || '0');
    const isProfit = netResult >= 0;
    const noop = () => { };

    const steps: WizardStep[] = useMemo(() => {
        const validationItems: PendingChecklistItem[] = preview
            ? Object.entries(preview.validations).map(([key, val]) => ({
                key,
                title: val.message,
                passed: val.passed,
            }))
            : [];
        const balanceItem: PendingChecklistItem | null = preview
            ? {
                key: 'balance',
                title: 'Balance de comprobación cuadrado',
                detail: preview.is_balanced ? undefined : 'El balance presenta descuadres; no se puede proceder con el cierre.',
                passed: preview.is_balanced,
                action: { text: 'Ver balance', variant: 'ghost', icon: Scale, onClick: () => setShowTrialBalance(true) },
            }
            : null;
        const warningKeys = new Set(
            preview ? Object.entries(preview.validations).filter(([, v]) => v.is_warning).map(([k]) => k) : []
        );
        const required = [...(balanceItem ? [balanceItem] : []), ...validationItems.filter(i => !warningKeys.has(i.key))];
        const suggested = validationItems.filter(i => warningKeys.has(i.key));

        return [
            {
                id: 0,
                title: "Auditoría de Integridad",
                isValid: !!preview?.can_close && !!preview?.is_balanced,
                component: (
                    <div className="space-y-8">
                        <PendingChecklistSection title="Obligatorios" items={required} critical expanded={new Set()} onToggle={noop} onOpenDocument={noop} />
                        {suggested.length > 0 && (
                            <PendingChecklistSection title="Sugeridos" items={suggested} critical={false} expanded={new Set()} onToggle={noop} onOpenDocument={noop} />
                        )}
                    </div>
                )
            },
            {
                id: 1,
                title: "Resultado y Cierre",
                isValid: !!preview?.can_close,
                component: preview ? (
                    <div className="space-y-8">
                        <SummarySection title="Resultado del ejercicio" action={
                            <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => setShowIncomeStatement(true)}>
                                <PieChart className="h-3.5 w-3.5" aria-hidden /> Ver Estado de Resultados
                            </Button>
                        }>
                            <SummaryRow label="Ingresos" value={formatCurrency(parseFloat(preview.income_total || '0'))} />
                            <SummaryRow label="Gastos y costos" value={formatCurrency(parseFloat(preview.expense_total || '0'))} />
                            <SummaryRow
                                label={isProfit ? "Utilidad del ejercicio" : "Pérdida del ejercicio"}
                                value={formatCurrency(netResult)}
                                strong
                                valueClassName={isProfit ? "text-success" : "text-destructive"}
                            />
                        </SummarySection>

                        <SummarySection title="Asiento de cierre">
                            <SummaryRow label="Ejercicio fiscal a cerrar" value={String(year)} />
                            <SummaryRow
                                label="Cuenta que recibe el resultado"
                                value={preview.result_account_code ? `${preview.result_account_code} · ${preview.result_account_name ?? ''}` : "Sin configurar"}
                                valueClassName={preview.result_account_code ? undefined : "text-destructive"}
                            />
                            <SummaryRow label="Transferencia patrimonial" value={formatCurrency(netResult)} strong />
                        </SummarySection>

                        <SummarySection title="Efectos del cierre">
                            <SummaryNote>Se genera el asiento de cierre y se bloquean todos los períodos del año {year}.</SummaryNote>
                            <SummaryNote>Reabrir períodos queda registrado en el historial de auditoría.</SummaryNote>
                            {isProfit && <SummaryNote>Después podrás distribuir la utilidad a los socios.</SummaryNote>}
                        </SummarySection>
                    </div>
                ) : null
            },
        ];
    }, [preview, year, isProfit, netResult]);

    // Tras el cierre el éxito es un paso más del mismo wizard (mismo modal, altura y footer), no otro modal.
    const doneStep: WizardStep = {
        id: 'done',
        title: `Ejercicio ${year} cerrado`,
        isValid: true,
        component: (
            <div className="space-y-8">
                <SummarySection title="Cierre completado">
                    <SummaryRow label="Ejercicio fiscal" value={String(year)} />
                    <SummaryRow label="Transferencia patrimonial" value={formatCurrency(netResult)} strong />
                    <SummaryNote tone="success">La contabilidad quedó sellada y el asiento de cierre se generó con éxito.</SummaryNote>
                </SummarySection>
                <SummarySection title="Siguiente paso">
                    <SummaryNote>Distribuye la utilidad entre los socios cuando corresponda.</SummaryNote>
                </SummarySection>
            </div>
        ),
    };

    const doneFooter = (
        <div className="flex w-full items-center justify-end gap-2">
            <CancelButton onClick={onClose}>Finalizar</CancelButton>
            <SubmitButton
                onClick={() => {
                    onClose();
                    window.location.href = `/finances/partners/distributions?modal=new-distribution&yearId=${year}`;
                }}
                icon={<PieChart className="mr-2 h-4 w-4" />}
            >
                Iniciar Distribución de Utilidades
            </SubmitButton>
        </div>
    );

    return (
        <>
            <GenericWizard
                open={isOpen}
                onOpenChange={onClose}
                onClose={onClose}
                icon={Settings2}
                title={`Cierre del Ejercicio ${year}`}
                steps={isClosed ? [doneStep] : steps}
                subtitle={isClosed ? 'Cierre completado' : undefined}
                footer={isClosed ? doneFooter : undefined}
                onComplete={handleConfirm}
                isCompleting={isLoading}
                completeButtonLabel="Ejecutar Cierre Definitivo"
                completeButtonIcon={<Wallet className="h-4 w-4 mr-2" />}
                size="xl"
                isLoading={!preview && isLoading}
                surface="modal"
                stableHeight
                cardSurface
            />

            {/* Financial Statements Detail Modal */}
            <BaseModal
                asDialog
                open={showTrialBalance}
                onOpenChange={setShowTrialBalance}
                icon={Scale}
                title={`Balance General - Ejercicio ${year}`}
                description="Resumen de activos, pasivos y patrimonio del ejercicio fiscal."
                size="xl"
                hideScrollArea={true}
                contentClassName="p-0"
            >
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                    <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                        <FinancialStatementsReport activeTab="bs" hideToolbar />
                    </Suspense>
                </div>
            </BaseModal>

            {/* Income Statement Detail Modal */}
            <BaseModal
                asDialog
                open={showIncomeStatement}
                onOpenChange={setShowIncomeStatement}
                icon={PieChart}
                title={`Estado de Resultados - Ejercicio ${year}`}
                description="Resumen de ingresos, costos y gastos del ejercicio fiscal."
                size="xl"
                hideScrollArea={true}
                contentClassName="p-0"
            >
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                    <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                        <FinancialStatementsReport activeTab="pl" hideToolbar />
                    </Suspense>
                </div>
            </BaseModal>
        </>
    );
}
