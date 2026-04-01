"use client"

import React, { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Upload, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

interface DataManagementProps {
    /** Callback to handle export. Parent is responsible for fetching data. */
    onExport: () => Promise<void>
    /** Callback to handle import. Receives the FormData with the file. */
    onImport: (formData: FormData) => Promise<void>
    templateData: Record<string, unknown>[]
    /** Called after a successful import */
    onImportSuccess: () => void
    exportFilename?: string
}

export const DataManagement: React.FC<DataManagementProps> = ({
    onExport,
    onImport,
    templateData,
    onImportSuccess,
    exportFilename = 'data-export.csv'
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleExport = async () => {
        try {
            await onExport()
        } catch (error) {
            toast.error("Error al exportar datos")
        }
    }

    const downloadTemplate = () => {
        const headers = Object.keys(templateData[0]).join(',')
        const csv = templateData.map((row: Record<string, unknown>) =>
            Object.values(row).map(val =>
                typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
            ).join(',')
        ).join('\n')

        const blob = new Blob([`${headers}\n${csv}`], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.setAttribute('download', 'plantilla-importacion.csv')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)

        try {
            await onImport(formData)
            toast.success("Datos importados correctamente")
            onImportSuccess()
        } catch (error) {
            const err = error as { response?: { data?: { error?: string } } }
            toast.error(err.response?.data?.error || "Error al importar datos. Verifique el formato.")
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Plantilla
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Importar
            </Button>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImport}
                accept=".csv"
                className="hidden"
            />
        </div>
    )
}