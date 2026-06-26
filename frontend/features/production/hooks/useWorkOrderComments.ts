"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { showApiError } from '@/lib/errors'
import { useRealtime } from '@/features/realtime'

export interface WorkOrderComment {
    id: number
    user: number | null
    user_name: string
    text: string
    created_at: string
    source_label: 'OT' | 'NV' | string
}

const COMMENTS_KEY = 'work-order-comments'

export function useWorkOrderComments(orderId: number) {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()

    const { data: comments = [], isLoading } = useQuery<WorkOrderComment[]>({
        queryKey: [COMMENTS_KEY, orderId],
        queryFn: async () => {
            const res = await api.get(`/production/orders/${orderId}/comments/`)
            return res.data
        },
        staleTime: 30 * 1000,
        enabled: !!orderId,
    })

    const addMutation = useMutation({
        mutationFn: async (text: string) => {
            const res = await api.post(`/production/orders/${orderId}/comments/`, { text })
            return res.data as WorkOrderComment
        },
        onSuccess: () => {
            markLocalMutation()
            queryClient.invalidateQueries({ queryKey: [COMMENTS_KEY, orderId] })
        },
        onError: (err) => showApiError(err, 'Error al agregar comentario'),
    })

    return {
        comments,
        isLoading,
        addComment: addMutation.mutateAsync,
        isAdding: addMutation.isPending,
    }
}
