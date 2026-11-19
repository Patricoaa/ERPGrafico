"use client"

import { FileText, Receipt } from "lucide-react"
import { useMemo } from "react"
import { ChoiceCard, ChoiceGroup, LabeledSelect } from "@/components/shared"
import {
    getDteDescription,
    getDteLabel,
    getDteSiiCode,
    type DteClass,
    type DteDirection,
} from "@/lib/dte"

export interface DteTypeSelectorProps {
    value: DteClass
    onChange: (value: DteClass) => void
    options: DteClass[]
    direction?: DteDirection
    disabled?: boolean
    variant?: "choice-card" | "select"
    className?: string
}

export function DteTypeSelector({
    value,
    onChange,
    options,
    direction = "sale",
    disabled = false,
    variant = "choice-card",
    className,
}: DteTypeSelectorProps) {
    const selectOptions = useMemo(
        () =>
            options.map((opt) => ({
                value: opt,
                label: `${getDteLabel(opt)} (${getDteSiiCode(opt)})`,
            })),
        [options]
    )

    if (variant === "select") {
        return (
            <LabeledSelect
                label="Tipo de Documento"
                value={value}
                onChange={(v) => onChange(v as DteClass)}
                options={selectOptions}
                disabled={disabled}
                className={className}
            />
        )
    }

    return (
        <ChoiceGroup
            label="Tipo de Documento"
            columns="grid-cols-1 sm:grid-cols-2"
            activation="select"
            className={className}
        >
            {options.map((opt) => {
                const isBoleta = opt === "BOLETA" || opt === "BOLETA_EXENTA"
                const isExenta = opt === "BOLETA_EXENTA" || opt === "FACTURA_EXENTA"
                const code = getDteSiiCode(opt)
                return (
                    <ChoiceCard
                        key={opt}
                        selected={value === opt}
                        onSelect={() => onChange(opt)}
                        disabled={disabled}
                        icon={isBoleta ? Receipt : FileText}
                        tone={isExenta ? "warning" : undefined}
                        meta={code ? `Código SII ${code}` : undefined}
                        title={getDteLabel(opt)}
                        description={getDteDescription(opt, direction)}
                    />
                )
            })}
        </ChoiceGroup>
    )
}
