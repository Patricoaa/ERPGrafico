"use client";

import React, { useState } from 'react';
import { Calendar, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServerDate } from '@/hooks/useServerDate';
import { Drawer, LabeledContainer, CancelButton, SubmitButton, FormFooter } from '@/components/shared';
import { formDrawerWidth } from '@/lib/form-widths';

interface NewFiscalYearDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (year: number) => Promise<boolean>;
    isLoading: boolean;
    existingYears: number[];
    hasOpenPeriods?: boolean;
}

export function NewFiscalYearDrawer({
    isOpen,
    onClose,
    onConfirm,
    isLoading,
    existingYears,
    hasOpenPeriods = false
}: NewFiscalYearDrawerProps) {
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

    const handleConfirm = async () => {
        const success = await onConfirm(selectedYear);
        if (success) {
            onClose();
        }
    };

    return (
        <Drawer
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            side="left"
            defaultSize={formDrawerWidth("simple", false)}
            contentClassName="p-0"
            icon={Calendar}
            title="Inicializar Ejercicio Fiscal"
            subtitle="Creación del periodo contable inicial para el nuevo año."
            footer={
                <FormFooter
                    actions={
                        <>
                            <CancelButton
                                onClick={onClose}
                                disabled={isLoading}
                            />
                            <SubmitButton
                                onClick={handleConfirm}
                                loading={isLoading}
                                disabled={existingYears.includes(selectedYear) || hasOpenPeriods}
                                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                            >
                                Crear Periodo Enero
                            </SubmitButton>
                        </>
                    }
                />
            }
        >
            <div className="px-4 pb-4 pt-2 space-y-6">
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
                    labelClassName="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ml-1"
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

                <div className="p-4 rounded-md bg-info/5 border border-info/10 flex gap-4 items-start">
                    <AlertCircle className="h-5 w-5 text-info shrink-0 mt-0.5" />
                    <div className="space-y-1">
                            <p className="text-xs font-bold text-info uppercase tracking-wider">¿Qué se crea?</p>
                            <p className="text-xs text-info/70 leading-relaxed font-medium">
                                Se crea el periodo contable de <strong>Enero {selectedYear}</strong> como abierto.
                                Los meses siguientes se habilitan automáticamente al registrar el primer asiento contable en cada periodo,
                                y los períodos tributarios (F29) se activan al iniciar la primera declaración mensual.
                                El registro del ejercicio fiscal se genera al ejecutar el cierre anual.
                            </p>
                    </div>
                </div>
            </div>
        </Drawer>
    );
}
