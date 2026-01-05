"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ServiceContractForm } from "@/components/forms/ServiceContractForm"
import { useState } from "react"

interface ServiceContractDialogProps {
    children?: React.ReactNode
    initialData?: any
    onSuccess?: () => void
}

export function ServiceContractDialog({ children, initialData, onSuccess }: ServiceContractDialogProps) {
    const [open, setOpen] = useState(false)

    const handleSuccess = () => {
        setOpen(false)
        if (onSuccess) onSuccess()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-[1600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Editar Contrato' : 'Nuevo Contrato de Servicio'}</DialogTitle>
                    <DialogDescription>
                        Complete los detalles del contrato a continuación.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <ServiceContractForm onSuccess={handleSuccess} initialData={initialData} />
                </div>
            </DialogContent>
        </Dialog>
    )
}
