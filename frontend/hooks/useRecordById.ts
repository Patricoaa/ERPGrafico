"use client"

import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import api from "@/lib/api"

/**
 * Carga un registro por id desde `${endpoint}/${id}/` (ADR-0152). Lo usan los drawers del registro
 * (`ENTITY_DRAWERS`) cuando se abren solo con el id (enlace profundo, relaciones) y no con la fila.
 * Comparte la clave de caché de `useSelectedEntity`, así que reutiliza lo que la lista ya cargó.
 * `id` nulo/0 desactiva la consulta.
 */
export function useRecordById<T>(endpoint: string, id: number | null | undefined) {
    const baseEndpoint = endpoint.replace(/\/$/, "")
    const { data, isLoading, isError } = useQuery<T>({
        queryKey: [baseEndpoint, id ? String(id) : null],
        queryFn: async () => {
            try {
                const response = await api.get<T>(`${baseEndpoint}/${id}/`)
                return response.data
            } catch (err) {
                const status = (err as { response?: { status?: number } })?.response?.status
                if (status === 404) toast.error("No encontrado", { description: "El registro solicitado no existe o fue eliminado." })
                else if (status === 403) toast.error("Sin permiso", { description: "No tienes permiso para ver este registro." })
                else toast.error("Error al cargar el registro", { description: "Intenta de nuevo o recarga la página." })
                throw err
            }
        },
        enabled: !!id,
        retry: false,
    })
    return { record: data ?? null, isLoading, isError }
}
