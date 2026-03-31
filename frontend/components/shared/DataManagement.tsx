"use client"

import React, { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Upload, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'

interface DataManagementProps {
    endpoint: string
    templateData: Record<string, unknown>[]
    onImportSuccess: () => void
    exportFilename?: string
}

export const DataManagement: React.FC<DataManagementProps> = ({
    endpoint,
    templateData,
    onImportSuccess,
    exportFilename = 'data-export.csv'
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleExport = async () => {
        try {
            const res = await api.get(endpoint)
            const data = res.data.results || res.data

            if (!data || data.length === 0) {
                toast.error("No hay datos para exportar")
                return
            }

            const headers = Object.keys(data[0]).join(',')
            const csv = data.map((row: Record<string, unknown>) =>
                Object.values(row).map(val =>
                    typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
                ).join(',')
            ).join('\n')

            const blob = new Blob([`${headers}\n${csv}`], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.setAttribute('download', exportFilename)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            toast.success("Datos exportados correctamente")
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
            // We assume the backend has a generic /import/ action in the ViewSet
            // For now, let's implement a placeholder or a direct post if the backend supports it
            await api.post(`${endpoint}bulk_import/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
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