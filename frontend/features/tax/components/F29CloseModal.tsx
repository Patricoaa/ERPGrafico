"use client"

import React, { useState } from 'react'
import { BaseModal } from "@/components/shared"
import { Button } from '@/components/ui/button'
import { DocumentAttachmentDropzone } from '@/components/shared'
import { useUploadF29Document } from '../hooks/useTaxMutations'
import type { TaxDeclaration } from '../types'
import { FileText } from "lucide-react"

interface F29CloseModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => Promise<void>
    declaration: TaxDeclaration
    isClosing: boolean
}

export function F29CloseModal({ isOpen, onOpenChange, onConfirm, declaration, isClosing }: F29CloseModalProps) {
    const [file, setFile] = useState<File | null>(null)
    const { uploadF29Document, isUploadingF29Document } = useUploadF29Document(declaration.id)

    const handleConfirm = async () => {
        if (file) {
            await uploadF29Document(file)
        }
        await onConfirm()
        onOpenChange(false)
    }

    return (
        <BaseModal
            open={isOpen}
            onOpenChange={onOpenChange}
            icon={FileText}
            title="Cerrar Periodo F29"
            description={
                <>
                    Para cerrar el periodo {declaration.tax_period_display}, por favor adjunta el comprobante o formulario F29 en PDF. (Obligatorio)
                </>
            }
            size="xs"
            footer={
                <>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isClosing || isUploadingF29Document}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} disabled={!file || isClosing || isUploadingF29Document}>
                        {isClosing || isUploadingF29Document ? "Cerrando..." : "Confirmar Cierre"}
                    </Button>
                </>
            }
        >
            <div className="py-4">
                <DocumentAttachmentDropzone
                    file={file}
                    onFileChange={setFile}
                />
            </div>
        </BaseModal>
    )
}