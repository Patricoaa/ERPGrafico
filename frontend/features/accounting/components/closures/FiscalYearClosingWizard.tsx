import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BaseModal } from '@/components/shared/BaseModal';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    ShieldCheck,
    ShieldAlert,
    CheckCircle2,
    AlertTriangle,
    FileText,
    ArrowRight,
    ArrowLeft,
    BarChart4,
    Scale,
    Settings2,
    PieChart
} from 'lucide-react';
import { FiscalYearPreviewResult } from '../../types';
import { formatCurrency } from '@/lib/utils';
import { IndustrialCard } from '@/components/shared/IndustrialCard';
import { cn } from '@/lib/utils';
import { LoadingFallback } from '@/components/shared/LoadingFallback';

// Lazy load TrialBalanceView to avoid circular dependencies and keep Step 1 light
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
    const [step, setStep] = useState(1);
    const [showTrialBalance, setShowTrialBalance] = useState(false);
    const [isClosed, setIsClosed] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setIsClosed(false);
        }
    }, [isOpen]);

    if (!preview && !isLoading && isOpen) return null;

    const totalSteps = 4;
    const stepTitles = [
        "Auditoría de Integridad",
        "Resultado Económico",
        "Configuración del Asiento",
        "Confirmación y Cierre"
    ];

    const nextStep = () => setStep(s => Math.min(s + 1, totalSteps));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handleConfirm = async () => {
        await onConfirm();
        setIsClosed(true);
    };

    const renderStepIndicator = () => (
        <div className="flex items-center justify-between mb-8 px-2">
            {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className={cn(
                        "w-8 h-8 rounded-sm flex items-center justify-center text-xs font-bold transition-all duration-300",
                        step === s ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]" :
                            step > s ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                    )}>
                        {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                    </div>
                    {s < 4 && (
                        <div className={cn(
                            "h-[1px] flex-1 mx-2",
                            step > s ? "bg-success" : "bg-border"
                        )} />
                    )}
                </div>
            ))}
        </div>
    );

    const renderStepContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-sm animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Procesando Operación...</p>
                </div>
            );
        }

        if (isClosed) {
            return (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-6 animate-in zoom-in-95 duration-500">
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
            );
        }

        if (!preview) return null;

        switch (step) {
            case 1: // Paso 1: Auditoría de Balance
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {!preview.is_balanced ? (
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
                        ) : (
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
                        )}

                        <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest px-1">Validaciones Críticas</p>
                            <div className="grid grid-cols-1 gap-2">
                                {Object.entries(preview.validations).map(([key, val]: [string, any]) => (
                                    <div key={key} className={cn(
                                        "flex items-center justify-between p-3 border rounded-sm transition-colors",
                                        val.passed ? (val.is_warning ? "bg-amber-500/5 border-amber-500/30" : "bg-muted/20 border-border/50") : "bg-destructive/5 border-destructive/20"
                                    )}>
                                        <span className={cn(
                                            "text-xs font-medium uppercase tracking-tight",
                                            val.passed && val.is_warning && "text-amber-600"
                                        )}>{val.message}</span>
                                        {val.passed ? (
                                            val.is_warning ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-success" />
                                        ) : <AlertTriangle className="w-4 h-4 text-destructive" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 2: // Paso 2: Resultado del Ejercicio
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                                parseFloat(preview.net_result) >= 0 ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                            )}>
                                {parseFloat(preview.net_result) >= 0 ? "Utilidad" : "Pérdida"}
                            </div>
                        </IndustrialCard>
                    </div>
                );

            case 3: // Paso 3: Configuración de Cuenta
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                                    <div>
                                        <p className="text-lg font-mono font-bold">{preview.result_account_code}</p>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-tight">{preview.result_account_name}</p>
                                    </div>
                                </div>
                                <CheckCircle2 className="w-6 h-6 text-primary opacity-50" />
                            </div>
                        </div>
                    </div>
                );

            case 4: // Paso 4: Confirmación Final
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-muted/30 border border-border rounded-sm overflow-hidden text-center">
                            <div className="p-5 space-y-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Año Fiscal a Cerrar</p>
                                    <p className="text-4xl font-heading font-black tabular-nums">{year}</p>
                                </div>
                                <div className="h-[1px] bg-border w-24 mx-auto" />
                                <div>
                                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] mb-1">Transferencia Patrimonial</p>
                                    <p className="text-2xl font-mono font-bold text-primary">{formatCurrency(parseFloat(preview.net_result))}</p>
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
                );

            default:
                return null;
        }
    };

    const isStepValid = () => {
        if (!preview) return false;
        if (step === 1) return preview.can_close && preview.is_balanced;
        return true;
    };

    return (
        <BaseModal
            open={isOpen}
            onOpenChange={(v) => !isClosed && onClose()}
            title={
                <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <span>Cierre del Ejercicio {year}</span>
                </div>
            }
            description={isClosed ? "Proceso finalizado correctamente" : `Paso ${step} de ${totalSteps}: ${stepTitles[step - 1]}`}
            headerClassName="bg-muted/30"
            size="xl"
            showCloseButton={!isClosed}
        >
            <div className="flex flex-col h-full min-h-[450px]">
                {!isClosed && renderStepIndicator()}

                <div className="flex-1">
                    {renderStepContent()}
                </div>

                {!isClosed && (
                    <div className="flex justify-between items-center pt-8 border-t border-border mt-8">
                        <Button
                            variant="ghost"
                            onClick={step === 1 ? onClose : prevStep}
                            className="font-bold uppercase tracking-widest text-[10px]"
                            disabled={isLoading}
                        >
                            <ArrowLeft className="w-3 h-3 mr-2" />
                            {step === 1 ? 'Cancelar' : 'Anterior'}
                        </Button>

                        <div className="flex gap-3">
                            {step < totalSteps ? (
                                <Button
                                    onClick={nextStep}
                                    disabled={!isStepValid() || isLoading}
                                    className="font-bold uppercase tracking-widest text-[10px]"
                                >
                                    Siguiente Paso
                                    <ArrowRight className="w-3 h-3 ml-2" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleConfirm}
                                    disabled={!preview?.can_close || isLoading}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-[0.15em] px-8"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Ejecutar Cierre Definitivo
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

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
        </BaseModal>
    );
}
