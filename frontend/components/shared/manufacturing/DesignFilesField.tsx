"use client"

/**
 * DesignFilesField — notched multi-file field for the design files of a fabrication.
 * Internal to the manufacturing editor (not exported from the shared barrel).
 */

import { ExternalLink, FileIcon, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LabeledContainer } from "../LabeledContainer"

interface DesignFilesFieldProps {
  /** Already uploaded files, by name. */
  existing: string[]
  /** Openable URL per existing file name (opened in a new tab). */
  existingUrls?: Record<string, string>
  /** Files picked now, uploaded on save. */
  files: File[]
  onAdd: (files: File[]) => void
  onRemoveNew: (index: number) => void
  onRemoveExisting: (index: number) => void
  required?: boolean
  disabled?: boolean
}

export function DesignFilesField({
  existing, existingUrls, files, onAdd, onRemoveNew, onRemoveExisting, required, disabled,
}: DesignFilesFieldProps) {
  const count = existing.length + files.length
  return (
    <LabeledContainer label={count > 0 ? `Archivos de diseño (${count})` : "Archivos de diseño"} required={required} disabled={disabled}>
      <div className="w-full space-y-1 py-1">
        {existing.map((name, i) => {
          const url = existingUrls?.[name]
          return (
            <div key={`existing-${name}-${i}`} className="flex items-center gap-2 text-xs">
              <FileIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="pointer-events-auto flex min-w-0 flex-1 items-center gap-1 text-foreground hover:text-primary">
                  <span className="truncate">{name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate">{name}</span>
              )}
              {!disabled && (
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/60 hover:text-destructive" onClick={() => onRemoveExisting(i)} aria-label={`Quitar ${name}`}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )
        })}
        {files.map((file, i) => (
          <div key={`new-${file.name}-${i}`} className="flex items-center gap-2 text-xs">
            <Upload className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            {!disabled && (
              <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/60 hover:text-destructive" onClick={() => onRemoveNew(i)} aria-label={`Quitar ${file.name}`}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        {!disabled && (
          <label className="group relative flex cursor-pointer items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-primary">
            <Upload className="h-3.5 w-3.5" />
            Seleccionar o arrastrar archivos
            <Input
              type="file"
              multiple
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={(e) => {
                if (e.target.files?.length) onAdd(Array.from(e.target.files))
                e.target.value = ""
              }}
            />
          </label>
        )}
        {disabled && count === 0 && <p className="text-xs text-muted-foreground">Sin archivos</p>}
      </div>
    </LabeledContainer>
  )
}
