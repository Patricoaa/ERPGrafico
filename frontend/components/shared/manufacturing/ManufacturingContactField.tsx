"use client"

import { User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { LabeledContainer } from "@/components/shared"
import type { Contact } from "@/types/entities"

export interface ManufacturingContact {
  id: number
  name: string
  tax_id?: string | null
}

interface ManufacturingContactFieldProps {
  value: ManufacturingContact | null
  onChange: (next: ManufacturingContact | null) => void
  disabled?: boolean
}

export function ManufacturingContactField({ value, onChange, disabled }: ManufacturingContactFieldProps) {
  // typography-allow: meta - clear button
  const clearButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Quitar contacto"
      className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
      onClick={() => onChange(null)}
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  )

  return (
    <LabeledContainer label="Contacto relacionado">
      {value ? (
        <div className="flex items-center justify-between w-full h-6">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <User className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-sm text-foreground truncate">{value.name}</span>
            {value.tax_id && <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline font-mono">[{value.tax_id}]</span>}
          </div>
          {!disabled && clearButton}
        </div>
      ) : (
        <AdvancedContactSelector
          onSelectContact={(c: Contact) => onChange({ id: c.id, name: c.name, tax_id: c.tax_id ?? null })}
          onChange={() => { }}
          placeholder="Buscar contacto…"
          variant="standalone"
          disabled={disabled}
          className="h-6 px-0 border-none bg-transparent hover:bg-transparent shadow-none text-sm text-muted-foreground font-normal"
        />
      )}
    </LabeledContainer>
  )
}
