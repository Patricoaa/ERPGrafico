"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"
import { BaseModal } from "./BaseModal"
import { CancelButton, DangerButton, SubmitButton } from "./ActionButtons"

interface UnsavedChangesDialogProps {
    open: boolean
    /** Nombres de los documentos/formularios con cambios pendientes. */
    names: string[]
    /** Guardando: bloquea los tres botones. */
    saving: boolean
    onSave: () => void
    onDiscard: () => void
    /** "Seguir editando": cancela la acción pendiente (también Escape). */
    onKeepEditing: () => void
}

/**
 * Guarda de cambios sin guardar con tres salidas explícitas. Lo monta GlobalModalProvider;
 * nadie lo usa directo. "Seguir editando" es la salida segura (foco inicial, Escape).
 */
export function UnsavedChangesDialog({ open, names, saving, onSave, onDiscard, onKeepEditing }: UnsavedChangesDialogProps) {
    const subject = names.length === 1 ? names[0] : null

    return (
        <BaseModal
            open={open}
            onOpenChange={(next) => { if (!next && !saving) onKeepEditing() }}
            size="xs"
            onInteractOutside={(e) => e.preventDefault()}
            title={
                <div className="flex items-center gap-4 py-1">
                    <div className="p-2 rounded-full text-warning bg-warning/10">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <span className="text-lg font-bold">Cambios sin guardar</span>
                </div>
            }
            footer={
                <div className="flex flex-wrap gap-2 w-full justify-end">
                    <CancelButton autoFocus onClick={onKeepEditing} disabled={saving}>Seguir editando</CancelButton>
                    <DangerButton variant="outline" onClick={onDiscard} disabled={saving}>Descartar y continuar</DangerButton>
                    <SubmitButton onClick={onSave} loading={saving}>Guardar y continuar</SubmitButton>
                </div>
            }
        >
            <div className="px-1 py-4 text-muted-foreground text-sm leading-relaxed" role="alert">
                {subject
                    ? <p><strong className="text-foreground">{subject}</strong> tiene cambios sin guardar.</p>
                    : <p>Hay {names.length} formularios con cambios sin guardar{names.length > 0 ? `: ${names.join(", ")}` : ""}.</p>}
                <p className="mt-2">Para continuar, guárdelos o descártelos.</p>
            </div>
        </BaseModal>
    )
}
