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
  const uploadDoc = useUploadF29Document(declaration.id)

  const handleConfirm = async () => {
    if (file) {
      await uploadDoc.mutateAsync(file)
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isClosing || uploadDoc.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!file || isClosing || uploadDoc.isPending}>
            {isClosing || uploadDoc.isPending ? "Cerrando..." : "Confirmar Cierre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
