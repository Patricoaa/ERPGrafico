"use client"

/**
 * useSelectedFiscalYearPreview
 *
 * Lee el query param `?selected=<year>` de la URL y fetchea los datos de
 * preview-closing del ejercicio fiscal correspondiente.
 *
 * Reemplaza el uso de `useSelectedEntity` que construía
 * GET /accounting/fiscal-years/<year>/ (endpoint detail por pk, no por año)
 * en lugar del correcto /accounting/fiscal-years/<year>/preview-closing/.
 */

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { type FiscalYearPreviewResult } from '../types'

export function useSelectedFiscalYearPreview(paramName = 'selected') {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const selectedYearParam = searchParams.get(paramName)

    const clearSelection = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete(paramName)
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, [router, pathname, searchParams, paramName])

    const { data: entity = null, isLoading } = useQuery<FiscalYearPreviewResult | null>({
        queryKey: ['fiscal-year-preview-closing', selectedYearParam],
        queryFn: async () => {
            if (!selectedYearParam) return null

            try {
                const response = await api.get<FiscalYearPreviewResult>(
                    `/accounting/fiscal-years/${selectedYearParam}/preview-closing/`
                )
                return response.data
            } catch (err: unknown) {
                const status = (err as { response?: { status?: number } })?.response?.status

                if (status === 404) {
                    toast.error('No encontrado', {
                        description: 'El ejercicio fiscal solicitado no existe.',
                    })
                    clearSelection()
                    return null
                }

                if (status === 403) {
                    toast.error('Sin permiso', {
                        description: 'No tienes permiso para ver este ejercicio fiscal.',
                    })
                    router.replace(pathname, { scroll: false })
                    return null
                }

                toast.error('Error al cargar el preview del cierre', {
                    description: 'Intenta de nuevo o recarga la página.',
                })
                throw err
            }
        },
        staleTime: 0,
        gcTime: 0,
        enabled: !!selectedYearParam,
        retry: (failureCount, err: unknown) => {
            const status = (err as { response?: { status?: number } })?.response?.status
            if (status === 404 || status === 403) return false
            return failureCount < 2
        },
    })

    return {
        entity: selectedYearParam ? (entity ?? null) : null,
        isLoading: !!selectedYearParam && isLoading,
        clearSelection,
    }
}
