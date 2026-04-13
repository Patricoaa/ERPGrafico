import React, { useState, useEffect, Suspense, lazy, useMemo } from 'react';
import { GenericWizard, WizardStep } from '@/components/shared/GenericWizard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    ShieldCheck,
    ShieldAlert,
    CheckCircle2,
    AlertTriangle,
    FileText,
    Scale,
    Settings2,
    PieChart,
    Wallet
} from 'lucide-react';
import { FiscalYearPreviewResult } from '../../types';
import { formatCurrency } from '@/lib/utils';
import { IndustrialCard } from '@/components/shared/IndustrialCard';
import { cn } from '@/lib/utils';
import { LoadingFallback } from '@/components/shared/LoadingFallback';
import { BaseModal } from '@/components/shared/BaseModal';

// Lazy load TrialBalanceView
const TrialBalanceView = lazy(() => import('../reports/TrialBalanceView').then(m => ({ default: m.TrialBalanceView })));

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

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setIsClosed(false);
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        await onConfirm();
        setIsClosed(true);
        return true; // Needed for GenericWizard onNext/onComplete
    };

    const steps: WizardStep[] = useMemo(() => [
        {
            id: 1,
            title: "Auditoría de Integridad",
            isValid: !!preview?.can_close && !!preview?.is_balanced,
            component: (
                <div className="space-y-6">
                    {preview && !preview.is_balanced ? (
                        <Alert variant="destructive" className="border-2">
                            <ShieldAlert className="h-5 w-5" />
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
                        <Alert className="bg-success/5 border-success/20">
                            <ShieldCheck className="h-5 w-5 text-success" />
                            <AlertTitle className="text-success font-bold uppercase">Balance Cuadrado</AlertTitle>
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
                            {Object.entries(preview.validations).map(([key, val]: [string, any]) => (
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
                        <IndustrialCard variant="standard" className="p-5 border-t-2 border-t-success bg-success/5">
                            <p className="text-[10px] font-bold uppercase text-success tracking-widest mb-2">Total Ingresos</p>
                            <p className="text-2xl font-mono font-black text-success">
                                {formatCurrency(parseFloat(preview.income_total || '0'))}
                            </p>
                        </IndustrialCard>
                        <IndustrialCard variant="standard" className="p-5 border-t-2 border-t-destructive bg-destructive/5">
                            <p className="text-[10px] font-bold uppercase text-destructive tracking-widest mb-2">Total Egresos</p>
                            <p className="text-2xl font-mono font-black text-destructive">
                                {formatCurrency(Math.abs(parseFloat(preview.expense_total || '0')))}
                            </p>
                        </IndustrialCard>
                    </div>

                    <IndustrialCard variant="industrial" className="p-6 bg-primary/5 border-primary/20 flex items-center justify-between">
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
                    </IndustrialCard>
                </div>
            ) : null
        },
        {
            id: 3,
            title: "Configuración del Asiento",
            isValid: true,
            component: preview ? (
                <div className="space-y-6">
                    <Alert className="bg-primary/5 border-primary/20">
                        <FileText className="h-5 w-5 text-primary" />
                        <AlertTitle className="font-bold uppercase text-primary">Asignación Automática</AlertTitle>
                        <AlertDescription className="text-foreground/80 font-medium text-xs">
                            El sistema identificó la cuenta patrimonial configurada para recibir el resultado.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest px-1">Cuenta de Capital/Utilidades</label>
                        <div className="p-5 border-2 border-primary/30 bg-muted/20 rounded-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-primary/10 rounded-sm flex items-center justify-center">
                                    <Scale className="w-5 h-5 text-primary" />
                                </div>
                                {preview && (
                                <div>
                                    <p className="text-lg font-mono font-bold">{preview.result_account_code}</p>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">{preview.result_account_name}</p>
                                </div>
                                )}
                            </div>
                            <CheckCircle2 className="w-6 h-6 text-primary opacity-50" />
                        </div>
                    </div>
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
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Año Fiscal a Cerrar</p>
                                <p className="text-4xl font-heading font-black tabular-nums">{year}</p>
                            </div>
                            <div className="h-[1px] bg-border w-24 mx-auto" />
                            <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Transferencia Patrimonial</p>
                                <p className="text-2xl font-mono font-bold text-primary">{formatCurrency(parseFloat(preview.net_result || '0'))}</p>
                            </div>
                        </div>
                    </div>

                    <Alert variant="default" className="bg-warning/10 border-warning/20">
                        <AlertTriangle className="h-5 w-5 text-warning" />
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
            <BaseModal
                open={isOpen}
                onOpenChange={onClose}
                size="xl"
                showCloseButton={false}
            >
                <div className="flex flex-col items-center justify-center p-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
                    <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-2">
                        <ShieldCheck className="w-10 h-10 text-success" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-heading font-black uppercase tracking-tighter">¡Ejercicio {year} Cerrado!</h3>
                        <p className="text-sm text-muted-foreground mt-1 px-10">
                            La contabilidad ha sido sellada y el asiento de cierre ha sido generado con éxito. 
                            Ahora puedes proceder con la distribución de utilidades a los socios.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 w-full max-w-sm pt-4">
                        <Button 
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest text-[11px] h-11"
                            onClick={() => {
                                onClose();
                                window.location.href = `/settings/partners?tab=distributions&modal=new-distribution&yearId=${year}`;
                            }}
                        >
                            <PieChart className="w-4 h-4 mr-2" />
                            Iniciar Distribución de Utilidades
                        </Button>
                        <Button 
                            variant="ghost" 
                            className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]"
                            onClick={onClose}
                        >
                            Finalizar Proceso
                        </Button>
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
            title={
                <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <span>Cierre del Ejercicio {year}</span>
                </div>
            }
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
            title={`Balance de Comprobación - Ejercicio ${year}`}
            className="max-w-6xl h-[85vh]"
            size="xl"
        >
            <div className="h-full flex flex-col">
                <Suspense fallback={<LoadingFallback variant="card" message="Cargando reporte de balance..." />}>
                    <TrialBalanceView />
                </Suspense>
            </div>
        </BaseModal>
        </>
    );
}
