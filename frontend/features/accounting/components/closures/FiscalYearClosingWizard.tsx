"use client"

import { formatCurrency } from "@/lib/money"
import React, { useState, useEffect, Suspense, lazy, useMemo, useCallback } from 'react';
import { SkeletonShell, LabeledContainer, CancelButton, SubmitButton, BaseModal, Drawer, GenericWizard, type WizardStep } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
    ShieldCheck,
    CheckCircle2,
    AlertTriangle,
    Scale,
    Settings2,
    PieChart,
    Wallet,
} from 'lucide-react';
import { type FiscalYearPreviewResult } from '../../types';
import { cn } from '@/lib/utils';
import { formDrawerWidth } from '@/lib/form-widths';

// Lazy load FinancialStatementsReport
const FinancialStatementsReport = lazy(() => import('@/features/finance/components/FinancialStatementsReport').then(m => ({ default: m.FinancialStatementsReport })));

interface FiscalYearClosingWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
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
        await onConfirm();
        setIsClosed(true);
    };

    const steps: WizardStep[] = useMemo(() => [
        {
            id: 0,
            title: "Auditoría de Integridad",
            isValid: !!preview?.can_close && !!preview?.is_balanced,
            component: (
                <div className="space-y-6">
                    {preview && !preview.is_balanced ? (
                        <Alert variant="destructive" className="border-2">
                            <AlertTitle className="font-bold uppercase">Error de Cuadratura</AlertTitle>
                            <AlertDescription className="font-medium mt-1 flex items-center justify-between gap-3 text-xs">
                                <p>El Balance de Comprobación presenta descuadres. No se puede proceder con el cierre.</p>
                                <Button
                                    variant="outline" size="sm"
                                    className="w-fit h-7 text-[10px] font-black uppercase tracking-widest bg-destructive/10 border-destructive/30 hover:bg-destructive/20 text-destructive"
                                    onClick={() => setShowTrialBalance(true)}
                                >
                                    <Scale className="w-3 h-3 mr-2" /> Ver Balance
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : preview ? (
                        <Alert variant="success">
                            <AlertTitle className="font-bold uppercase">Balance Cuadrado</AlertTitle>
                            <AlertDescription className="text-success/80 font-medium flex items-center justify-between gap-3 text-xs">
                                <p>Se ha verificado la integridad de la partida doble para el ejercicio {year}.</p>
                                <Button
                                    variant="outline" size="sm"
                                    className="w-fit h-7 text-[10px] font-black uppercase tracking-widest bg-success/10 border-success/30 hover:bg-success/20 text-success"
                                    onClick={() => setShowTrialBalance(true)}
                                >
                                    <Scale className="w-3 h-3 mr-2" /> Ver Balance
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {preview && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest px-1">Validaciones Críticas</p>
                            <div className="grid grid-cols-1 gap-2">
                                {Object.entries(preview.validations).map(([key, val]: [string, { passed: boolean; message: string; is_warning?: boolean }]) => (
                                    <div key={key} className={cn(
                                        "flex items-center justify-between p-3 border rounded-sm transition-colors",
                                        val.passed ? (val.is_warning ? "bg-warning/5 border-warning/30" : "bg-muted/20 border-border/50") : "bg-destructive/5 border-destructive/20"
                                    )}>
                                        <span className={cn(
                                            "text-xs font-medium uppercase tracking-tight",
                                            val.passed && val.is_warning && "text-warning"
                                        )}>{val.message}</span>
                                        {val.passed ? (
                                            val.is_warning ? <AlertTriangle className="w-4 h-4 text-warning" /> : <CheckCircle2 className="w-4 h-4 text-success" />
                                        ) : <AlertTriangle className="w-4 h-4 text-destructive" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )
        },
        {
            id: 1,
            title: "Resultado Económico",
            isValid: true,
            component: preview ? (
                <div className="space-y-6">
                    <Alert variant="primary" className="border-2">
                        <AlertTitle className="font-bold uppercase">Estado de Resultados</AlertTitle>
                        <AlertDescription className="text-primary/80 font-medium mt-1 flex items-center justify-between gap-3 text-xs">
                            <p>Visualice el detalle de cuentas de resultados del ejercicio {year}.</p>
                            <Button
                                variant="outline" size="sm"
                                className="w-fit h-7 text-[10px] font-black uppercase tracking-widest bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary"
                                onClick={() => setShowIncomeStatement(true)}
                            >
                                <PieChart className="w-3 h-3 mr-2" /> Ver Estado de Resultados
                            </Button>
                        </AlertDescription>
                    </Alert>

                    <Alert variant={parseFloat(preview.net_result || '0') >= 0 ? "success" : "destructive"}>
                        <AlertTitle className="font-bold uppercase">Resultado Neto Proyectado</AlertTitle>
                        <AlertDescription className={cn(
                            "font-medium flex items-center justify-between gap-3 text-xs mt-1",
                            parseFloat(preview.net_result || '0') >= 0 ? "text-success/80" : "text-destructive/80"
                        )}>
                            <p>El ejercicio resultó en {parseFloat(preview.net_result || '0') >= 0 ? "una utilidad" : "una pérdida"} para la empresa.</p>
                            <div className="flex items-center gap-4">
                                <span className={cn(
                                    "text-2xl font-mono font-black",
                                    parseFloat(preview.net_result || '0') >= 0 ? "text-success" : "text-destructive"
                                )}>
                                    {formatCurrency(parseFloat(preview.net_result || '0'))}
                                </span>
                                <div className={cn(
                                    "px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-[0.2em]",
                                    parseFloat(preview.net_result || '0') >= 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                                )}>
                                    {parseFloat(preview.net_result || '0') >= 0 ? "Utilidad" : "Pérdida"}
                                </div>
                            </div>
                        </AlertDescription>
                    </Alert>
                </div>
            ) : null
        },
        {
            id: 3,
            title: "Configuración del Asiento",
            isValid: true,
            component: preview ? (
                <div className="space-y-6">
                    <Alert variant="primary">
                        <AlertTitle className="font-bold uppercase">Asignación Automática</AlertTitle>
                        <AlertDescription className="text-foreground/80 font-medium text-xs">
                            El sistema identificó la cuenta patrimonial configurada para recibir el resultado.
                        </AlertDescription>
                    </Alert>

                    <LabeledContainer
                        label="Cuenta de Capital/Utilidades"
                        labelClassName="text-[10px] font-bold uppercase text-muted-foreground tracking-widest px-1"
                    >
                        <div className="p-5 border-2 border-primary/30 bg-muted/20 rounded-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Scale className="w-5 h-5 text-muted-foreground" />
                                {preview && (
                                    <div>
                                        <p className="text-lg font-mono font-bold">{preview.result_account_code}</p>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">{preview.result_account_name}</p>
                                    </div>
                                )}
                            </div>
                            <CheckCircle2 className="w-6 h-6 text-primary opacity-50" />
                        </div>
                    </LabeledContainer>
                </div>
            ) : null
        },
        {
            id: 4,
            title: "Confirmación y Cierre",
            isValid: !!preview?.can_close,
            component: preview ? (
                <div className="space-y-6">
                    <div className="bg-muted/30 border border-border rounded-sm overflow-hidden text-center">
                        <div className="p-5 space-y-4">
                            <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Ejercicio Fiscal a Cerrar</p>
                                <p className="text-4xl  font-black tabular-nums">{year}</p>
                            </div>
                            <div className="h-[1px] bg-border w-24 mx-auto" />
                            <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Transferencia Patrimonial</p>
                                <p className="text-2xl font-mono font-bold text-primary">{formatCurrency(parseFloat(preview.net_result || '0'))}</p>
                            </div>
                        </div>
                    </div>

                    <Alert variant="warning">
                        <AlertTitle className="text-warning-foreground font-extrabold uppercase tracking-tight">Advertencia</AlertTitle>
                        <AlertDescription className="text-warning-foreground/90 text-[10px] font-medium mt-1 leading-relaxed">
                            Esta acción generará el asiento de cierre y bloqueará todos los periodos del año {year}.
                            El re-abierto de periodos quedará registrado en el historial de auditoría.
                        </AlertDescription>
                    </Alert>
                </div>
            ) : null
        }
    ], [preview, year]);

    if (isClosed) {
        return (
            <Drawer
                open={isOpen}
                onOpenChange={onClose}
                defaultSize={formDrawerWidth("complex", false)}
                minSize={500}
                side="left"
                boundary="embedded"
                title=""
                footer={
                    <div className="flex flex-col gap-3 w-full">
                        <SubmitButton
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest text-[11px] h-11"
                            onClick={() => {
                                onClose();
                                window.location.href = `/finances/partners/distributions?modal=new-distribution&yearId=${year}`;
                            }}
                            icon={<PieChart className="w-4 h-4 mr-2" />}
                        >
                            Iniciar Distribución de Utilidades
                        </SubmitButton>
                        <CancelButton
                            className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]"
                            onClick={onClose}
                        >
                            Finalizar Proceso
                        </CancelButton>
                    </div>
                }
            >
                <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
                    <ShieldCheck className="w-10 h-10 text-muted-foreground" />
                    <div>
                        <h3 className="text-2xl  font-black uppercase tracking-tighter">¡Ejercicio {year} Cerrado!</h3>
                        <p className="text-sm text-muted-foreground mt-1 px-4">
                            La contabilidad ha sido sellada y el asiento de cierre ha sido generado con éxito.
                            Ahora puedes proceder con la distribución de utilidades a los socios.
                        </p>
                    </div>
                </div>
            </Drawer>
        );
    }

    return (
        <>
            <GenericWizard
                open={isOpen}
                onOpenChange={onClose}
                onClose={onClose}
                icon={Settings2}
                title={`Cierre del Ejercicio ${year}`}
                steps={steps}
                onComplete={handleConfirm}
                isCompleting={isLoading}
                completeButtonLabel="Ejecutar Cierre Definitivo"
                completeButtonIcon={<Wallet className="h-4 w-4 mr-2" />}
                size="xl"
                isLoading={!preview && isLoading}
                surface="drawer"
                drawerSide="left"
                drawerBoundary="embedded"
            />

            {/* Financial Statements Detail Modal */}
            <BaseModal
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
                        <FinancialStatementsReport activeTab="bs" hideToolbar hideChart />
                    </Suspense>
                </div>
            </BaseModal>

            {/* Income Statement Detail Modal */}
            <BaseModal
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
                        <FinancialStatementsReport activeTab="pl" hideToolbar hideChart />
                    </Suspense>
                </div>
            </BaseModal>
        </>
    );
}
