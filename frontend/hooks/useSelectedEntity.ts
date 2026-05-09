"use client"

/**
 * useSelectedEntity — T-87 (F8 / ADR-0020)
 *
 * Lee el query param `?selected=<id>` de la URL actual y fetchea la entidad
 * correspondiente desde el endpoint dado. Reutiliza la cache de TanStack Query
 * si la lista ya cargó el mismo id anteriormente.
 *
 * Contrato: docs/20-contracts/list-modal-edit-pattern.md §2.3
 * ADR: docs/10-architecture/adr/0020-modal-on-list-edit-ux.md
 */

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSelectedEntityOptions {
    /**
     * Base API endpoint sin trailing slash ni id, e.g. '/api/inventory/categories'
     * El hook construye `${endpoint}/${id}/` internamente.
     */
    endpoint: string

    /**
     * Nombre del query param a leer. Default: 'selected'.
     * Cambiar solo si hay colisión legítima con otro param en la misma página.
     */
    paramName?: string
}

export interface UseSelectedEntityResult<T> {
    /** Entidad fetcheada, o null si el param está ausente / en carga / en error */
    entity: T | null

    /** true mientras se realiza el fetch inicial del param seleccionado */
    isLoading: boolean

    /**
     * Limpia la selección: elimina el param `selected` de la URL preservando
     * el resto de params existentes (e.g. filtros de tabla, paginación).
     * Hace `router.replace` — no genera entrada de historial.
     */
    clearSelection: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSelectedEntity<T = unknown>({
    endpoint,
    paramName = 'selected',
}: UseSelectedEntityOptions): UseSelectedEntityResult<T> {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const selectedId = searchParams.get(paramName)

    // Normalise endpoint: strip trailing slash to build a consistent query key
    const baseEndpoint = endpoint.replace(/\/$/, '')

    const clearSelection = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete(paramName)
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }, [router, pathname, searchParams, paramName])

    const { data: entity = null, isLoading } = useQuery<T | null>({
        queryKey: [baseEndpoint, selectedId],
        queryFn: async () => {
            if (!selectedId) return null

            try {
                const response = await api.get<T>(`${baseEndpoint}/${selectedId}/`)
                return response.data
            } catch (err: unknown) {
                const status = (err as { response?: { status?: number } })?.response?.status

                if (status === 404) {
                    toast.error('No encontrado', {
                        description: 'El registro solicitado no existe o fue eliminado.',
                    })
                    clearSelection()
                    return null
                }

                if (status === 403) {
                    toast.error('Sin permiso', {
                        description: 'No tienes permiso para ver este registro.',
                    })
                    // Redirect to base list path (strip all params)
                    router.replace(pathname, { scroll: false })
                    return null
                }

                // For any other error, surface via toast and re-throw so
                // TanStack Query can enter its error state.
                toast.error('Error al cargar el registro', {
                    description: 'Intenta de nuevo o recarga la página.',
                })
                throw err
            }
        },
        // Only run when there is an id to fetch
        enabled: !!selectedId,
        // Don't retry on 404/403 — they are definitive answers
        retry: (failureCount, err: unknown) => {
            const status = (err as { response?: { status?: number } })?.response?.status
            if (status === 404 || status === 403) return false
            return failureCount < 2
        },
        // Keep previous data visible until new fetch completes (avoids modal flash)
        placeholderData: (prev) => prev ?? null,
    })

    return {
        entity: selectedId ? (entity ?? null) : null,
        isLoading: !!selectedId && isLoading,
        clearSelection,
    }
}
