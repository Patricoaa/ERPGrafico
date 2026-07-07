"use client"

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DocumentAttachmentDropzone } from '@/components/shared'
import { useUploadF29Document } from '../hooks/useTaxMutations'
import type { TaxDeclaration } from '../types'

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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cerrar Periodo F29</DialogTitle>
          <DialogDescription>
            Para cerrar el periodo {declaration.tax_period_display}, por favor adjunta el comprobante o formulario F29 en PDF. (Obligatorio)
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <DocumentAttachmentDropzone
            file={file}
            onFileChange={setFile}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isClosing || isUploadingF29Document}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!file || isClosing || isUploadingF29Document}>
            {isClosing || isUploadingF29Document ? "Cerrando..." : "Confirmar Cierre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
