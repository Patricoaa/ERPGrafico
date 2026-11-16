"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServerDate } from '@/hooks/useServerDate';
import { GenericWizard, LabeledContainer, Section, type WizardStep } from '@/components/shared';

interface NewFiscalYearWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (year: number) => Promise<boolean>;
    isLoading: boolean;
    existingYears: number[];
    hasOpenPeriods?: boolean;
}

export function NewFiscalYearWizard({
    isOpen,
    onClose,
    onConfirm,
    isLoading,
    existingYears,
    hasOpenPeriods = false
}: NewFiscalYearWizardProps) {
    const { year: serverYear } = useServerDate();
    const currentYear = serverYear || new Date().getFullYear();
    const nextYearSuggestion = existingYears.length > 0
        ? Math.max(...existingYears) + 1
        : currentYear;

    const [selectedYear, setSelectedYear] = useState(nextYearSuggestion);

    const years = [
        currentYear - 1,
        currentYear,
        currentYear + 1,
        currentYear + 2
    ].filter(y => !existingYears.includes(y) || y === selectedYear);

    // Ensure the suggestion is in the list
    if (!years.includes(nextYearSuggestion)) {
        years.push(nextYearSuggestion);
        years.sort((a, b) => a - b);
    }

    // Reset the selection each time the wizard opens
    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => setSelectedYear(nextYearSuggestion));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleConfirm = async () => {
        const success = await onConfirm(selectedYear);
        if (success) {
            onClose();
        }
    };

    const isYearTaken = existingYears.includes(selectedYear);

    const steps: WizardStep[] = useMemo(() => [
        {
            id: 0,
            title: "Selección del Ejercicio",
            isValid: !isYearTaken && !hasOpenPeriods,
            component: (
                <div className="space-y-6">
                    {hasOpenPeriods && (
                        <div className="p-4 rounded-md bg-destructive/10 border border-destructive/20 flex gap-4 items-start animate-in fade-in slide-in-from-top-4">
                            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-destructive uppercase tracking-wider">Acción Bloqueada</p>
                                <p className="text-xs text-destructive/80 leading-relaxed font-medium">
                                    No se puede inicializar un nuevo ejercicio fiscal mientras existan periodos mensuales <strong>ABIERTOS</strong>.
                                    Por favor, cierra todos los meses anteriores antes de continuar.
                                </p>
                            </div>
                        </div>
                    )}
                    <LabeledContainer
                        label="Seleccione el Ejercicio Fiscal"
                    >
                        <div className="grid grid-cols-4 gap-3 p-1">
                            {years.map(y => {
                                const isExisting = existingYears.includes(y);
                                return (
                                    <div
                                        key={y}
                                        className={cn(
                                            "relative group overflow-hidden rounded-md border px-4 py-6 text-center transition-all duration-200",
                                            isExisting
                                                ? "bg-muted/30 border-muted opacity-50 cursor-not-allowed"
                                                : "cursor-pointer",
                                            selectedYear === y && !isExisting
                                                ? "bg-primary/10 border-primary/30 ring-1 ring-primary/20"
                                                : (!isExisting ? "bg-card border-border/50 hover:border-primary/20 hover:bg-primary/5" : "")
                                        )}
                                        onClick={() => !isExisting && setSelectedYear(y)}
                                    >
                                        <div className={cn(
                                            "text-lg font-black tracking-tighter transition-all",
                                            selectedYear === y && !isExisting ? "text-primary scale-110" : "text-foreground/60"
                                        )}>
                                            {y}
                                        </div>
                                        {isExisting && (
                                            <div className="absolute top-1 right-1">
                                                <CheckCircle2 className="h-3 w-3 text-success/50" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </LabeledContainer>
                </div>
            ),
        },
        {
            id: 1,
            title: "Confirmación",
            isValid: !isYearTaken && !hasOpenPeriods,
            component: (
                <div className="space-y-8">
                    <Section title="Ejercicio a inicializar">
                        <Section.Row variant="stat" title="Ejercicio fiscal" value={String(selectedYear)} />
                        <Section.Row variant="stat" title="Periodo inicial" value={`Enero ${selectedYear} (abierto)`} strong />
                    </Section>
                    <Section title="Qué sucede después">
                        <Section.Note>Los meses siguientes se habilitan automáticamente al registrar el primer asiento contable en cada periodo.</Section.Note>
                        <Section.Note>Los períodos tributarios (F29) se activan al iniciar la primera declaración mensual.</Section.Note>
                        <Section.Note>El registro del ejercicio fiscal se genera al ejecutar el cierre anual.</Section.Note>
                    </Section>
                </div>
            ),
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [selectedYear, existingYears, hasOpenPeriods, isYearTaken]);


    return (
        <GenericWizard
            open={isOpen}
            onOpenChange={(open) => { if (!open) onClose(); }}
            onClose={onClose}
            icon={Calendar}
            title="Inicializar Ejercicio Fiscal"
            steps={steps}
            onComplete={handleConfirm}
            isCompleting={isLoading}
            completeButtonLabel="Crear Periodo Enero"
            completeButtonIcon={<CheckCircle2 className="h-4 w-4 mr-2" />}
            size="xl"
            surface="modal"
            stableHeight
            cardSurface
        />
    );
}
