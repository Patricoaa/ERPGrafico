'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { partnersApi } from '@/features/contacts'

/** Descarga el PDF del resultado del periodo de una distribución (copia congelada al cierre del ejercicio). */
export function useDownloadPeriodResult(distributionId: number, fiscalYear: number | undefined) {
    const [isDownloading, setIsDownloading] = useState(false)
    const download = async () => {
        setIsDownloading(true)
        try {
            const blob = await partnersApi.getProfitDistributionResultPdf(distributionId)
            const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
            const link = document.createElement('a')
            link.href = url
            link.download = `resultado-${fiscalYear ?? distributionId}.pdf`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch {
            toast.error('No se pudo descargar el resultado del periodo.')
        } finally {
            setIsDownloading(false)
        }
    }
    return { download, isDownloading }
}
