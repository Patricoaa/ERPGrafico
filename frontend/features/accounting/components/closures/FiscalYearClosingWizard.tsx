"use client"

import { formatCurrency } from "@/lib/money"
import React, { useState, useEffect, Suspense, lazy, useMemo, useCallback } from 'react';
import { SkeletonShell, LabeledContainer, CancelButton, SubmitButton, BaseModal, GenericWizard, type WizardStep } from '@/components/shared';
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
import { useClosingChecklist } from '../../hooks/useClosingChecklist';

// Lazy load TrialBalanceReport
const TrialBalanceReport = lazy(() => import('../reports/TrialBalanceReport').then(m => ({ default: m.TrialBalanceReport })));

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
    const [isClosed, setIsClosed] = useState(false);

    const {
        items: checklistItems,
        isLoading: isChecklistLoading,
        isError: isChecklistError,
        toggleItem: handleToggleChecklist,
        checklistPassed,
    } = useClosingChecklist(year, isOpen);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => setIsClosed(false));
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        await onConfirm();
        setIsClosed(true);
    };

    const steps: WizardStep[] = useMemo(() => [
        {
            id: 0,
            title: "Checklist de Cierre",
            isValid: checklistPassed,
            component: (
                <div className="space-y-4">
                    {isChecklistLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-xs text-muted-foreground">Cargando checklist...</span>
                        </div>
                    ) : isChecklistError ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-xs text-destructive">No se pudo cargar el checklist. Puede continuar con el cierre.</span>
                        </div>
                    ) : checklistItems && checklistItems.length > 0 ? (
                        <div className="space-y-3">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest px-1">
                                Verifique que los siguientes items estén completados antes del cierre
                            </p>
                            <div className="space-y-1">
                                {checklistItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "flex items-start gap-3 p-3 border rounded-sm transition-colors cursor-pointer hover:bg-muted/30",
                                            item.is_completed
                                                ? "border-success/30 bg-success/5"
                                                : item.is_required
                                                    ? "border-border"
                                                    : "border-dashed border-border/50"
                                        )}
                                        onClick={() => handleToggleChecklist(item)}
                                    >
                                        <Checkbox
                                            checked={item.is_completed}
                                            onCheckedChange={() => handleToggleChecklist(item)}
                                            className="mt-0.5"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-xs font-medium",
                                                    item.is_completed && "line-through text-muted-foreground"
                                                )}>
                                                    {item.name}
                                                </span>
                                                <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                                                    {item.category_display}
                                                </span>
                                                {item.is_required && (
                                                    <span className="text-[8px] uppercase tracking-wider text-destructive">*</span>
                                                )}
                                            </div>
                                            {item.description && (
                                                <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>
                                            )}
                                            {item.notes && (
                                                <p className="text-[9px] text-muted-foreground/60 mt-1 italic">Nota: {item.notes}</p>
                                            )}
                                        </div>
                                        {item.is_completed ? (
                                            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                                        ) : item.is_required ? (
                                            <AlertTriangle className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                            {!checklistPassed && (
                                <Alert variant="warning" className="mt-4">
                                    <AlertTriangle className="w-4 h-4" />
                                    <AlertTitle className="text-xs font-bold uppercase">Checklist incompleto</AlertTitle>
                                    <AlertDescription className="text-[10px]">
                                        Complete todos los items requeridos antes de continuar con el cierre.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {checklistPassed && (
                                <Alert variant="success" className="mt-4">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <AlertTitle className="text-xs font-bold uppercase">Checklist completado</AlertTitle>
                                    <AlertDescription className="text-[10px]">
                                        Todos los items requeridos están verificados. Puede continuar.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-xs text-muted-foreground">No hay items de checklist configurados.</span>
                        </div>
                    )}
                </div>
            ),
        },
        {
            id: 1,
            title: "Auditoría de Integridad",
            isValid: !!preview?.can_close && !!preview?.is_balanced,
            component: (
                <div className="space-y-6">
                    {preview && !preview.is_balanced ? (
                        <Alert variant="destructive" className="border-2">
                            <AlertTitle className="font-bold uppercase">Error de Cuadratura</AlertTitle>
                            <AlertDescription className="font-medium mt-1 flex flex-col gap-3 text-xs">
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
                            <AlertDescription className="text-success/80 font-medium flex flex-col gap-3 text-xs">
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
            id: 2,
            title: "Resultado Económico",
            isValid: true,
            component: preview ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="rounded-none border-dashed bg-card/50 shadow-card p-5 border-t-2 border-t-income bg-income/5">
                            <p className="text-[10px] font-bold uppercase text-income tracking-widest mb-2">Total Ingresos</p>
                            <p className="text-2xl font-mono font-black text-income">
                                {formatCurrency(parseFloat(preview.income_total || '0'))}
                            </p>
                        </Card>
                        <Card className="rounded-none border-dashed bg-card/50 shadow-card p-5 border-t-2 border-t-expense bg-expense/5">
                            <p className="text-[10px] font-bold uppercase text-expense tracking-widest mb-2">Total Egresos</p>
                            <p className="text-2xl font-mono font-black text-expense">
                                {formatCurrency(Math.abs(parseFloat(preview.expense_total || '0')))}
                            </p>
                        </Card>
                    </div>

                    <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card p-6 bg-primary/5 border-primary/20 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest mb-2">Resultado Neto Proyectado</p>
                            <p className="text-3xl font-mono font-black text-foreground tabular-nums tracking-tighter">
                                {formatCurrency(parseFloat(preview.net_result || '0'))}
                            </p>
                        </div>
                        <div className={cn(
                            "px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-[0.2em]",
                            parseFloat(preview.net_result || '0') >= 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                        )}>
                            {parseFloat(preview.net_result || '0') >= 0 ? "Utilidad" : "Pérdida"}
                        </div>
                    </Card>
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
                                <p className="text-4xl font-heading font-black tabular-nums">{year}</p>
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
    ], [preview, year, isChecklistLoading, isChecklistError, checklistItems, checklistPassed, handleToggleChecklist]);

    if (isClosed) {
        return (
            <BaseModal
                open={isOpen}
                onOpenChange={onClose}
                size="xl"
                showCloseButton={false}
                hideScrollArea={true}
                contentClassName="p-0"
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
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
                    <ShieldCheck className="w-10 h-10 text-muted-foreground" />
                    <div>
                        <h3 className="text-2xl font-heading font-black uppercase tracking-tighter">¡Ejercicio {year} Cerrado!</h3>
                        <p className="text-sm text-muted-foreground mt-1 px-10">
                            La contabilidad ha sido sellada y el asiento de cierre ha sido generado con éxito.
                            Ahora puedes proceder con la distribución de utilidades a los socios.
                        </p>
                    </div>
                </div>
            </BaseModal>
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
            />

            {/* Trial Balance Detail Modal */}
            <BaseModal
                open={showTrialBalance}
                onOpenChange={setShowTrialBalance}
                icon={Scale}
                title={`Balance de Comprobación - Ejercicio ${year}`}
                description="Resumen de sumas y saldos del ejercicio fiscal."
                size="xl"
                hideScrollArea={true}
                contentClassName="p-0"
            >
                <div className="h-full flex flex-col p-4">
                    <Suspense fallback={<SkeletonShell isLoading ariaLabel="Cargando..." />}>
                        <TrialBalanceReport />
                    </Suspense>
                </div>
            </BaseModal>
        </>
    );
}
