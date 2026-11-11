"use client"

import type { ReactNode } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FadeIn, SubmitButton } from "@/components/shared"
import { cn } from "@/lib/utils"
import { POSTopBar } from "./POSTopBar"
import { POSStepper, type POSStepperStep } from "./POSStepper"

export interface POSFlowPrimaryAction {
    label: string
    onClick: () => void
    disabled?: boolean
    /** Último paso: verde, con check y spinner mientras `loading`. */
    final?: boolean
    loading?: boolean
    /** Icono del paso final (por defecto un check). */
    icon?: LucideIcon
}

interface POSFlowLayoutProps {
    /** Identidad de la barra superior. */
    title: string
    subtitle?: ReactNode
    /** Pasos del progreso y el actual (0-based). Sin pasos no se muestra el progreso. */
    steps?: POSStepperStep[]
    currentStep?: number
    progressLabel?: string
    /** Acción de la barra superior (Salir, Cancelar cierre…). */
    exitAction?: ReactNode

    /** Clave del paso: dispara la transición de entrada. */
    stepKey: string
    heading: string
    description?: string
    /** Ancho máximo del paso (`max-w-*`). */
    width?: string
    children: ReactNode

    onBack?: () => void
    backDisabled?: boolean
    hint?: string | null
    primary?: POSFlowPrimaryAction | null
}

/**
 * Flujo táctil a pantalla completa del POS (apertura y cierre de sesión): barra superior compartida,
 * una pregunta por paso con su respuesta centrada y una barra inferior fija con
 * Anterior · indicación · acción del paso (blancos de 64px, pensado para tótem). El paso debe caber
 * sin scroll vertical: en pantallas bajas se compactan márgenes y títulos; el scroll queda solo
 * como resguardo.
 */
export function POSFlowLayout({
    title, subtitle, steps, currentStep = 0, progressLabel = "Progreso", exitAction,
    stepKey, heading, description, width = "max-w-4xl", children,
    onBack, backDisabled, hint, primary,
}: POSFlowLayoutProps) {
    const FinalIcon = primary?.icon ?? CheckCircle2
    return (
        <div className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
            <POSTopBar
                title={title}
                subtitle={subtitle}
                progress={steps && steps.length > 0 ? <POSStepper steps={steps} current={currentStep} label={progressLabel} /> : null}
                actions={exitAction}
            />

            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:py-10 [@media(max-height:820px)]:py-4">
                <FadeIn key={stepKey} className={cn("mx-auto my-auto w-full flex-none gap-8 [@media(max-height:820px)]:gap-5", width)}>
                    <div className="space-y-2 text-center">
                        <h1 className="text-balance text-3xl font-bold tracking-tight lg:text-4xl [@media(max-height:820px)]:text-2xl">{heading}</h1>
                        {description && <p className="text-pretty text-lg text-muted-foreground [@media(max-height:820px)]:text-base">{description}</p>}
                    </div>
                    {children}
                </FadeIn>
            </main>

            <footer className="flex shrink-0 items-center gap-4 border-t border-border bg-card px-4 py-4 sm:px-6 [@media(max-height:820px)]:py-3">
                <div className="flex-1">
                    {onBack && (
                        <Button
                            variant="outline"
                            onClick={onBack}
                            disabled={backDisabled}
                            className="h-16 min-w-40 gap-2 px-6 text-base font-semibold active:scale-[0.98]"
                        >
                            <ChevronLeft className="size-6" aria-hidden />
                            Anterior
                        </Button>
                    )}
                </div>
                {hint && (
                    <p role="status" className="hidden flex-[2] text-center text-base text-muted-foreground sm:block">{hint}</p>
                )}
                <div className="flex flex-1 justify-end">
                    {primary && (
                        <SubmitButton
                            onClick={primary.onClick}
                            disabled={primary.disabled}
                            loading={primary.final && primary.loading}
                            icon={primary.final ? FinalIcon : undefined}
                            className={cn(
                                "h-16 min-w-48 gap-3 px-8 text-base tracking-wider [&_svg]:size-6 active:scale-[0.98]",
                                primary.final && "bg-success text-success-foreground hover:bg-success/90"
                            )}
                        >
                            {primary.label}
                            {!primary.final && <ChevronRight className="size-6" aria-hidden />}
                        </SubmitButton>
                    )}
                </div>
            </footer>
        </div>
    )
}
